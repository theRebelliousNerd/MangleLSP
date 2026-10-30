package main

import (
	_ "embed"
	"fmt"
	"sort"
	"strings"
	"time"

	"codeberg.org/TauCeti/mangle-go/analysis"
	"codeberg.org/TauCeti/mangle-go/ast"
	"codeberg.org/TauCeti/mangle-go/engine"
	"codeberg.org/TauCeti/mangle-go/factstore"
	"codeberg.org/TauCeti/mangle-go/parse"
	"codeberg.org/TauCeti/mangle-go/provenance"
)

//go:embed boundary.mg
var boundaryProgram string

// Location is a place in the module.
type Location struct {
	File string `json:"file"`
	Line int    `json:"line"`
}

// Finding is one judgment about the boundary.
type Finding struct {
	Code      string     `json:"code"`
	Predicate string     `json:"predicate"`
	Arity     int        `json:"arity"`
	At        Location   `json:"at"`
	Position  int        `json:"position,omitempty"` // 1-based argument, B007
	Note      string     `json:"note,omitempty"`
	Decl      *Location  `json:"decl,omitempty"`
	Declared  []string   `json:"declared,omitempty"` // B007: declared types at Position
	Related   []Location `json:"related,omitempty"`  // e.g. the Go callback a negation never calls
	Proof     []string   `json:"proof"`
}

// ProgramReport is the engine's verdict on one discovered host program.
type ProgramReport struct {
	ID      string   `json:"id"`
	Files   []string `json:"files"`
	Verdict Verdict  `json:"verdict"`
}

// BoundaryReport is the whole scan.
type BoundaryReport struct {
	Engine      string            `json:"engine"`
	Profile     string            `json:"profile"`
	Root        string            `json:"root"`
	GoFiles     int               `json:"goFiles"`
	MgFiles     int               `json:"mgFiles"`
	Asserts     int               `json:"assertSites"`
	Queries     int               `json:"querySites"`
	Externals   int               `json:"externalCallbacks"`
	ParseErrors map[string]string `json:"parseErrors"`
	Programs    []ProgramReport   `json:"programs"`
	Findings    []Finding         `json:"findings"`
}

type edb struct {
	store factstore.FactStore
}

func (e edb) add(pred string, args ...ast.BaseTerm) {
	e.store.Add(ast.Atom{Predicate: ast.PredicateSym{Symbol: pred, Arity: len(args)}, Args: args})
}

func str(s string) ast.BaseTerm  { return ast.String(s) }
func num(n int) ast.BaseTerm     { return ast.Number(int64(n)) }
func name(s string) ast.BaseTerm { c, _ := ast.Name(s); return c }

// Boundary scans root and judges its Go <-> .mg boundary, reading the Go
// side with the host profile (see profile.go).
func Boundary(root string, prof *Profile) (BoundaryReport, error) {
	mf, err := ScanMg(root)
	if err != nil {
		return BoundaryReport{}, err
	}
	known := map[string]bool{}
	for _, d := range mf.Decls {
		known[d.Pred] = true
	}
	for k := range mf.Defines {
		p, _ := splitKey(k)
		known[p] = true
	}
	gf, err := ScanGo(root, known, prof)
	if err != nil {
		return BoundaryReport{}, err
	}
	rep := BoundaryReport{Engine: EngineVersion(), Profile: prof.Name, Root: root, GoFiles: gf.Files, MgFiles: len(mf.Files),
		Asserts: len(gf.Asserts), Queries: len(gf.Queries), Externals: len(gf.Externals),
		ParseErrors: mf.ParseErrors, Findings: []Finding{}, Programs: []ProgramReport{}}

	findings, err := judge(gf, mf)
	if err != nil {
		return rep, err
	}
	rep.Findings = findings
	rep.Programs = judgePrograms(root, gf.Embeds)
	return rep, nil
}

