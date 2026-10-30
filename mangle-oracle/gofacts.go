package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// The Go side of the boundary scan: go/ast over the module's non-test Go
// files, with just enough local type inference to know what Mangle constant
// each fact argument becomes. Unknown shapes are left out, so the rules only
// ever judge shapes that are known.

// GoSite is one place Go produces or consumes a predicate.
type GoSite struct {
	ID        int
	Predicate string
	Arity     int // -1 when the argument list is not a literal
	File      string
	Line      int
	Regime    string
	ArgKinds  []string // per position; "" when unknown
	Modes     string   // externals: "+-" etc.
	// Role of an assert site: /assert (proven to reach an assertion),
	// /helper (a predicate-name parameter of such a producer), or /text.
	Role string
}

// GoFacts is everything the Go scan found.
type GoFacts struct {
	Asserts   []GoSite
	Queries   []GoSite
	Externals []GoSite
	// Mentions are other string literals equal to a known predicate name
	// (lists, maps, logs): evidence that Go handles the name somehow.
	Mentions []GoSite
	// Embeds maps a discovered host load (or an unused embed variable) to
	// the .mg files that form its program.
	Embeds map[string][]string
	Files  int
}

type goScanner struct {
	prof   *Profile
	fset   *token.FileSet
	root   string
	out    *GoFacts
	nextID int
	// declared names predicates the .mg side declares or defines; helper
	// calls and text atoms are only trusted for those names.
	declared map[string]bool
	// roles of Fact literals proven to flow to an assertion.
	roles map[*ast.CompositeLit]string
	// predParams maps a function name to the index of its predicate parameter.
	predParams map[string]int
	// siteNames are the literals already recorded as a site's predicate.
	siteNames map[*ast.BasicLit]bool
	// dirConsts holds package-level string constants per directory, and
	// qualConsts the exported ones as "pkg.Name".
	dirConsts  map[string]map[string]string
	qualConsts map[string]string
}

func skipDir(name string) bool {
	return name != "." && (strings.HasPrefix(name, ".") || strings.HasPrefix(name, "_") ||
		name == "testdata" || name == "vendor" || name == "node_modules")
}

// ScanGo walks root like `go build ./...` would and extracts boundary facts.
// declared holds the predicate names the .mg side declares or defines.
func ScanGo(root string, declared map[string]bool, prof *Profile) (*GoFacts, error) {
	s := &goScanner{prof: prof, fset: token.NewFileSet(), root: root, out: &GoFacts{Embeds: map[string][]string{}},
		declared: declared, roles: map[*ast.CompositeLit]string{}, predParams: map[string]int{},
		siteNames: map[*ast.BasicLit]bool{}, dirConsts: map[string]map[string]string{}, qualConsts: map[string]string{}}
	var files []parsedGo
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if path != root && skipDir(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		f, perr := parser.ParseFile(s.fset, path, nil, parser.ParseComments)
		if perr != nil {
			return nil // a file that does not parse is not part of the build
		}
		files = append(files, parsedGo{path, f})
		return nil
	})
	if err != nil {
		return s.out, err
	}
	// Pass 1: functions that take the predicate name as a parameter, and
	// package-level string constants (predicate names live in those).
	for _, p := range files {
		s.collectConsts(p.path, p.file)
		for _, decl := range p.file.Decls {
			if gd, ok := decl.(*ast.GenDecl); ok && gd.Tok == token.VAR && gd.Doc != nil {
				s.embeds(p.path, gd)
			}
		}
	}
	newGoFlow(s, files).classify()
	for _, p := range files {
		collectPredicateParams(p.file, s.predParams, s.prof.VariadicAssert.Method, s.roles)
	}
	// Pass 2: the facts.
	for _, p := range files {
		s.out.Files++
		s.file(p.path, p.file)
	}
	return s.out, nil
}

