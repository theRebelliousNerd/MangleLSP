package main

import (
	"fmt"
	"go/ast"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// goFlow follows values, rather than names of producer helpers. A Fact
// constructor is atomic: extracting its Args and building another Fact does
// not assert the original envelope. Containers, aliases, function arguments
// and individual return slots retain their provenance. Calls are traversed
// with their own argument frame, so asserting identity(a) does not assert b
// from a different identity(b) call.
//
// This is a syntax analysis, not a Go type checker. Assignments and branches
// are unioned (may-flow); unresolved calls and dynamic field names supply no
// evidence of assertion or program membership. No host code is executed.
type goFlow struct {
	s        *goScanner
	files    []parsedGo
	nodes    map[ast.Expr]*flowNode
	objects  map[*ast.Object]*flowNode
	globals  map[string]*flowNode
	funcs    map[string]*flowFunc
	closures map[*ast.FuncLit]*flowFunc
	methods  map[string][]*flowFunc
	ordered  []*flowFunc
	sinks    []*flowNode
	loads    map[string]*flowLoad
	current  *flowFunc
	imports  map[*ast.File]map[string]string
	module   string
}

type parsedGo struct {
	path string
	file *ast.File
}

type flowNode struct {
	owner       *flowFunc
	deps        []*flowNode
	fields      map[string]*flowNode
	lit         *ast.CompositeLit
	text        *string
	files       []string
	baseDir     string
	param       *flowParam
	call        *flowCall
	selectField string
	concat      bool
	read        bool
	allocation  bool
}

type flowParam struct {
	fn    *flowFunc
	index int
}

type flowFunc struct {
	file     parsedGo
	params   []*flowNode
	results  []*flowNode
	calls    []*flowCall
	body     *ast.BlockStmt
	receiver string
}

type flowLoad struct {
	fn       *flowFunc
	receiver *flowNode
	roots    []*flowNode
	pos      token.Pos
}

type flowCall struct {
	pos    token.Pos
	owner  *flowFunc
	fn     *flowFunc
	args   []*flowNode
	result int
}

type flowFrame struct {
	call   *flowCall
	parent *flowFrame
}

func readModule(root string) (string, error) {
	data, err := os.ReadFile(filepath.Join(root, "go.mod"))
	if err != nil {
		return "", err
	}
	if m := moduleLine.FindSubmatch(data); m != nil {
		return string(m[1]), nil
	}
	return "", fmt.Errorf("no module directive")
}

func newGoFlow(s *goScanner, files []parsedGo) *goFlow {
	g := &goFlow{s: s, files: files, nodes: map[ast.Expr]*flowNode{}, objects: map[*ast.Object]*flowNode{},
		globals: map[string]*flowNode{}, funcs: map[string]*flowFunc{}, closures: map[*ast.FuncLit]*flowFunc{},
		methods: map[string][]*flowFunc{}, loads: map[string]*flowLoad{}, imports: map[*ast.File]map[string]string{}}
	if data, err := readModule(s.root); err == nil {
		g.module = data
	}
	// Index declarations before wiring bodies, including functions in other
	// files and packages. Package-qualified names prevent helper collisions.
	for _, p := range files {
		imps := map[string]string{}
		for _, imp := range p.file.Imports {
			path, _ := strconv.Unquote(imp.Path.Value)
			alias := filepath.Base(path)
			if imp.Name != nil {
				alias = imp.Name.Name
			}
			imps[alias] = "" // distinguish external packages from receivers
			if strings.HasPrefix(path, g.module+"/") && g.module != "" {
				imps[alias] = filepath.Join(s.root, strings.TrimPrefix(path, g.module+"/"))
			}
		}
		g.imports[p.file] = imps
		for _, decl := range p.file.Decls {
			if fd, ok := decl.(*ast.FuncDecl); ok && fd.Body != nil {
				fn := g.function(p, fd.Type, fd.Body)
				g.ordered = append(g.ordered, fn)
				if fd.Recv == nil {
					g.funcs[filepath.Dir(p.path)+":"+fd.Name.Name] = fn
				} else {
					// Method receivers are parameters too: a method which calls
					// another loader must retain the caller's engine identity.
					n := &flowNode{owner: fn}
					if names := fd.Recv.List[0].Names; len(names) > 0 {
						n = g.variable(p, names[0])
					}
					n.owner = fn
					n.param = &flowParam{fn, 0}
					fn.params = append([]*flowNode{n}, fn.params...)
					for i, param := range fn.params {
						if param.param != nil {
							param.param.index = i
						}
					}
					fn.receiver = calleeName(fd.Recv.List[0].Type)
					if star, ok := fd.Recv.List[0].Type.(*ast.StarExpr); ok {
						fn.receiver = calleeName(star.X)
					}
					g.methods[fd.Name.Name] = append(g.methods[fd.Name.Name], fn)
				}
			}
		}
		ast.Inspect(p.file, func(n ast.Node) bool {
			if fl, ok := n.(*ast.FuncLit); ok {
				g.closures[fl] = g.function(p, fl.Type, fl.Body)
				g.ordered = append(g.ordered, g.closures[fl])
			}
			return true
		})
	}
	// Embeds are already expanded by the scanner. They also seed package
	// variables when a function returns a filesystem or a string embed.
	for id, files := range s.out.Embeds {
		i := strings.LastIndexByte(id, ':')
		n := g.global(filepath.Join(s.root, id[:i]), id[i+1:])
		n.files = append(n.files, files...)
		n.baseDir = id[:i]
	}
	for _, p := range files {
		for _, decl := range p.file.Decls {
			if gd, ok := decl.(*ast.GenDecl); ok && gd.Tok != token.IMPORT {
				g.wire(p, gd, nil)
			}
		}
	}
	for _, fn := range g.ordered {
		g.wire(fn.file, fn.body, fn)
	}
	return g
}

func (g *goFlow) function(p parsedGo, typ *ast.FuncType, body *ast.BlockStmt) *flowFunc {
	fn := &flowFunc{file: p, body: body}
	if typ.Params != nil {
		for _, f := range typ.Params.List {
			if len(f.Names) == 0 {
				fn.params = append(fn.params, &flowNode{owner: fn})
				continue
			}
			for _, id := range f.Names {
				n := g.variable(p, id)
				n.owner = fn
				n.param = &flowParam{fn, len(fn.params)}
				fn.params = append(fn.params, n)
			}
		}
	}
	if typ.Results != nil {
		for _, f := range typ.Results.List {
			if len(f.Names) == 0 {
				fn.results = append(fn.results, &flowNode{owner: fn})
				continue
			}
			for _, id := range f.Names {
				n := g.variable(p, id)
				n.owner = fn
				fn.results = append(fn.results, n)
			}
		}
	}
	return fn
}

func (g *goFlow) global(dir, name string) *flowNode {
	key := dir + ":" + name
	if g.globals[key] == nil {
		g.globals[key] = &flowNode{}
	}
	return g.globals[key]
}

func (g *goFlow) variable(p parsedGo, id *ast.Ident) *flowNode {
	if id.Obj == nil {
		return g.global(filepath.Dir(p.path), id.Name)
	}
	// The parser resolves package objects only within their file. Use the
	// package key for those objects, so references in other files meet them.
	if p.file.Scope.Lookup(id.Name) == id.Obj {
		return g.global(filepath.Dir(p.path), id.Name)
	}
	if g.objects[id.Obj] == nil {
		g.objects[id.Obj] = &flowNode{owner: g.current}
	}
	return g.objects[id.Obj]
}

func (g *goFlow) resolve(p parsedGo, e ast.Expr) *flowFunc {
	switch e := e.(type) {
	case *ast.Ident:
		if e.Obj != nil {
			if vs, ok := e.Obj.Decl.(*ast.ValueSpec); ok {
				for _, rhs := range vs.Values {
					if fl, ok := rhs.(*ast.FuncLit); ok {
						return g.closures[fl]
					}
				}
			}
			if vs, ok := e.Obj.Decl.(*ast.AssignStmt); ok {
				for _, rhs := range vs.Rhs {
					if fl, ok := rhs.(*ast.FuncLit); ok {
						return g.closures[fl]
					}
				}
			}
		}
		return g.funcs[filepath.Dir(p.path)+":"+e.Name]
	case *ast.FuncLit:
		return g.closures[e]
	case *ast.SelectorExpr:
		if id, ok := e.X.(*ast.Ident); ok {
			if dir := g.imports[p.file][id.Name]; dir != "" {
				return g.funcs[dir+":"+e.Sel.Name]
			}
		}
		if dir, typ := g.receiverType(p, e.X); typ != "" {
			for _, fn := range g.methods[e.Sel.Name] {
				if filepath.Dir(fn.file.path) == dir && fn.receiver == typ {
					return fn
				}
			}
		}
	}
	return nil
}

func (g *goFlow) receiverType(p parsedGo, e ast.Expr) (string, string) {
	if id, ok := e.(*ast.Ident); ok && id.Obj != nil {
		switch decl := id.Obj.Decl.(type) {
		case *ast.Field:
			e = decl.Type
		case *ast.ValueSpec:
			e = decl.Type
		case *ast.AssignStmt:
			for i, lhs := range decl.Lhs {
				if lhs == id || (calleeName(lhs) == id.Name && i < len(decl.Rhs)) {
					if i < len(decl.Rhs) {
						e = decl.Rhs[i]
					}
					break
				}
			}
		}
	}
	for {
		switch x := e.(type) {
		case *ast.StarExpr:
			e = x.X
		case *ast.UnaryExpr:
			e = x.X
		case *ast.CompositeLit:
			e = x.Type
		default:
			switch x := e.(type) {
			case *ast.Ident:
				return filepath.Dir(p.path), x.Name
			case *ast.SelectorExpr:
				if id, ok := x.X.(*ast.Ident); ok {
					return g.imports[p.file][id.Name], x.Sel.Name
				}
			}
			return "", ""
		}
	}
}

func (g *goFlow) expr(p parsedGo, e ast.Expr) *flowNode {
	if e == nil {
		return &flowNode{}
	}
	if id, ok := e.(*ast.Ident); ok {
		return g.variable(p, id)
	}
	if hit := g.nodes[e]; hit != nil {
		return hit
	}
	n := &flowNode{owner: g.current}
	g.nodes[e] = n
	add := func(e ast.Expr) { n.deps = append(n.deps, g.expr(p, e)) }
	switch e := e.(type) {
	case *ast.BasicLit:
		if e.Kind == token.STRING {
			if v, err := strconv.Unquote(e.Value); err == nil {
				n.text = &v
			}
		}
	case *ast.ParenExpr:
		add(e.X)
	case *ast.UnaryExpr:
		add(e.X)
	case *ast.StarExpr:
		add(e.X)
	case *ast.SliceExpr:
		add(e.X)
	case *ast.IndexExpr:
		add(e.X)
	case *ast.TypeAssertExpr:
		add(e.X)
	case *ast.SelectorExpr:
		if id, ok := e.X.(*ast.Ident); ok {
			if dir := g.imports[p.file][id.Name]; dir != "" {
				n.deps = append(n.deps, g.global(dir, e.Sel.Name))
				break
			}
		}
		n.selectField = e.Sel.Name
		add(e.X)
	case *ast.BinaryExpr:
		if e.Op == token.ADD {
			n.concat = true
			add(e.X)
			add(e.Y)
		}
	case *ast.CompositeLit:
		n.allocation = true
		// Type-elided []Fact elements still carry a Predicate field.
		fact := calleeName(e.Type) == "Fact"
		for _, el := range e.Elts {
			if kv, ok := el.(*ast.KeyValueExpr); ok && calleeName(kv.Key) == "Predicate" {
				fact = true
			}
		}
		if fact {
			n.lit = e
			break
		}
		n.fields = map[string]*flowNode{}
		for _, el := range e.Elts {
			if kv, ok := el.(*ast.KeyValueExpr); ok {
				_, isMap := e.Type.(*ast.MapType)
				_, isArray := e.Type.(*ast.ArrayType)
				if key, ok := kv.Key.(*ast.Ident); ok && !isMap && !isArray {
					n.fields[key.Name] = g.expr(p, kv.Value)
				} else {
					add(kv.Value)
				}
			} else {
				add(el)
			}
		}
	case *ast.CallExpr:
		name := calleeName(e.Fun)
		if fn := g.resolve(p, e.Fun); fn != nil {
			call := &flowCall{pos: e.Pos(), fn: fn, owner: g.current}
			if fn.receiver != "" {
				if sel, ok := e.Fun.(*ast.SelectorExpr); ok {
					call.args = append(call.args, g.expr(p, sel.X))
				}
			}
			for _, arg := range e.Args {
				call.args = append(call.args, g.expr(p, arg))
			}
			n.call = call
			fn.calls = append(fn.calls, call)
		} else if name == "append" || name == "string" || name == "Join" || name == "NewReader" {
			for _, arg := range e.Args {
				add(arg)
			}
		} else if name == "String" {
			if sel, ok := e.Fun.(*ast.SelectorExpr); ok {
				add(sel.X)
			}
		} else if name == "ReadFile" {
			n.read = true
			if sel, ok := e.Fun.(*ast.SelectorExpr); ok {
				if id, ok := sel.X.(*ast.Ident); !ok || id.Name != "fs" {
					add(sel.X)
				}
			}
			for _, arg := range e.Args {
				add(arg)
			}
		}
	}
	return n
}

func (g *goFlow) result(p parsedGo, e ast.Expr, i int) *flowNode {
	n := g.expr(p, e)
	if n.call != nil {
		c := *n.call
		c.result = i
		return &flowNode{owner: g.current, call: &c}
	}
	if i == 0 {
		return n
	}
	return &flowNode{}
}

func (g *goFlow) wire(p parsedGo, body ast.Node, fn *flowFunc) {
	g.current = fn
	ast.Inspect(body, func(n ast.Node) bool {
		switch n := n.(type) {
		case *ast.FuncLit:
			return false // wired in its own lexical scope
		case *ast.ValueSpec:
			for i, id := range n.Names {
				if i < len(n.Values) {
					g.variable(p, id).deps = append(g.variable(p, id).deps, g.expr(p, n.Values[i]))
				}
			}
		case *ast.AssignStmt:
			for i, lhs := range n.Lhs {
				if calleeName(lhs) == "_" {
					continue
				}
				var rhs *flowNode
				if len(n.Rhs) == len(n.Lhs) {
					rhs = g.expr(p, n.Rhs[i])
				} else if len(n.Rhs) == 1 {
					rhs = g.result(p, n.Rhs[0], i)
				}
				if rhs != nil {
					dst := g.expr(p, lhs)
					if ix, ok := lhs.(*ast.IndexExpr); ok {
						dst = g.expr(p, ix.X)
					}
					if sel, ok := lhs.(*ast.SelectorExpr); ok {
						base := g.expr(p, sel.X)
						if base.fields == nil {
							base.fields = map[string]*flowNode{}
						}
						if base.fields[sel.Sel.Name] == nil {
							base.fields[sel.Sel.Name] = &flowNode{owner: g.current}
						}
						dst = base.fields[sel.Sel.Name]
					}
					dst.deps = append(dst.deps, rhs)
				}
			}
		case *ast.RangeStmt:
			if n.Value != nil {
				dst := g.expr(p, n.Value)
				dst.deps = append(dst.deps, g.expr(p, n.X))
			}
		case *ast.ReturnStmt:
			if fn != nil {
				for i := range fn.results {
					if len(n.Results) == len(fn.results) {
						fn.results[i].deps = append(fn.results[i].deps, g.expr(p, n.Results[i]))
					} else if len(n.Results) == 1 {
						fn.results[i].deps = append(fn.results[i].deps, g.result(p, n.Results[0], i))
					}
				}
			}
		case *ast.CallExpr:
			g.expr(p, n)
			name := calleeName(n.Fun)
			if g.s.prof.hasPrefix(name, g.s.prof.AssertPrefixes) && !g.s.prof.hasPrefix(name, g.s.prof.RetractPrefixes) {
				for _, arg := range n.Args {
					g.sinks = append(g.sinks, g.expr(p, arg))
				}
			}
			if contains(g.s.prof.ProgramLoadMethods, name) {
				pos := g.s.fset.Position(n.Pos())
				id := g.s.rel(p.path) + ":" + strconv.Itoa(pos.Line)
				if g.loads[id] != nil {
					id += ":" + strconv.Itoa(pos.Column)
				}
				load := &flowLoad{fn: fn, pos: n.Pos()}
				if sel, ok := n.Fun.(*ast.SelectorExpr); ok {
					// Imported package functions have no engine receiver.
					isPackage := false
					if id, ok := sel.X.(*ast.Ident); ok && id.Obj == nil {
						_, isPackage = g.imports[p.file][id.Name]
					}
					if !isPackage {
						load.receiver = g.expr(p, sel.X)
					}
				}
				g.loads[id] = load
				for _, arg := range n.Args {
					load.roots = append(load.roots, g.expr(p, arg))
				}
			}
			if name == "Write" || name == "WriteString" {
				if sel, ok := n.Fun.(*ast.SelectorExpr); ok {
					dst := g.expr(p, sel.X)
					for _, arg := range n.Args {
						dst.deps = append(dst.deps, g.expr(p, arg))
					}
				}
			}
		}
		return true
	})
}

// trace uses a per-call frame when walking a return into a callee. A sink
// inside a helper starts without a frame and follows all callers' actual
// arguments. Cycles terminate on (node, field, frame), and a recursive call
// site is visited at most once per path.
func (g *goFlow) trace(root *flowNode, mode string) []*flowNode {
	return g.traceIn(root, mode, nil)
}

func (g *goFlow) traceIn(root *flowNode, mode string, startFrame *flowFrame) []*flowNode {
	type visit struct {
		n     *flowNode
		field string
		frame *flowFrame
	}
	seen := map[visit]bool{}
	var out []*flowNode
	var walk func(*flowNode, string, *flowFrame)
	walk = func(n *flowNode, field string, frame *flowFrame) {
		if n == nil || seen[visit{n, field, frame}] {
			return
		}
		seen[visit{n, field, frame}] = true
		if n.param != nil {
			for f := frame; f != nil; f = f.parent {
				if f.call.fn == n.param.fn {
					if n.param.index < len(f.call.args) {
						walk(f.call.args[n.param.index], field, f.parent)
					}
					return
				}
			}
			if mode == "files" || mode == "params" {
				if mode == "params" {
					out = append(out, n)
				}
				return
			}
			for _, c := range n.param.fn.calls {
				if n.param.index < len(c.args) {
					walk(c.args[n.param.index], field, nil)
				}
			}
		}
		if n.lit != nil {
			if field == "" && mode == "facts" {
				out = append(out, n)
			}
			return
		}
		if n.call != nil {
			for f := frame; f != nil; f = f.parent {
				if f.call.fn == n.call.fn {
					return
				}
			}
			if n.call.result < len(n.call.fn.results) {
				walk(n.call.fn.results[n.call.result], field, &flowFrame{n.call, frame})
			}
		}
		if n.selectField != "" {
			selected := n.selectField
			if field != "" {
				selected += "\x00" + field
			}
			for _, dep := range n.deps {
				walk(dep, selected, frame)
			}
			return
		}
		if field != "" {
			if n.fields != nil {
				head, tail, _ := strings.Cut(field, "\x00")
				walk(n.fields[head], tail, frame)
			}
		} else {
			if mode == "files" && len(n.files) > 0 {
				out = append(out, n)
			}
			if mode == "texts" && n.text != nil {
				out = append(out, n)
			}
			if n.read && mode == "files" {
				// Resolve a read against only the filesystem that reaches it.
				// Evaluate path concatenations in this same call frame.
				if len(n.deps) >= 2 {
					paths := g.texts(n.deps[len(n.deps)-1], frame, map[*flowNode]bool{})
					var candidates []*flowNode
					for _, dep := range n.deps[:len(n.deps)-1] {
						for _, found := range g.traceIn(dep, "files", frame) {
							candidates = append(candidates, found)
						}
					}
					selected := &flowNode{}
					for _, candidate := range candidates {
						for _, path := range paths {
							if !fs.ValidPath(path) {
								continue
							}
							expected := filepath.ToSlash(filepath.Join(candidate.baseDir, path))
							for _, file := range candidate.files {
								if file == expected {
									selected.files = append(selected.files, file)
								}
							}
						}
					}
					out = append(out, selected)
				}
				return
			}
			if n.fields != nil {
				keys := make([]string, 0, len(n.fields))
				for key := range n.fields {
					keys = append(keys, key)
				}
				sort.Strings(keys)
				for _, key := range keys {
					walk(n.fields[key], "", frame)
				}
			}
		}
		for _, dep := range n.deps {
			walk(dep, field, frame)
		}
	}
	walk(root, "", startFrame)
	return out
}

// texts is deliberately limited to static strings (including inventories and
// loop values), concatenation and parameter substitution. It never guesses a
// missing filename from the declarations a fragment happens to need.
func (g *goFlow) texts(n *flowNode, frame *flowFrame, active map[*flowNode]bool) []string {
	if n == nil || active[n] {
		return nil
	}
	active[n] = true
	defer delete(active, n)
	if n.text != nil {
		return []string{*n.text}
	}
	if n.param != nil {
		for f := frame; f != nil; f = f.parent {
			if f.call.fn == n.param.fn && n.param.index < len(f.call.args) {
				return g.texts(f.call.args[n.param.index], f.parent, active)
			}
		}
		return nil // unknown caller: never borrow another call's path
	}
	if n.concat && len(n.deps) == 2 {
		var out []string
		for _, a := range g.texts(n.deps[0], frame, active) {
			for _, b := range g.texts(n.deps[1], frame, active) {
				out = append(out, a+b)
			}
		}
		return out
	}
	var out []string
	for _, dep := range n.deps {
		out = append(out, g.texts(dep, frame, active)...)
	}
	return out
}

// A receiver is an origin value plus a field path and its invocation context.
// Matching only the origin node would merge allocations from different calls
// to the same constructor. Matching only the receiver spelling would merge
// unrelated parameters named "engine".
type flowReceiver struct {
	node    *flowNode
	field   string
	context string
}

func frameContext(frame *flowFrame) string {
	var parts []string
	for f := frame; f != nil; f = f.parent {
		parts = append(parts, strconv.Itoa(int(f.call.pos)))
	}
	return strings.Join(parts, "/")
}

func receiverContext(n *flowNode, frame *flowFrame) string {
	if n.owner == nil {
		return "" // package variables have one identity in every caller
	}
	for f := frame; f != nil; f = f.parent {
		if f.call.fn == n.owner {
			return frameContext(f)
		}
	}
	return ""
}

// receiver follows aliases, return slots and helper parameters, but never
// merges a load if the may-flow graph gives it several possible engines.
// Unknown struct fields retain their own path on the base receiver.
func (g *goFlow) receiver(root *flowNode, start *flowFrame) (flowReceiver, bool) {
	type visit struct {
		node    *flowNode
		field   string
		context string
	}
	seen := map[visit]bool{}
	origins := map[flowReceiver]bool{}
	uncertain := false
	var walk func(*flowNode, string, *flowFrame)
	walk = func(n *flowNode, field string, frame *flowFrame) {
		if n == nil || seen[visit{n, field, frameContext(frame)}] {
			return
		}
		seen[visit{n, field, frameContext(frame)}] = true
		if n.param != nil {
			if len(n.deps) > 0 {
				// Reassigning a formal can change its engine during the
				// function. The union graph cannot establish load order.
				uncertain = true
				return
			}
			for f := frame; f != nil; f = f.parent {
				if f.call.fn == n.param.fn {
					if n.param.index < len(f.call.args) {
						walk(f.call.args[n.param.index], field, f.parent)
					} else {
						uncertain = true
					}
					return
				}
			}
			// No known caller: the parameter itself is the engine origin.
			origins[flowReceiver{n, field, receiverContext(n, frame)}] = true
			return
		}
		if n.call != nil {
			for f := frame; f != nil; f = f.parent {
				if f.call.fn == n.call.fn {
					uncertain = true
					return
				}
			}
			if n.call.result < len(n.call.fn.results) {
				walk(n.call.fn.results[n.call.result], field, &flowFrame{n.call, frame})
			} else {
				uncertain = true
			}
			return
		}
		if n.selectField != "" {
			selected := n.selectField
			if field != "" {
				selected += "\x00" + field
			}
			for _, dep := range n.deps {
				walk(dep, selected, frame)
			}
			return
		}
		if field != "" {
			head, tail, _ := strings.Cut(field, "\x00")
			if selected := n.fields[head]; selected != nil {
				walk(selected, tail, frame)
				return
			}
		}
		if n.allocation {
			// Constructor fields describe contents, not aliases of the
			// allocated engine. Positional literals have deps as well.
			origins[flowReceiver{n, field, receiverContext(n, frame)}] = true
			return
		}
		if len(n.deps) > 0 {
			for _, dep := range n.deps {
				walk(dep, field, frame)
			}
			return
		}
		origins[flowReceiver{n, field, receiverContext(n, frame)}] = true
	}
	walk(root, "", start)
	if !uncertain && len(origins) == 1 {
		for origin := range origins {
			return origin, true
		}
	}
	return flowReceiver{}, false
}

func (g *goFlow) classify() {
	for _, sink := range g.sinks {
		for _, n := range g.trace(sink, "facts") {
			g.s.roles[n.lit] = "/assert"
		}
	}
	type occurrence struct {
		id    string
		load  *flowLoad
		frame *flowFrame
		order []token.Pos
	}
	var occurrences []occurrence
	for id, load := range g.loads {
		frames := []*flowFrame{nil}
		if load.fn != nil {
			// Even static source arguments need caller frames: a helper's
			// receiver parameter can denote a different engine at each call.
			frames = g.callerFrames(load.fn, map[*flowFunc]bool{})
		}
		for _, frame := range frames {
			var order []token.Pos
			for f := frame; f != nil; f = f.parent {
				order = append(order, f.call.pos)
			}
			for i, j := 0, len(order)-1; i < j; i, j = i+1, j-1 {
				order[i], order[j] = order[j], order[i]
			}
			order = append(order, load.pos)
			occurrences = append(occurrences, occurrence{id, load, frame, order})
		}
	}
	// Expand helpers in caller order, so schema-before-policy is preserved
	// even when the helper is declared later or lives in a different file.
	sort.Slice(occurrences, func(i, j int) bool {
		a, b := occurrences[i].order, occurrences[j].order
		for k := 0; k < len(a) && k < len(b); k++ {
			if a[k] != b[k] {
				return a[k] < b[k]
			}
		}
		if len(a) != len(b) {
			return len(a) < len(b)
		}
		return occurrences[i].id < occurrences[j].id
	})
	type program struct {
		id    string
		files []string
		seen  map[string]bool
	}
	var programs []*program
	byReceiver := map[flowReceiver]*program{}
	variants := map[string]int{}
	for _, occ := range occurrences {
		var files []string
		for _, root := range occ.load.roots {
			for _, n := range g.traceIn(root, "files", occ.frame) {
				files = append(files, n.files...)
			}
		}
		if len(files) == 0 {
			continue
		}
		receiver, known := g.receiver(occ.load.receiver, occ.frame)
		var assembled *program
		if known {
			assembled = byReceiver[receiver]
		}
		if assembled == nil {
			key := "load:" + occ.id
			variants[key]++
			if variants[key] > 1 {
				key += ":" + strconv.Itoa(variants[key])
			}
			assembled = &program{id: key, seen: map[string]bool{}}
			programs = append(programs, assembled)
			if known {
				byReceiver[receiver] = assembled
			}
		}
		for _, file := range files {
			if !assembled.seen[file] {
				assembled.seen[file] = true
				assembled.files = append(assembled.files, file)
			}
		}
	}
	for _, assembled := range programs {
		// A receiver's cumulative program can cover an embed group across
		// several loads. Shared sources may still appear on other engines.
		for old, group := range g.s.out.Embeds {
			if strings.HasPrefix(old, "load:") {
				continue
			}
			covered := true
			for _, file := range group {
				if !assembled.seen[file] {
					covered = false
					break
				}
			}
			if covered {
				delete(g.s.out.Embeds, old)
			}
		}
		g.s.out.Embeds[assembled.id] = assembled.files
	}
}

// Keep actual arguments in their invocation context while following loaders
// through helpers. Receiver identity decides which invocations accumulate.
func (g *goFlow) callerFrames(fn *flowFunc, active map[*flowFunc]bool) []*flowFrame {
	if active[fn] {
		return nil
	}
	active[fn] = true
	defer delete(active, fn)
	if len(fn.calls) == 0 {
		return []*flowFrame{nil}
	}
	var out []*flowFrame
	for _, call := range fn.calls {
		parents := []*flowFrame{nil}
		if call.owner != nil {
			parents = g.callerFrames(call.owner, active)
		}
		for _, parent := range parents {
			out = append(out, &flowFrame{call, parent})
		}
	}
	return out
}