func judge(gf *GoFacts, mf *MgFacts) ([]Finding, error) {
	unit, err := parseUnit(boundaryProgram)
	if err != nil {
		return nil, fmt.Errorf("boundary.mg: %w", err)
	}
	info, err := analysis.AnalyzeAndCheckBounds([]parse.SourceUnit{unit}, nil, analysis.ErrorForBoundsMismatch)
	if err != nil {
		return nil, fmt.Errorf("boundary.mg: %w", err)
	}
	// Indexed: the liveness rules join on rule id and premise index, and the
	// plain store scans every row of a relation per lookup.
	store := factstore.NewMultiIndexedArrayInMemoryStore()
	e := edb{store}
	declAt := map[string]Location{}
	declTypes := map[string][][]string{}
	for _, d := range mf.Decls {
		k := key(d.Pred, d.Arity)
		if _, dup := declAt[k]; !dup {
			declAt[k] = Location{d.File, d.Line}
		}
		declTypes[k] = append(declTypes[k], d.Types...)
		e.add("decl", str(d.Pred), num(d.Arity), str(d.File), num(d.Line))
		for alt, types := range d.Types {
			for pos, t := range types {
				e.add("decl_type", str(d.Pred), num(d.Arity), num(pos), num(alt), name(t))
			}
		}
		if d.External {
			modes := ""
			if len(d.Modes) > 0 {
				modes = d.Modes[0]
			}
			e.add("decl_external", str(d.Pred), num(d.Arity), str(modes))
		}
	}
	for k := range mf.Defines {
		p, a := splitKey(k)
		e.add("mg_defines", str(p), num(a))
	}
	for _, r := range mf.Rules {
		e.add("mg_rule", num(r.ID), str(r.Pred), num(r.Arity), str(r.File), num(r.Line), num(len(r.Premises)))
		if len(r.Premises) > 0 {
			e.add("mg_derivation", num(r.ID), str(r.Pred), num(r.Arity), str(r.File), num(r.Line))
		}
		for i, p := range r.Premises {
			sign := "/pos"
			if p.Negated {
				sign = "/neg"
			}
			e.add("mg_premise", num(r.ID), num(i), str(p.Pred), num(p.Arity), name(sign))
		}
	}
	for _, u := range mf.Uses {
		if u.Negated {
			e.add("mg_negates", str(u.Pred), num(u.Arity), str(u.File), num(u.Line))
		} else {
			e.add("mg_uses", str(u.Pred), num(u.Arity), str(u.File))
		}
	}
	for _, s := range gf.Asserts {
		e.add("go_assert", num(s.ID), str(s.Predicate), num(s.Arity), str(s.File), num(s.Line))
		e.add("site_role", num(s.ID), name(s.Role))
		e.add("site_regime", num(s.ID), name(s.Regime))
		for pos, k := range s.ArgKinds {
			if k != "" {
				e.add("go_arg", num(s.ID), num(pos), name(k))
			}
		}
	}
	mentions := map[string][]Location{}
	for _, m := range gf.Mentions {
		e.add("go_mention", str(m.Predicate), str(m.File), num(m.Line))
		mentions[m.Predicate] = append(mentions[m.Predicate], Location{m.File, m.Line})
	}
	for _, q := range gf.Queries {
		e.add("go_query", str(q.Predicate), num(q.Arity), str(q.File), num(q.Line))
	}
	callbacks := map[string][]Location{}
	for _, x := range gf.Externals {
		e.add("go_external", str(x.Predicate), num(x.Arity), str(x.Modes), str(x.File), num(x.Line))
		k := key(x.Predicate, x.Arity)
		callbacks[k] = append(callbacks[k], Location{x.File, x.Line})
	}

	if err := engine.EvalProgram(info, store, engine.WithEvaluationTime(time.Unix(0, 0))); err != nil {
		return nil, fmt.Errorf("boundary.mg evaluation: %w", err)
	}
	var out []Finding
	err = store.GetFacts(ast.NewQuery(ast.PredicateSym{Symbol: "finding", Arity: 7}), func(a ast.Atom) error {
		c := func(i int) ast.Constant { return a.Args[i].(ast.Constant) }
		n := func(i int) int { v, _ := c(i).NumberValue(); return int(v) }
		s := func(i int) string { v, _ := c(i).StringValue(); return v }
		f := Finding{Code: strings.TrimPrefix(c(0).Symbol, "/"), Predicate: s(1), Arity: n(2),
			At: Location{s(3), n(4)}, Note: s(6)}
		k := key(f.Predicate, f.Arity)
		if pos := n(5); pos >= 0 {
			f.Position = pos + 1
			for _, alt := range declTypes[k] {
				if pos < len(alt) {
					f.Declared = append(f.Declared, alt[pos])
				}
			}
		}
		if loc, ok := declAt[k]; ok && loc != f.At {
			f.Decl = &loc
		}
		switch f.Code {
		case "B011":
			f.Related = callbacks[k]
		case "B012":
			f.Related = mentions[f.Predicate]
		}
		f.Proof = proofOf(info, store, a)
		out = append(out, f)
		return nil
	})
	sort.Slice(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.Code != b.Code {
			return a.Code < b.Code
		}
		if a.At.File != b.At.File {
			return a.At.File < b.At.File
		}
		return a.At.Line < b.At.Line
	})
	return out, err
}

// proofOf flattens the proof of a finding into the facts it rests on.
func proofOf(info *analysis.ProgramInfo, store factstore.FactStore, goal ast.Atom) []string {
	proofs, err := provenance.Explain(info, store, goal, provenance.Options{MaxProofs: 1, MaxDepth: 8})
	if err != nil || len(proofs) == 0 {
		return []string{}
	}
	seen := map[string]bool{}
	var leaves []string
	var walk func(n *provenance.ProofNode)
	walk = func(n *provenance.ProofNode) {
		switch n.Kind {
		case provenance.KindEDB:
			leaves = append(leaves, n.Fact.String())
		case provenance.KindAbsence:
			leaves = append(leaves, "not "+n.Fact.String())
		}
		for _, p := range n.Premises {
			if !seen[p.ID] {
				seen[p.ID] = true
				walk(p)
			}
		}
	}
	walk(proofs[0])
	return leaves
}

func splitKey(k string) (string, int) {
	i := strings.LastIndexByte(k, '/')
	var a int
	fmt.Sscanf(k[i+1:], "%d", &a)
	return k[:i], a
}

func judgePrograms(root string, embeds map[string][]string) []ProgramReport {
	ids := make([]string, 0, len(embeds))
	for id := range embeds {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	out := []ProgramReport{}
	for _, id := range ids {
		files := append([]string(nil), embeds[id]...)
		if !strings.HasPrefix(id, "load:") {
			sort.Strings(files)
		}
		abs := make([]string, len(files))
		for i, f := range files {
			abs[i] = root + "/" + f
		}
		src, err := LoadSource(abs)
		if err != nil {
			continue
		}
		v := Judge(src, time.Unix(0, 0))
		v.Files = files
		out = append(out, ProgramReport{ID: id, Files: files, Verdict: v})
	}
	return out
}