func (s *goScanner) collectConsts(path string, f *ast.File) {
	dir := filepath.Dir(path)
	if s.dirConsts[dir] == nil {
		s.dirConsts[dir] = map[string]string{}
	}
	for _, decl := range f.Decls {
		gd, ok := decl.(*ast.GenDecl)
		if !ok || (gd.Tok != token.CONST && gd.Tok != token.VAR) {
			continue
		}
		for _, spec := range gd.Specs {
			vs, ok := spec.(*ast.ValueSpec)
			if !ok {
				continue
			}
			for i, n := range vs.Names {
				if i >= len(vs.Values) {
					continue
				}
				lit, ok := vs.Values[i].(*ast.BasicLit)
				if !ok || lit.Kind != token.STRING {
					continue
				}
				v, err := strconv.Unquote(lit.Value)
				if err != nil {
					continue
				}
				s.dirConsts[dir][n.Name] = v
				if n.IsExported() {
					s.qualConsts[f.Name.Name+"."+n.Name] = v
				}
			}
		}
	}
}

// collectPredicateParams finds functions whose parameter becomes a Fact's
// Predicate (or AddFact's first argument): assertVetCounts(turn, predicate, ...).
func collectPredicateParams(f *ast.File, out map[string]int, variadicMethod string, roles map[*ast.CompositeLit]string) {
	for _, decl := range f.Decls {
		fd, ok := decl.(*ast.FuncDecl)
		if !ok || fd.Body == nil || fd.Type.Params == nil {
			continue
		}
		params := map[string]int{}
		i := 0
		for _, field := range fd.Type.Params.List {
			for _, n := range field.Names {
				params[n.Name] = i
				i++
			}
			if len(field.Names) == 0 {
				i++
			}
		}
		ast.Inspect(fd.Body, func(n ast.Node) bool {
			var pred ast.Expr
			switch n := n.(type) {
			case *ast.CompositeLit:
				if roles[n] == "/assert" {
					for _, el := range n.Elts {
						if kv, ok := el.(*ast.KeyValueExpr); ok && calleeName(kv.Key) == "Predicate" {
							pred = kv.Value
						}
					}
				}
			case *ast.CallExpr:
				if calleeName(n.Fun) == variadicMethod && len(n.Args) > 0 {
					pred = n.Args[0]
				}
			}
			if id, ok := pred.(*ast.Ident); ok {
				if idx, ok := params[id.Name]; ok {
					out[fd.Name.Name] = idx
				}
			}
			return true
		})
	}
}

func (s *goScanner) rel(path string) string {
	if r, err := filepath.Rel(s.root, path); err == nil {
		return filepath.ToSlash(r)
	}
	return path
}

// scope maps local identifiers to argument kinds, mode letters or strings.
type scope struct {
	kinds   map[string]string
	modes   map[string]string
	strs    map[string]string
	pkg     string
	factPkg map[string]string // import alias -> regime for its Fact type
	// poisoned variables took values of different kinds; they stay unknown.
	poisoned map[string]bool
	// qual resolves pkg.Const string constants from other packages.
	qual map[string]string
	prof *Profile
	// externalCtx: the function builds engine.ExternalPredicateCallback values,
	// so PredicateSym keys it stores are external registrations.
	externalCtx bool
}

func (s *goScanner) file(path string, f *ast.File) {
	sc := &scope{kinds: map[string]string{}, modes: map[string]string{}, strs: map[string]string{}, pkg: f.Name.Name, factPkg: map[string]string{}, poisoned: map[string]bool{}, qual: s.qualConsts, prof: s.prof}
	for k, v := range s.dirConsts[filepath.Dir(path)] {
		sc.strs[k] = v
	}
	for _, imp := range f.Imports {
		p, _ := strconv.Unquote(imp.Path.Value)
		alias := filepath.Base(p)
		if imp.Name != nil {
			alias = imp.Name.Name
		}
		for _, ft := range s.prof.FactTypes {
			if ft.ImportSuffix != "" && strings.HasSuffix(p, ft.ImportSuffix) {
				sc.factPkg[alias] = ft.Regime
			}
		}
	}
	// Package-level constants and variables with literal values.
	for _, decl := range f.Decls {
		gd, ok := decl.(*ast.GenDecl)
		if !ok {
			continue
		}
		for _, spec := range gd.Specs {
			vs, ok := spec.(*ast.ValueSpec)
			if !ok {
				continue
			}
			for i, name := range vs.Names {
				if i < len(vs.Values) {
					sc.bind(name.Name, vs.Values[i])
				}
			}
		}
	}
	for _, decl := range f.Decls {
		if gd, ok := decl.(*ast.GenDecl); ok && gd.Tok != token.IMPORT {
			s.body(path, gd, sc.child()) // package-level tables, maps and facts
		}
	}
	ast.Inspect(f, func(n ast.Node) bool {
		fd, ok := n.(*ast.FuncDecl)
		if !ok || fd.Body == nil {
			return true
		}
		local := sc.child()
		if fd.Type.Params != nil {
			for _, field := range fd.Type.Params.List {
				k := local.typeKind(field.Type)
				for _, name := range field.Names {
					if k != "" {
						local.kinds[name.Name] = k
					}
				}
			}
		}
		local.externalCtx = mentions(fd, "ExternalPredicateCallback")
		s.body(path, fd.Body, local)
		return false
	})
}

