package main

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"
)

// A small Go module whose .mg and Go sides disagree in every way the
// boundary rules judge, next to near misses that must stay quiet.
var fixture = map[string]string{
	"go.mod": "module example.com/fixture\n\ngo 1.22\n",
	"core/types.go": `package core

type Fact struct {
	Predicate string
	Args      []any
}

type MangleAtom string
`,
	"core/schema.mg": `
Decl user(Id, Role) bound [/string, /name].
Decl score(Id, S) bound [/string, /number].
Decl note(Id, Text) bound [/string, /string].
Decl ghost(Id) bound [/string].
Decl lonely(Id) bound [/string].
Decl written(Id) bound [/string].
Decl lookup(Q, R) descr [external(), mode('+', '-')] bound [/string, /string].
Decl probe(Q, R) descr [external(), mode('+', '-')] bound [/string, /string].
Decl unwired(Q, R) descr [external(), mode('+', '-')] bound [/string, /string].
Decl listed(Id) bound [/string].
admin(U) :- user(U, /admin).
haunted(I) :- ghost(I), !lookup(I, "x").
hit(I) :- user(I, _), lookup(I, R), R = "ok".
seen(I) :- listed(I).
fast(I) :- score(I, S), S > 3.
noted(I) :- note(I, _).
chain_a(I) :- ghost(I).
chain_b(I) :- chain_a(I), score(I, _).
guarded(I) :- user(I, _), haunted(I).
alive(I) :- score(I, _), !ghost(I).
helper(I) :- user(I, _).
hidden(I) :- ghost(I).
shown(I) :- helper(I), !hidden(I).
`,
	"core/producer.go": `package core

var names = []string{"listed"}

func produce(id string, role string, f float64) []Fact {
	return []Fact{
		{Predicate: "user", Args: []any{id, MangleAtom("/admin")}},
		{Predicate: "user", Args: []any{id, "admin"}},
		{Predicate: "score", Args: []any{id, f}},
		{Predicate: "score", Args: []any{id, 3}},
		{Predicate: "note", Args: []any{id, "/not_a_string"}},
		{Predicate: "note", Args: []any{id, role}},
		{Predicate: "undeclared_thing", Args: []any{id}},
		{Predicate: "written", Args: []any{id}},
	}
}

func assertAll(k interface{ Assert(Fact) error; AssertBatch([]Fact) error }, id string) {
	_ = k.AssertBatch(produce(id, "admin", 1.5))
	_ = k.Assert(Fact{Predicate: "user", Args: []any{id, MangleAtom("/dev"), 1}})
}

type ArgMode int

const (
	ArgModeInput ArgMode = iota
	ArgModeOutput
)

func register(mk func(string, int, func(), ...ArgMode)) {
	in, out := ArgModeInput, ArgModeOutput
	mk("lookup", 2, nil, in, out)
	mk("probe", 2, nil, out, out)
	mk("stray", 1, nil, in)
}

func consume(q interface{ Query(string) ([]Fact, error) }) {
	_, _ = q.Query("admin")
	_, _ = q.Query("nonexistent_pred")
	_, _ = q.Query("shown")
	_, _ = q.Query("alive")
}
`,
}

var testTime = time.Unix(0, 0)

func writeFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	for rel, text := range fixture {
		path := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(text), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func findingsBy(rep BoundaryReport) map[string][]Finding {
	out := map[string][]Finding{}
	for _, f := range rep.Findings {
		out[f.Code] = append(out[f.Code], f)
	}
	return out
}

func preds(fs []Finding) []string {
	var out []string
	for _, f := range fs {
		out = append(out, f.Predicate)
	}
	sort.Strings(out)
	return out
}

func codenerdProfile(t *testing.T) *Profile {
	t.Helper()
	p, err := BuiltinProfile("codenerd")
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestBoundaryFindings(t *testing.T) {
	rep, err := Boundary(writeFixture(t), codenerdProfile(t))
	if err != nil {
		t.Fatal(err)
	}
	by := findingsBy(rep)
	want := map[string][]string{
		"B001": {"ghost"},            // read by a rule, produced by nothing, never mentioned in Go
		"B002": {"lonely"},           // declared, produced and read by nothing
		"B003": {"undeclared_thing"}, // Go asserts, no Decl
		"B004": {"user"},             // Go asserts user/3 in an Assert call; the Decl is user/2
		"B005": {"nonexistent_pred"}, // Go queries something undefined
		"B006": {"written"},          // asserted, never read
		"B008": {"unwired"},          // external Decl, no callback
		"B009": {"stray"},            // callback, no external Decl
		"B010": {"probe"},            // callback modes -- vs Decl +-
		"B011": {"lookup"},           // a rule negates an external
		"B012": {"listed"},           // read; Go only lists the name
		// A rule that can never fire: a positive premise is starved, directly
		// (ghost) or through a rule that is itself blocked (chain_a, haunted).
		// Near misses: seen (its premise is listed in Go), alive (it only
		// negates the starved ghost), shown (a negated premise never blocks).
		"B013": {"chain_a", "chain_b", "guarded", "haunted", "hidden"},
		// Derived by a rule, read by no rule that leads to a Go query. Near
		// misses: admin, shown and alive (queried), helper (read by shown),
		// hidden (read by shown through a negation).
		"B014": {"chain_a", "chain_b", "fast", "guarded", "haunted", "hit", "noted", "seen"},
	}
	for code, ps := range want {
		if got := preds(by[code]); strings.Join(got, ",") != strings.Join(ps, ",") {
			t.Errorf("%s: got %v, want %v", code, got, ps)
		}
	}
	// B007: a float for /number, a string literal for /name, a "/x" literal
	// (a name under the kernel's conversion) for /string. Near misses: an int
	// for /number, MangleAtom for /name, a string variable for /string.
	var shapes []string
	for _, f := range by["B007"] {
		shapes = append(shapes, f.Predicate+":"+f.Note)
	}
	sort.Strings(shapes)
	if got := strings.Join(shapes, ","); got != "note:/lit_name,score:/float64,user:/lit_string" {
		t.Errorf("B007: got %s", got)
	}
	// Every finding carries the proof it rests on, including absences.
	for _, f := range by["B001"] {
		if !strings.Contains(strings.Join(f.Proof, " "), "not produced(") {
			t.Errorf("B001 proof lacks the absence of a producer: %v", f.Proof)
		}
	}
	// B013 names the blocking premise, and the proof rests on its absence from
	// the live set; the block travels through a derived predicate.
	for _, f := range by["B013"] {
		if f.Predicate == "chain_b" && f.Note != "chain_a/1" {
			t.Errorf("B013 chain_b blocked by %q, want chain_a/1", f.Note)
		}
		if f.Predicate == "chain_a" && f.Note != "ghost/1" {
			t.Errorf("B013 chain_a blocked by %q, want ghost/1", f.Note)
		}
		if !strings.Contains(strings.Join(f.Proof, " "), "not live(") {
			t.Errorf("B013 %s proof lacks the absence of a producer: %v", f.Predicate, f.Proof)
		}
		if f.At.File != "core/schema.mg" || f.At.Line == 0 {
			t.Errorf("B013 %s is not anchored at its rule: %+v", f.Predicate, f.At)
		}
	}
	for _, f := range by["B014"] {
		if !strings.Contains(strings.Join(f.Proof, " "), "not needed(") {
			t.Errorf("B014 %s proof lacks the absence of a consumer: %v", f.Predicate, f.Proof)
		}
	}
	// The B011 finding names the Go callback that never runs.
	if l := by["B011"]; len(l) != 1 || len(l[0].Related) != 1 || l[0].Related[0].File != "core/producer.go" {
		t.Errorf("B011 related: %+v", l)
	}
}

// The generic profile knows nothing of the host's string conversion or its
// MangleAtom type: only the float into /number is still provable.
func TestBoundaryGenericProfile(t *testing.T) {
	generic, err := BuiltinProfile("generic")
	if err != nil {
		t.Fatal(err)
	}
	rep, err := Boundary(writeFixture(t), generic)
	if err != nil {
		t.Fatal(err)
	}
	var shapes []string
	for _, f := range findingsBy(rep)["B007"] {
		shapes = append(shapes, f.Predicate+":"+f.Note)
	}
	if got := strings.Join(shapes, ","); got != "score:/float64" {
		t.Errorf("B007 under the generic profile: got %s", got)
	}
}

// An external registered the mangle-go way: a PredicateSym key in a map of
// engine.ExternalPredicateCallback.
func TestBoundaryEngineAPIExternal(t *testing.T) {
	root := t.TempDir()
	files := map[string]string{
		"go.mod":   "module example.com/x\n\ngo 1.22\n",
		"rules.mg": "Decl ext(X, Y) descr [external(), mode('+', '-')].\nDecl gone(X) descr [external(), mode('+')].\nitem(1).\nq(X) :- item(X), ext(X, _).\nr(X) :- item(X), gone(X).\n",
		"host.go": `package x

import (
	"codeberg.org/TauCeti/mangle-go/ast"
	"codeberg.org/TauCeti/mangle-go/engine"
)

func externals(cb engine.ExternalPredicateCallback) map[ast.PredicateSym]engine.ExternalPredicateCallback {
	return map[ast.PredicateSym]engine.ExternalPredicateCallback{
		{Symbol: "ext", Arity: 2}: cb,
		ast.PredicateSym{Symbol: "orphan", Arity: 1}: cb,
	}
}
`,
	}
	for rel, text := range files {
		if err := os.WriteFile(filepath.Join(root, rel), []byte(text), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	generic, _ := BuiltinProfile("generic")
	rep, err := Boundary(root, generic)
	if err != nil {
		t.Fatal(err)
	}
	by := findingsBy(rep)
	if got := preds(by["B008"]); strings.Join(got, ",") != "gone" {
		t.Errorf("B008: %v", got)
	}
	if got := preds(by["B009"]); strings.Join(got, ",") != "orphan" {
		t.Errorf("B009: %v", got)
	}
	if len(by["B010"]) != 0 {
		t.Errorf("B010 without stated modes: %v", by["B010"])
	}
}

func TestSelectProfile(t *testing.T) {
	root := t.TempDir()
	_ = os.WriteFile(filepath.Join(root, "go.mod"), []byte("module codenerd\n"), 0o644)
	if p, _ := SelectProfile(root, ""); p.Name != "codenerd" {
		t.Errorf("by go.mod: %s", p.Name)
	}
	_ = os.WriteFile(filepath.Join(root, "go.mod"), []byte("module example.com/other\n"), 0o644)
	if p, _ := SelectProfile(root, ""); p.Name != "generic" {
		t.Errorf("fallback: %s", p.Name)
	}
	_ = os.MkdirAll(filepath.Join(root, ".mangle"), 0o755)
	_ = os.WriteFile(filepath.Join(root, ".mangle", "oracle-profile.json"), []byte(`{"name": "local"}`), 0o644)
	if p, _ := SelectProfile(root, ""); p.Name != "local" {
		t.Errorf("project file: %s", p.Name)
	}
}

func TestBoundaryProgramIsStrictlyTyped(t *testing.T) {
	unit, err := parseUnit(boundaryProgram)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := analyze(unit, true); err != nil {
		t.Fatalf("boundary.mg must pass strict bounds checking: %v", err)
	}
}

func TestWhyNotFunnel(t *testing.T) {
	src := Source{Text: `
Decl user(U, Role) bound [/name, /name].
Decl banned(U) bound [/name].
Decl audit_ok(U) bound [/name].
user(/alice, /admin). user(/bob, /dev).
banned(/alice).
grant(U) :- user(U, R), R = /admin, !banned(U).
grant(U) :- user(U, /admin), audit_ok(U).
`}
	res, err := WhyNot(src, "grant(U)", testTime)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Holds) != 0 || len(res.Rules) != 2 {
		t.Fatalf("got %+v", res)
	}
	first := res.Rules[0]
	if first.BlockedAt != 2 || first.Funnel[0].Rows != 2 || first.Funnel[1].Rows != 1 || first.Funnel[2].Rows != 0 {
		t.Errorf("first rule funnel: %+v", first)
	}
	if second := res.Rules[1]; second.BlockedAt != 1 || !strings.Contains(second.Reason, "no facts and no rules") {
		t.Errorf("second rule: %+v", second)
	}
	// Near miss: a goal that holds reports its facts and no block.
	ok, err := WhyNot(src, "user(/bob, R)", testTime)
	if err != nil || len(ok.Holds) != 1 || ok.Kind != "extensional" {
		t.Errorf("user(/bob, R): %+v %v", ok, err)
	}
}

func TestVerdictStages(t *testing.T) {
	cases := map[string]string{
		"p(1). r(2, 3).\nq(X) :- p(X), !r(X, _).\n":                  StageAnalyze,
		"p(1, /x).\nq(X) :- R != /y, p(X, R).\n":                     StageOK,
		"Decl ok().\nok().\n":                                        StageBounds,
		"Decl ok() bound [].\nok().\n":                               StageOK,
		"hay(\"x\").\nhit(H) :- hay(H), :string:contains(H, /ab).\n": StageEval,
		"p(/a).\nq(X) :- p(X), X = /a.\nr(1).\n":                     StageParse,
		"n(\"abc\").\nok(N) :- n(N), :string:matches(N, \"^a\").\n":  StageBounds,
	}
	for text, want := range cases {
		if v := Judge(Source{Text: text}, testTime); v.Stage != want {
			t.Errorf("%q: stage %s (%s), want %s", text, v.Stage, v.Error, want)
		}
	}
}
