package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"codeberg.org/TauCeti/mangle-go/ast"
	"codeberg.org/TauCeti/mangle-go/parse"
)

// The .mg side of the boundary scan, read with the engine's own parser.

// MgDecl is one explicit Decl.
type MgDecl struct {
	Pred     string
	Arity    int
	File     string
	Line     int
	External bool
	Modes    []string
	// Types holds, per bound alternative, the base type of each position
	// ("/any" when the bound is not a base type).
	Types [][]string
}

// MgUse is a premise that reads a predicate.
type MgUse struct {
	Pred    string
	Arity   int
	File    string
	Line    int
	Negated bool
}

// MgPremise is one atom of a rule body (builtins and comparisons are not atoms
// of the program and are left out). A negated atom never blocks a rule.
type MgPremise struct {
	Pred    string
	Arity   int
	Negated bool
}

// MgRule is one rule or fact with the atoms of its body, in order.
type MgRule struct {
	ID       int
	Pred     string
	Arity    int
	File     string
	Line     int // 0 when the statement could not be located
	Premises []MgPremise
}

// MgFacts is everything the .mg scan found.
type MgFacts struct {
	Decls   []MgDecl
	Rules   []MgRule
	Defines map[string]bool // "pred/arity" defined by a rule or fact
	Uses    []MgUse
	// Files are the .mg files read; ParseErrors those the engine rejected.
	Files       []string
	ParseErrors map[string]string
}

func key(p string, a int) string { return fmt.Sprintf("%s/%d", p, a) }

var baseTypes = map[string]bool{"/name": true, "/string": true, "/number": true, "/float64": true,
	"/time": true, "/duration": true, "/bytes": true, "/any": true}

// ScanMg reads every .mg file under root (same directory rules as Go).
func ScanMg(root string) (*MgFacts, error) {
	out := &MgFacts{Defines: map[string]bool{}, ParseErrors: map[string]string{}}
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
		if !strings.HasSuffix(path, ".mg") {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		rel = filepath.ToSlash(rel)
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		out.Files = append(out.Files, rel)
		unit, perr := parse.Unit(strings.NewReader(string(data)))
		if perr != nil {
			out.ParseErrors[rel] = perr.Error()
			return nil
		}
		out.add(rel, string(data), unit)
		return nil
	})
	sort.Strings(out.Files)
	return out, err
}

// lineOf finds the 1-based line of the first match of re in text (0 if none).
func lineOf(text string, re *regexp.Regexp) int {
	loc := re.FindStringIndex(text)
	if loc == nil {
		return 0
	}
	return strings.Count(text[:loc[0]], "\n") + 1
}

func (m *MgFacts) add(file, text string, unit parse.SourceUnit) {
	for _, d := range unit.Decls {
		name := d.DeclaredAtom.Predicate.Symbol
		if strings.HasPrefix(name, "Package") || strings.HasPrefix(name, "Use") {
			continue
		}
		decl := MgDecl{Pred: name, Arity: d.DeclaredAtom.Predicate.Arity, File: file, External: d.IsExternal(),
			Line: lineOf(text, regexp.MustCompile(`(?m)^\s*Decl\s+`+regexp.QuoteMeta(name)+`\s*\(`))}
		for _, mode := range d.Modes() {
			var b strings.Builder
			for _, am := range mode {
				switch am {
				case ast.ArgModeInput:
					b.WriteByte('+')
				case ast.ArgModeOutput:
					b.WriteByte('-')
				default:
					b.WriteByte('?')
				}
			}
			decl.Modes = append(decl.Modes, b.String())
		}
		for _, bd := range d.Bounds {
			types := make([]string, len(bd.Bounds))
			for i, b := range bd.Bounds {
				types[i] = "/any"
				if c, ok := b.(ast.Constant); ok && c.Type == ast.NameType && baseTypes[c.Symbol] {
					types[i] = c.Symbol
				}
			}
			decl.Types = append(decl.Types, types)
		}
		m.Decls = append(m.Decls, decl)
	}
	negLines := map[string]int{}
	lines := clauseLines(text)
	if len(lines) != len(unit.Clauses) {
		lines = nil
	}
	for i, c := range unit.Clauses {
		m.Defines[key(c.Head.Predicate.Symbol, c.Head.Predicate.Arity)] = true
		rule := MgRule{ID: len(m.Rules) + 1, Pred: c.Head.Predicate.Symbol, Arity: c.Head.Predicate.Arity, File: file}
		if lines != nil {
			rule.Line = lines[i]
		}
		for _, p := range c.Premises {
			atom, neg, ok := premiseAtom(p)
			if !ok || atom.Predicate.IsBuiltin() {
				continue
			}
			rule.Premises = append(rule.Premises, MgPremise{Pred: atom.Predicate.Symbol, Arity: atom.Predicate.Arity, Negated: neg})
			use := MgUse{Pred: atom.Predicate.Symbol, Arity: atom.Predicate.Arity, File: file, Negated: neg}
			if neg {
				k := key(use.Pred, use.Arity)
				if _, seen := negLines[k]; !seen {
					negLines[k] = lineOf(text, regexp.MustCompile(`!\s*`+regexp.QuoteMeta(use.Pred)+`\s*\(`))
				}
				use.Line = negLines[k]
			}
			m.Uses = append(m.Uses, use)
		}
		m.Rules = append(m.Rules, rule)
	}
}

// clauseLines returns the 1-based line each rule or fact starts on, in source
// order. The parser keeps no positions, so statements are split here: one ends
// at a '.' followed by whitespace, '#' or the end of the text, outside strings
// and comments (a name may contain '.', which is why the next character
// decides). Decl, Package and Use statements are skipped.
func clauseLines(text string) []int {
	var out []int
	line, start, startLine := 1, -1, 0
	flush := func(end int) {
		if start < 0 {
			return
		}
		head := strings.TrimLeft(text[start:end], " \t")
		if !strings.HasPrefix(head, "Decl ") && !strings.HasPrefix(head, "Decl\t") &&
			!strings.HasPrefix(head, "Package ") && !strings.HasPrefix(head, "Use ") {
			out = append(out, startLine)
		}
		start = -1
	}
	for i := 0; i < len(text); i++ {
		c := text[i]
		if c == '\n' {
			line++
			continue
		}
		if start < 0 && c != ' ' && c != '\t' && c != '\r' && c != '#' {
			start, startLine = i, line
		}
		switch c {
		case '#':
			for i < len(text) && text[i] != '\n' {
				i++
			}
			i--
		case '"', '\'', '`':
			for i++; i < len(text) && text[i] != c; i++ {
				if text[i] == '\n' {
					line++
				}
				if text[i] == '\\' && c != '`' {
					i++
				}
			}
		case '.':
			if i+1 >= len(text) || text[i+1] == ' ' || text[i+1] == '\t' || text[i+1] == '\r' || text[i+1] == '\n' || text[i+1] == '#' {
				flush(i)
			}
		}
	}
	return out
}

func premiseAtom(t ast.Term) (ast.Atom, bool, bool) {
	switch p := t.(type) {
	case ast.Atom:
		return p, false, true
	case ast.NegAtom:
		return p.Atom, true, true
	case ast.TemporalLiteral:
		a, neg, ok := premiseAtom(p.Literal)
		return a, neg, ok
	}
	return ast.Atom{}, false, false
}