func (sc *scope) child() *scope {
	c := &scope{kinds: map[string]string{}, modes: map[string]string{}, strs: map[string]string{}, pkg: sc.pkg, factPkg: sc.factPkg, poisoned: map[string]bool{}, qual: sc.qual, prof: sc.prof}
	for k, v := range sc.kinds {
		c.kinds[k] = v
	}
	for k, v := range sc.strs {
		c.strs[k] = v
	}
	return c
}

// rebind binds a variable again; a variable that takes values of different
// kinds (x := "" then x = f()) is unknown from then on.
func (sc *scope) rebind(name string, value ast.Expr) {
	if sc.poisoned[name] {
		return
	}
	before, had := sc.kinds[name]
	_, hadStr := sc.strs[name]
	if !had && !hadStr {
		sc.bind(name, value)
		return
	}
	probe := &scope{kinds: map[string]string{}, modes: map[string]string{}, strs: map[string]string{}, pkg: sc.pkg, factPkg: sc.factPkg, poisoned: map[string]bool{}, prof: sc.prof}
	for k, v := range sc.kinds {
		probe.kinds[k] = v
	}
	probe.bind(name, value)
	if probe.kinds[name] != before || probe.strs[name] != sc.strs[name] {
		sc.poison(name)
	}
}

func (sc *scope) poison(name string) {
	sc.poisoned[name] = true
	delete(sc.kinds, name)
	delete(sc.strs, name)
}

func (sc *scope) bind(name string, value ast.Expr) {
	if m := modeOf(value); m != "" {
		sc.modes[name] = m
	}
	if lit, ok := value.(*ast.BasicLit); ok && lit.Kind == token.STRING {
		if v, err := strconv.Unquote(lit.Value); err == nil {
			sc.strs[name] = v
		}
	}
	k := sc.kindOf(value)
	if k == "" {
		// Defined, shape unknown: a later `x = "lit"` must not make it known.
		sc.kinds[name] = unknownKind
		return
	}
	// A literal bound to a variable is a string value, not a literal at the call.
	if k == "/lit_name" || k == "/lit_string" {
		k = "/dynstring"
		if v, ok := sc.strs[name]; ok {
			k = literalKind(v)
		}
	}
	sc.kinds[name] = k
}

// unknownKind marks a variable whose shape is not known.
const unknownKind = "?"

func (s *goScanner) body(path string, body ast.Node, sc *scope) {
	ast.Inspect(body, func(n ast.Node) bool {
		switch n := n.(type) {
		case *ast.AssignStmt:
			if sc.externalCtx {
				for _, lhs := range n.Lhs {
					if ix, ok := lhs.(*ast.IndexExpr); ok {
						s.predicateSymExternal(path, ix.Index, sc)
					}
				}
			}
			for i, lhs := range n.Lhs {
				id, ok := lhs.(*ast.Ident)
				if !ok || id.Name == "_" {
					continue
				}
				if len(n.Lhs) != len(n.Rhs) {
					sc.poison(id.Name) // v, err := f(): the shape is not known
					continue
				}
				sc.rebind(id.Name, n.Rhs[i])
			}
		case *ast.DeclStmt:
			if gd, ok := n.Decl.(*ast.GenDecl); ok {
				for _, spec := range gd.Specs {
					vs, ok := spec.(*ast.ValueSpec)
					if !ok {
						continue
					}
					k := sc.typeKind(vs.Type)
					for i, name := range vs.Names {
						switch {
						case k != "":
							sc.kinds[name.Name] = k
						case i < len(vs.Values):
							sc.bind(name.Name, vs.Values[i])
						default:
							sc.kinds[name.Name] = unknownKind
						}
					}
				}
			}
		case *ast.CompositeLit:
			s.factLiteral(path, n, sc)
			if mt, ok := n.Type.(*ast.MapType); ok && mentions(mt.Value, "ExternalPredicateCallback") {
				for _, el := range n.Elts {
					if kv, ok := el.(*ast.KeyValueExpr); ok {
						s.predicateSymExternal(path, kv.Key, sc)
					}
				}
			}
		case *ast.BasicLit:
			s.textAtom(path, n)
		case *ast.CallExpr:
			s.call(path, n, sc)
		case *ast.FuncLit:
			// Closures see the enclosing scope.
			return true
		}
		return true
	})
}

// factLiteral records Fact{Predicate: "p", Args: []any{...}}, including
// elements of []Fact{...} whose type is elided.
func (s *goScanner) factLiteral(path string, lit *ast.CompositeLit, sc *scope) {
	regime, typed := sc.factRegime(lit.Type)
	if !typed && lit.Type != nil {
		if elem := sliceElem(lit.Type); elem != nil {
			if r, ok := sc.factRegime(elem); ok {
				for _, el := range lit.Elts {
					if inner, ok := el.(*ast.CompositeLit); ok && inner.Type == nil {
						s.factElement(path, inner, sc, r)
					}
				}
			}
		}
		return
	}
	if typed {
		s.factElement(path, lit, sc, regime)
	}
}

func sliceElem(t ast.Expr) ast.Expr {
	if at, ok := t.(*ast.ArrayType); ok {
		if star, ok := at.Elt.(*ast.StarExpr); ok {
			return star.X
		}
		return at.Elt
	}
	return nil
}

func (s *goScanner) factElement(path string, lit *ast.CompositeLit, sc *scope, regime string) {
	role := s.roles[lit]
	if role != "/assert" {
		return
	}
	var predExpr, argsExpr ast.Expr
	for i, el := range lit.Elts {
		if kv, ok := el.(*ast.KeyValueExpr); ok {
			if key, ok := kv.Key.(*ast.Ident); ok {
				switch key.Name {
				case "Predicate":
					predExpr = kv.Value
				case "Args":
					argsExpr = kv.Value
				}
			}
		} else if i == 0 {
			predExpr = el
		} else if i == 1 {
			argsExpr = el
		}
	}
	pred, ok := sc.stringValue(predExpr)
	if !ok || !isPredicateName(pred) {
		return
	}
	s.markName(predExpr)
	site := s.site(path, lit.Pos(), pred, regime)
	site.Role = role
	if al, ok := argsExpr.(*ast.CompositeLit); ok {
		site.Arity = len(al.Elts)
		for _, a := range al.Elts {
			site.ArgKinds = append(site.ArgKinds, sc.kindOf(a))
		}
	}
	s.out.Asserts = append(s.out.Asserts, site)
}

func (sc *scope) factRegime(t ast.Expr) (string, bool) {
	switch t := t.(type) {
	case *ast.Ident:
		if t.Name != "Fact" {
			return "", false
		}
		for _, ft := range sc.prof.FactTypes {
			if ft.Package == sc.pkg {
				return ft.Regime, true
			}
		}
		return RegimeUnknown, true
	case *ast.SelectorExpr:
		if t.Sel.Name != "Fact" {
			return "", false
		}
		if x, ok := t.X.(*ast.Ident); ok {
			if r, ok := sc.factPkg[x.Name]; ok {
				return r, true
			}
		}
		return RegimeUnknown, true
	}
	return "", false
}

func (s *goScanner) call(path string, call *ast.CallExpr, sc *scope) {
	name := calleeName(call.Fun)
	switch {
	case name == s.prof.VariadicAssert.Method && len(call.Args) >= 1:
		pred, ok := sc.stringValue(call.Args[0])
		if !ok || !isPredicateName(pred) {
			return
		}
		s.markName(call.Args[0])
		s.addVariadic(path, call, sc, pred, s.prof.VariadicAssert.Regime)
	case contains(s.prof.QueryMethods, name):
		for _, a := range call.Args {
			text, ok := sc.stringValue(a)
			if !ok {
				continue
			}
			pred, arity := atomShape(text)
			if pred != "" {
				s.markName(a)
				site := s.site(path, call.Pos(), pred, "")
				site.Arity = arity
				s.out.Queries = append(s.out.Queries, site)
			}
			break
		}
	case s.predicateParamCall(name, call, sc):
		// assertVetCounts(turn, "turn_vet_finding", ...): the callee builds the fact.
		idx := s.predParams[name]
		pred, _ := sc.stringValue(call.Args[idx])
		s.markName(call.Args[idx])
		site := s.site(path, call.Pos(), pred, RegimeUnknown)
		site.Role = "/helper"
		s.out.Asserts = append(s.out.Asserts, site)
	case s.isAssertHelper(name) && len(call.Args) >= 1:
		// Profile conventions for predicate-name APIs remain useful when
		// the implementation is external to the scanned module.
		if pred, ok := sc.stringValue(call.Args[0]); ok && s.declared[pred] {
			s.markName(call.Args[0])
			site := s.site(path, call.Pos(), pred, RegimeUnknown)
			site.Role = "/helper"
			s.out.Asserts = append(s.out.Asserts, site)
		}
	default:
		s.external(path, call, sc)
	}
}

func (s *goScanner) predicateParamCall(name string, call *ast.CallExpr, sc *scope) bool {
	idx, ok := s.predParams[name]
	if !ok || idx >= len(call.Args) || strings.HasPrefix(strings.ToLower(name), "retract") {
		return false
	}
	pred, ok := sc.stringValue(call.Args[idx])
	return ok && isPredicateName(pred)
}

func (s *goScanner) isAssertHelper(name string) bool {
	n := strings.ToLower(name)
	for _, verb := range s.prof.AssertHelperVerbs {
		if strings.HasPrefix(n, verb) || strings.HasSuffix(n, verb) {
			return !strings.HasPrefix(n, "retract")
		}
	}
	return false
}

func (s *goScanner) addVariadic(path string, call *ast.CallExpr, sc *scope, pred, regime string) {
	site := s.site(path, call.Pos(), pred, regime)
	site.Role = "/assert"
	if !call.Ellipsis.IsValid() {
		site.Arity = len(call.Args) - 1
		for _, a := range call.Args[1:] {
			site.ArgKinds = append(site.ArgKinds, sc.kindOf(a))
		}
	}
	s.out.Asserts = append(s.out.Asserts, site)
}

// textAtoms records facts written as Mangle text in Go, e.g.
// fmt.Sprintf("user_intent(%s, ...)", ...) or "config_param(/x, 3).".
func (s *goScanner) textAtom(path string, lit *ast.BasicLit) {
	if lit.Kind != token.STRING {
		return
	}
	v, err := strconv.Unquote(lit.Value)
	if err != nil {
		return
	}
	if s.declared[v] && !s.siteNames[lit] {
		m := s.site(path, lit.Pos(), v, "")
		s.out.Mentions = append(s.out.Mentions, m)
		return
	}
	text := strings.TrimSuffix(strings.TrimSpace(v), ".")
	if strings.Contains(v, ":-") {
		return
	}
	pred, arity := atomShape(text)
	if pred == "" {
		// "retrieved_context(" + quote(id) + ")": an atom built by concatenation.
		if open := strings.IndexByte(text, '('); open > 0 && strings.HasSuffix(text, "(") && s.declared[text[:open]] {
			pred, arity = text[:open], -1
		}
	}
	if pred == "" || !s.declared[pred] {
		return
	}
	// A format string writes facts; otherwise only a ground atom is a fact
	// (state(X, "pending") in a message is an example, not a producer).
	if !strings.Contains(text, "%") && hasVariable(text) {
		return
	}
	site := s.site(path, lit.Pos(), pred, RegimeUnknown)
	site.Arity = arity
	site.Role = "/text"
	s.out.Asserts = append(s.out.Asserts, site)
}

// mentions reports whether an identifier or selector named name occurs in n.
func mentions(n ast.Node, name string) bool {
	found := false
	ast.Inspect(n, func(x ast.Node) bool {
		switch x := x.(type) {
		case *ast.Ident:
			found = found || x.Name == name
		case *ast.SelectorExpr:
			found = found || x.Sel.Name == name
		}
		return !found
	})
	return found
}

// predicateSymExternal records ast.PredicateSym{Symbol: "p", Arity: n} used as
// the key of an external-callback map: the mangle-go way to register an
// external. Modes are not stated there, so B010 does not apply.
func (s *goScanner) predicateSymExternal(path string, key ast.Expr, sc *scope) {
	lit, ok := key.(*ast.CompositeLit)
	if !ok || (lit.Type != nil && calleeName(lit.Type) != "PredicateSym") {
		return
	}
	var predExpr, arityExpr ast.Expr
	for i, el := range lit.Elts {
		if kv, ok := el.(*ast.KeyValueExpr); ok {
			switch calleeName(kv.Key) {
			case "Symbol":
				predExpr = kv.Value
			case "Arity":
				arityExpr = kv.Value
			}
		} else if i == 0 {
			predExpr = el
		} else if i == 1 {
			arityExpr = el
		}
	}
	pred, ok := sc.stringValue(predExpr)
	al, ok2 := arityExpr.(*ast.BasicLit)
	if !ok || !ok2 || al.Kind != token.INT || !isPredicateName(pred) {
		return
	}
	arity, _ := strconv.Atoi(al.Value)
	s.markName(predExpr)
	site := s.site(path, lit.Pos(), pred, "")
	site.Arity = arity
	s.out.Externals = append(s.out.Externals, site)
}

// external records a registration shaped like mkPred("name", arity, handler, modes...).
func (s *goScanner) external(path string, call *ast.CallExpr, sc *scope) {
	if len(call.Args) < 3 {
		return
	}
	pred, ok := sc.stringValue(call.Args[0])
	if !ok || !isPredicateName(pred) {
		return
	}
	lit, ok := call.Args[1].(*ast.BasicLit)
	if !ok || lit.Kind != token.INT {
		return
	}
	arity, err := strconv.Atoi(lit.Value)
	if err != nil || arity <= 0 || len(call.Args) < 2+arity {
		return
	}
	var modes strings.Builder
	for _, a := range call.Args[len(call.Args)-arity:] {
		m := modeOf(a)
		if id, ok := a.(*ast.Ident); ok && m == "" {
			m = sc.modes[id.Name]
		}
		if m == "" {
			return
		}
		modes.WriteString(m)
	}
	s.markName(call.Args[0])
	site := s.site(path, call.Pos(), pred, "")
	site.Arity = arity
	site.Modes = modes.String()
	s.out.Externals = append(s.out.Externals, site)
}

func (s *goScanner) markName(e ast.Expr) {
	if lit, ok := e.(*ast.BasicLit); ok {
		s.siteNames[lit] = true
	}
}

func (s *goScanner) site(path string, pos token.Pos, pred, regime string) GoSite {
	s.nextID++
	return GoSite{ID: s.nextID, Predicate: pred, Arity: -1, File: s.rel(path), Line: s.fset.Position(pos).Line, Regime: regime}
}

// embeds records //go:embed directives that pull in .mg files.
func (s *goScanner) embeds(path string, gd *ast.GenDecl) {
	var patterns []string
	for _, c := range gd.Doc.List {
		if rest, ok := strings.CutPrefix(c.Text, "//go:embed "); ok {
			patterns = append(patterns, strings.Fields(rest)...)
		}
	}
	if len(patterns) == 0 || len(gd.Specs) == 0 {
		return
	}
	vs, ok := gd.Specs[0].(*ast.ValueSpec)
	if !ok || len(vs.Names) == 0 {
		return
	}
	dir := filepath.Dir(path)
	var files []string
	for _, pat := range patterns {
		matches, _ := filepath.Glob(filepath.Join(dir, pat))
		for _, m := range matches {
			_ = filepath.WalkDir(m, func(p string, d os.DirEntry, err error) error {
				if err == nil && !d.IsDir() && strings.HasSuffix(p, ".mg") {
					files = append(files, s.rel(p))
				}
				return nil
			})
		}
	}
	if len(files) > 0 {
		key := s.rel(dir) + ":" + vs.Names[0].Name
		s.out.Embeds[key] = append(s.out.Embeds[key], files...)
	}
}

func calleeName(fun ast.Expr) string {
	switch f := fun.(type) {
	case *ast.SelectorExpr:
		return f.Sel.Name
	case *ast.Ident:
		return f.Name
	}
	return ""
}

var modeLetters = map[string]string{"ArgModeInput": "+", "ArgModeOutput": "-", "ArgModeInputOutput": "?"}

// modeOf reads ast.ArgModeInput (or a bare ArgModeInput) inside an expression.
func modeOf(e ast.Expr) string {
	var found string
	ast.Inspect(e, func(n ast.Node) bool {
		switch n := n.(type) {
		case *ast.SelectorExpr:
			found = modeLetters[n.Sel.Name]
			return false
		case *ast.Ident:
			found = modeLetters[n.Name]
		}
		return found == ""
	})
	return found
}

func (sc *scope) stringValue(e ast.Expr) (string, bool) {
	switch e := e.(type) {
	case *ast.BasicLit:
		if e.Kind == token.STRING {
			v, err := strconv.Unquote(e.Value)
			return v, err == nil
		}
	case *ast.Ident:
		v, ok := sc.strs[e.Name]
		return v, ok
	case *ast.SelectorExpr:
		if x, ok := e.X.(*ast.Ident); ok {
			v, ok := sc.qual[x.Name+"."+e.Sel.Name]
			return v, ok
		}
	}
	return "", false
}

func isPredicateName(s string) bool {
	if s == "" || s[0] < 'a' || s[0] > 'z' {
		return false
	}
	for _, r := range s {
		if !(r == '_' || r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9') {
			return false
		}
	}
	return true
}

// atomShape reads "pred", "pred(X, Y)" or "?pred(X)" into name and arity (-1 if unknown).
func atomShape(text string) (string, int) {
	text = strings.TrimPrefix(strings.TrimSpace(text), "?")
	open := strings.IndexByte(text, '(')
	if open < 0 {
		if isPredicateName(text) {
			return text, -1
		}
		return "", 0
	}
	name := text[:open]
	if !isPredicateName(name) || !strings.HasSuffix(text, ")") {
		return "", 0
	}
	inner := strings.TrimSpace(text[open+1 : len(text)-1])
	if inner == "" {
		return name, 0
	}
	depth, arity := 0, 1
	inStr := false
	for _, r := range inner {
		switch {
		case r == '"':
			inStr = !inStr
		case inStr:
		case r == '(' || r == '[' || r == '{':
			depth++
		case r == ')' || r == ']' || r == '}':
			depth--
		case r == ',' && depth == 0:
			arity++
		}
	}
	return name, arity
}

// hasVariable reports an uppercase-initial identifier outside quotes.
func hasVariable(text string) bool {
	inStr := byte(0)
	for i := 0; i < len(text); i++ {
		c := text[i]
		switch {
		case inStr != 0:
			if c == inStr {
				inStr = 0
			}
		case c == '"' || c == '\'' || c == '`':
			inStr = c
		case c >= 'A' && c <= 'Z' && (i == 0 || !isIdentByte(text[i-1])):
			return true
		}
	}
	return false
}

func isIdentByte(c byte) bool {
	return c == '_' || c == '/' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9'
}

var fileExtensions = []string{".go", ".md", ".py", ".js", ".ts", ".tsx", ".jsx", ".yaml", ".yml", ".json", ".txt", ".mg", ".html", ".css"}

// literalKind classifies a string literal the way types.Fact.ToAtom converts it.
func literalKind(v string) string {
	if !strings.HasPrefix(v, "/") || v == "/" || strings.ContainsAny(v, " \t\r\n") ||
		strings.Contains(v, "//") || strings.Count(v, "/") > 2 {
		return "/lit_string"
	}
	for _, ext := range fileExtensions {
		if strings.HasSuffix(v, ext) {
			return "/lit_string"
		}
	}
	return "/lit_name"
}

// typeKind maps a Go type to the constant kind its values become. The
// profile names the host's own name and string types (codeNERD: MangleAtom,
// MangleString); the mangle-go constructors ast.Name and ast.String are
// handled as calls in kindOf.
func (sc *scope) typeKind(t ast.Expr) string {
	var name string
	switch t := t.(type) {
	case *ast.Ident:
		switch t.Name {
		case "string":
			return "/dynstring"
		case "int", "int64", "int32", "int16", "int8", "uint", "uint32", "uint64":
			return "/number"
		case "float64", "float32":
			return "/float64"
		case "bool":
			return "/bool"
		}
		name = t.Name
	case *ast.SelectorExpr:
		switch t.Sel.Name {
		case "Time":
			return "/time"
		case "Duration":
			return "/duration"
		}
		name = t.Sel.Name
	}
	switch {
	case name == "":
		return ""
	case contains(sc.prof.NameTypes, name):
		return "/name"
	case contains(sc.prof.StringTypes, name):
		return "/string"
	}
	return ""
}

var stringFuncs = map[string]bool{
	"Sprintf": true, "Itoa": true, "FormatInt": true, "FormatFloat": true, "Quote": true,
	"ToLower": true, "ToUpper": true, "TrimSpace": true, "Join": true, "Trim": true,
	"TrimPrefix": true, "TrimSuffix": true, "Replace": true, "ReplaceAll": true,
	"Base": true, "Dir": true, "Clean": true, "ToSlash": true, "String": true, "Error": true,
}

func (sc *scope) kindOf(e ast.Expr) string {
	switch e := e.(type) {
	case *ast.BasicLit:
		switch e.Kind {
		case token.STRING:
			if v, err := strconv.Unquote(e.Value); err == nil {
				return literalKind(v)
			}
		case token.INT:
			return "/number"
		case token.FLOAT:
			return "/float64"
		}
	case *ast.Ident:
		switch e.Name {
		case "true", "false":
			return "/bool"
		}
		if k := sc.kinds[e.Name]; k != unknownKind {
			return k
		}
		return ""
	case *ast.ParenExpr:
		return sc.kindOf(e.X)
	case *ast.UnaryExpr:
		if e.Op == token.SUB {
			return sc.kindOf(e.X)
		}
	case *ast.BinaryExpr:
		l, r := sc.kindOf(e.X), sc.kindOf(e.Y)
		if e.Op == token.ADD && (strings.HasPrefix(l, "/lit_") || l == "/dynstring" || strings.HasPrefix(r, "/lit_") || r == "/dynstring") {
			return "/dynstring"
		}
		if l == r && (l == "/number" || l == "/float64") {
			return l
		}
	case *ast.CallExpr:
		name := calleeName(e.Fun)
		if k := sc.typeKind(e.Fun); k != "" && len(e.Args) == 1 {
			if k == "/dynstring" {
				return "/dynstring"
			}
			return k
		}
		if sel, ok := e.Fun.(*ast.SelectorExpr); ok {
			if x, ok := sel.X.(*ast.Ident); ok && x.Name == "ast" {
				switch sel.Sel.Name { // mangle-go constant constructors
				case "Name":
					return "/name"
				case "String":
					return "/string"
				case "Number":
					return "/number"
				case "Float64":
					return "/float64"
				}
			}
		}
		switch name {
		case "len", "Unix", "UnixNano", "UnixMilli", "Milliseconds", "Atoi":
			return "/number"
		case "Seconds", "Minutes", "Hours":
			return "/float64"
		case "Now":
			return "/time"
		case "Since", "Until", "Sub":
			return "/duration"
		}
		if stringFuncs[name] {
			return "/dynstring"
		}
	}
	return ""
}
