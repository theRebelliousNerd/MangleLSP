package main

import (
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
)

func writeGoFlowFixture(t *testing.T, files map[string]string) string {
	t.Helper()
	root := t.TempDir()
	for rel, text := range files {
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

// Before the flow scan, every literal here counted as an assertion, and
// append alone upgraded a retrieval fixture to /assert. These small shapes
// model routing, retrieval and real producers without importing a host.
func TestFactMustReachAssertion(t *testing.T) {
	root := writeGoFlowFixture(t, map[string]string{
		"go.mod": "module example.test/flow\n\ngo 1.22\n",
		"core/host.go": `package core

type Fact struct { Predicate string; Args []any }
type Kernel interface { Assert(Fact); AssertBatch([]Fact); Retract(Fact) }
func RouteAction(f Fact) { _ = f.Args }
func RouteActionResult(f Fact) { RouteAction(f) }
func routePermittedAction(k Kernel, f Fact) {
	k.Assert(Fact{Predicate: "pending_action", Args: []any{f.Args[0], f.Args[1]}})
	RouteActionResult(f)
}
func envelope() Fact { return Fact{Predicate: "next_action", Args: []any{1, 2, 3}} }
func visualize() []Fact {
	var retrieved []Fact
	retrieved = append(retrieved, Fact{Predicate: "conversation_turn", Args: []any{1, 2, 3}})
	return retrieved
}
func identity(f Fact) Fact { return f }
func makeAsserted() Fact { return Fact{Predicate: "returned", Args: []any{1, 2}} }
func publish(k Kernel, f Fact) { k.Assert(f) }
func pair() (Fact, Fact) {
	return Fact{Predicate: "first_result", Args: []any{1, 2}}, Fact{Predicate: "second_result", Args: []any{1, 2}}
}
func run(k Kernel, flag bool) {
	routePermittedAction(k, Fact{Predicate: "next_action", Args: []any{1, 2, 3, 4}})
	f := Fact{Predicate: "next_action", Args: []any{1, 2, 3}}
	RouteAction(f)
	RouteActionResult(envelope())
	_ = visualize()
	RouteAction(identity(Fact{Predicate: "identity_route", Args: []any{1, 2, 3}}))
	k.Assert(identity(Fact{Predicate: "identity_assert", Args: []any{1, 2}}))
	k.Assert(Fact{Predicate: "direct", Args: []any{1, 2}})
	local := Fact{Predicate: "alias", Args: []any{1, 2}}
	alias := local
	k.Assert(alias)
	var batch []Fact
	batch = append(batch, Fact{Predicate: "batch", Args: []any{1, 2}})
	k.AssertBatch(batch)
	k.Assert(makeAsserted())
	publish(k, Fact{Predicate: "wrapped", Args: []any{1, 2}})
	both := Fact{Predicate: "both", Args: []any{1, 2}}
	RouteAction(both)
	k.Assert(both)
	k.Retract(Fact{Predicate: "retracted", Args: []any{1, 2, 3}})
	first, second := pair()
	RouteAction(first)
	k.Assert(second)
	shadow := Fact{Predicate: "shadow_route", Args: []any{1, 2, 3}}
	if flag {
		shadow := Fact{Predicate: "shadow_assert", Args: []any{1, 2}}
		k.Assert(shadow)
	}
	RouteAction(shadow)
	var branch Fact
	if flag { branch = Fact{Predicate: "branch_a", Args: []any{1, 2}} } else { branch = Fact{Predicate: "branch_b", Args: []any{1, 2}} }
	k.Assert(branch)
	var fields struct { Facts []Fact; Envelope Fact }
	fields.Facts = []Fact{{Predicate: "field_assert", Args: []any{1, 2}}}
	fields.Envelope = Fact{Predicate: "field_route", Args: []any{1, 2, 3}}
	k.AssertBatch(fields.Facts)
	RouteAction(fields.Envelope)
}
`,
	})
	gf, err := ScanGo(root, map[string]bool{}, codenerdProfile(t))
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, site := range gf.Asserts {
		got = append(got, site.Predicate)
		if site.Role != "/assert" {
			t.Errorf("unproven Fact assertion: %+v", site)
		}
	}
	sort.Strings(got)
	want := []string{"alias", "batch", "both", "branch_a", "branch_b", "direct", "field_assert", "identity_assert", "pending_action", "returned", "second_result", "shadow_assert", "wrapped"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("assertions = %v, want %v", got, want)
	}
	// The judgment still catches all proven bad arities, including returns,
	// batches and aliases; this is not a B004 suppression by predicate name.
	mf := &MgFacts{}
	for _, pred := range want {
		mf.Decls = append(mf.Decls, MgDecl{Pred: pred, Arity: 1, File: "schema.mg", Line: 1})
	}
	mf.Decls = append(mf.Decls, MgDecl{Pred: "next_action", Arity: 1}, MgDecl{Pred: "conversation_turn", Arity: 4})
	findings, err := judge(gf, mf)
	if err != nil {
		t.Fatal(err)
	}
	var bad []string
	for _, f := range findings {
		if f.Code == "B004" {
			bad = append(bad, f.Predicate)
		}
	}
	sort.Strings(bad)
	if !reflect.DeepEqual(bad, want) {
		t.Fatalf("B004 = %v, want %v", bad, want)
	}
}

func assemblyFixture() map[string]string {
	return map[string]string{
		"go.mod": "module example.test/assembly\n\ngo 1.22\n",
		"core/source.go": `package core
import ("embed"; "io/fs"; "strings")
//go:embed defaults/*.mg defaults/policy/*.mg
var corpus embed.FS
var schemaNames = []string{"extra.mg"}
func sourceFS() fs.FS { return corpus }
func readRequired(fsys fs.FS, path string) ([]byte, error) { return fs.ReadFile(fsys, path) }
func GetDefaultContent(path string) (string, error) {
	data, err := readRequired(sourceFS(), "defaults/" + path)
	return string(data), err
}
func DefaultCorpusText() (schemas string, policy string, err error) {
	var sb, pb strings.Builder
	data, err := readRequired(sourceFS(), "defaults/schemas.mg")
	sb.Write(data)
	for _, name := range schemaNames {
		data, err := readRequired(sourceFS(), "defaults/" + name)
		_ = err
		sb.WriteString("\n")
		sb.Write(data)
	}
	other, _ := GetDefaultContent("policy/unrelated.mg")
	pb.WriteString(other)
	return sb.String(), pb.String(), err
}
`,
		"core/defaults/schemas.mg":              "Decl seed(X) bound [/number].\nseed(1).\n",
		"core/defaults/extra.mg":                "Decl extra(X) bound [/number].\n",
		"core/defaults/policy/config_params.mg": "Decl config_param(Key, Value) bound [/name, /number].\nconfig_param(/rounds, 3).\n",
		"core/defaults/policy/unrelated.mg":     "unrelated(X) :- missing(X).\n",
		"context/working.mg":                    "working(X) :- seed(X), config_param(/rounds, _).\n",
		"context/render.mg":                     "render(X) :- working(X), config_param(/rounds, _).\n",
		"context/load.go": `package context
import c "example.test/assembly/core"
//go:embed working.mg
var working string
//go:embed render.mg
var render string
func NewWorkingSet(engine interface{ LoadSchemaString(string) error }) error {
	schemas, _, err := c.DefaultCorpusText()
	_ = err
	params, err := c.GetDefaultContent("policy/config_params.mg")
	_ = err
	return engine.LoadSchemaString(schemas + "\n" + params + "\n" + working + "\n" + render)
}
`,
	}
}

func TestProgramAssemblyFollowsHostLoad(t *testing.T) {
	root := writeGoFlowFixture(t, assemblyFixture())
	gf, err := ScanGo(root, nil, codenerdProfile(t))
	if err != nil {
		t.Fatal(err)
	}
	var assembled []string
	for id, files := range gf.Embeds {
		if strings.HasPrefix(id, "load:context/load.go:") {
			assembled = files
		}
		if id == "context:working" || id == "context:render" {
			t.Errorf("fragment still judged alone: %s", id)
		}
	}
	want := []string{"core/defaults/schemas.mg", "core/defaults/extra.mg", "core/defaults/policy/config_params.mg", "context/working.mg", "context/render.mg"}
	if !reflect.DeepEqual(assembled, want) {
		t.Fatalf("host program = %v, want %v", assembled, want)
	}
	// Fail-before evidence is encoded in the test: each original fragment
	// fails loose engine analysis; the precise host assembly passes all stages.
	for _, file := range []string{"context/working.mg", "context/render.mg"} {
		src, err := LoadSource([]string{filepath.Join(root, file)})
		if err != nil {
			t.Fatal(err)
		}
		if v := Judge(src, testTime); v.Stage != StageAnalyze {
			t.Fatalf("isolated %s: %+v", file, v)
		}
	}
	var abs []string
	for _, file := range assembled {
		abs = append(abs, filepath.Join(root, file))
	}
	src, err := LoadSource(abs)
	if err != nil {
		t.Fatal(err)
	}
	if v := Judge(src, testTime); v.Stage != StageOK {
		t.Fatalf("assembled host: %+v", v)
	}
	// Removing the required source must still reject the program. No global
	// declaration bag or ignored engine diagnostic can satisfy this check.
	var withoutConfig []string
	for _, file := range abs {
		if !strings.HasSuffix(file, "config_params.mg") {
			withoutConfig = append(withoutConfig, file)
		}
	}
	src, err = LoadSource(withoutConfig)
	if err != nil {
		t.Fatal(err)
	}
	if v := Judge(src, testTime); v.Stage != StageAnalyze {
		t.Fatalf("missing dependency: %+v", v)
	}
}

func TestSeparateReceiversDoNotMergePrograms(t *testing.T) {
	files := map[string]string{
		"go.mod": "module example.test/separate\n\ngo 1.22\n",
		"a.mg":   "Decl p(X) bound [/number].\n",
		"b.mg":   "Decl p(X) bound [/string].\n",
		"host.go": `package separate
//go:embed a.mg
var a string
//go:embed b.mg
var b string
func identity(text string) string { return text }
func loadText(engine interface{ LoadSchemaString(string) error }, text string) {
    engine.LoadSchemaString(text)
}
func load(first, second interface{ LoadSchemaString(string) error }) {
    loadText(first, identity(a))
    loadText(second, identity(b))
}
`,
	}
	gf, err := ScanGo(writeGoFlowFixture(t, files), nil, codenerdProfile(t))
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for id, files := range gf.Embeds {
		if !strings.HasPrefix(id, "load:") {
			t.Errorf("unconsumed group %s", id)
		}
		if len(files) != 1 {
			t.Fatalf("merged independent programs: %v", files)
		}
		got = append(got, files[0])
	}
	sort.Strings(got)
	if !reflect.DeepEqual(got, []string{"a.mg", "b.mg"}) {
		t.Fatalf("programs = %v", got)
	}
}

func TestProgramAssemblyAccumulatesHelperLoadsOnReceiver(t *testing.T) {
	root := writeGoFlowFixture(t, map[string]string{
		"go.mod":          "module example.test/view\n\ngo 1.22\n",
		"schemas_view.mg": "Decl view_property(Name, Value) bound [/string, /string].\nview_property(\"display\", \"block\").\n",
		"policy/view.mg":  "visible(Name) :- view_property(Name, \"block\").\n",
		"host.go": `package view
//go:embed schemas_view.mg
var schema string
//go:embed policy/view.mg
var policy string
type Engine interface { LoadSchemaString(string) error }
func loadViewLogic(engine Engine) error {
	if err := loadViewSchema(engine); err != nil { return err }
	alias := engine
	return alias.LoadSchemaString(policy)
}
// Declared after the policy call to require ordering by helper invocation.
func loadViewSchema(engine Engine) error { return loadSchema(engine) }
func loadSchema(engine Engine) error { return engine.LoadSchemaString(schema) }
`,
	})
	// The previous per-load discovery judged this policy alone and rejected
	// its undeclared input. Keep that failure condition explicit alongside
	// the passing cumulative program, without suppressing engine findings.
	src, err := LoadSource([]string{filepath.Join(root, "policy/view.mg")})
	if err != nil {
		t.Fatal(err)
	}
	if v := Judge(src, testTime); v.Stage != StageAnalyze {
		t.Fatalf("policy without helper schema: %+v", v)
	}
	gf, err := ScanGo(root, nil, codenerdProfile(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(gf.Embeds) != 1 {
		t.Fatalf("helper and caller must be one program, got %v", gf.Embeds)
	}
	for id, files := range gf.Embeds {
		if !strings.HasPrefix(id, "load:host.go:") || !reflect.DeepEqual(files, []string{"schemas_view.mg", "policy/view.mg"}) {
			t.Fatalf("cumulative host program %s = %v", id, files)
		}
	}
	verdicts := judgePrograms(root, gf.Embeds)
	if len(verdicts) != 1 || verdicts[0].Verdict.Stage != StageOK {
		t.Fatalf("same-receiver host program: %+v", verdicts)
	}
}

func TestProgramReceiverIdentity(t *testing.T) {
	const header = `package receivers
//go:embed a.mg
var a string
//go:embed b.mg
var b string
type Engine interface { LoadSchemaString(string) error; LoadProgramString(string) error }
type Host struct { Engine Engine; Other Engine }
func loadText(engine Engine, text string) { engine.LoadSchemaString(text) }
func identity(engine Engine) Engine { return engine }
func fresh() Engine { return newEngine() }
func (host *Host) load(text string) { loadText(host.Engine, text) }
`
	for _, tc := range []struct {
		name string
		body string
		want []string
	}{
		{"direct accumulation", `func run(engine Engine) {
			engine.LoadSchemaString(a)
			engine.LoadProgramString(b)
		}`, []string{"a.mg,b.mg"}},
		{"same-line loads", `func run(engine Engine) { engine.LoadSchemaString(a); engine.LoadSchemaString(b) }`, []string{"a.mg,b.mg"}},
		{"helper source arguments", `func run(engine Engine) {
			loadText(engine, a)
			loadText(identity(engine), b)
		}`, []string{"a.mg,b.mg"}},
		{"static helper sources", `func loadA(engine Engine) { engine.LoadSchemaString(a) }
		func loadB(engine Engine) { engine.LoadSchemaString(b) }
		func run(first, second Engine) {
			loadA(first)
			loadB(second)
		}`, []string{"a.mg", "b.mg"}},
		{"helper shared by separate engines", `func loadA(engine Engine) { engine.LoadSchemaString(a) }
		func loadB(engine Engine) { engine.LoadSchemaString(b) }
		func run(first, second Engine) {
			loadA(first)
			loadA(second)
			loadB(first)
		}`, []string{"a.mg", "a.mg,b.mg"}},
		{"separate constructors", `func run() {
			first := fresh()
			second := fresh()
			loadText(first, a)
			loadText(second, b)
		}`, []string{"a.mg", "b.mg"}},
		{"factory callers", `func build(text string) {
			engine := fresh()
			loadText(engine, text)
		}
		func run() { build(a); build(b) }`, []string{"a.mg", "b.mg"}},
		{"positional constructor", `type Concrete struct { Config string }
		func (engine *Concrete) LoadSchemaString(text string) error { return nil }
		func (engine *Concrete) LoadProgramString(text string) error { return nil }
		func makeEngine(config string) Engine { return &Concrete{config} }
		func run() {
			first := makeEngine("same config")
			second := makeEngine("same config")
			loadText(first, a)
			loadText(second, b)
		}`, []string{"a.mg", "b.mg"}},
		{"returned engine alias", `func run() {
			engine := fresh()
			loadText(identity(engine), a)
			loadText(engine, b)
		}`, []string{"a.mg,b.mg"}},
		{"independent return slots", `func pair() (Engine, Engine) { return fresh(), fresh() }
		func run() {
			first, second := pair()
			loadText(first, a)
			loadText(second, b)
		}`, []string{"a.mg", "b.mg"}},
		{"shared return slots", `func pair(engine Engine) (Engine, Engine) { return engine, engine }
		func run(engine Engine) {
			first, second := pair(engine)
			loadText(first, a)
			loadText(second, b)
		}`, []string{"a.mg,b.mg"}},
		{"unrelated parameters with the same name", `func first(engine Engine) { loadText(engine, a) }
		func second(engine Engine) { loadText(engine, b) }`, []string{"a.mg", "b.mg"}},
		{"method receiver field", `func run(host *Host) {
			host.load(a)
			loadText(host.Engine, b)
		}`, []string{"a.mg,b.mg"}},
		{"separate fields", `func run(host *Host) {
			loadText(host.Engine, a)
			loadText(host.Other, b)
		}`, []string{"a.mg", "b.mg"}},
		{"initialized field alias", `func run(engine Engine) {
			host := &Host{Engine: engine}
			host.load(a)
			loadText(engine, b)
		}`, []string{"a.mg,b.mg"}},
		{"ambiguous alias", `func run(first, second Engine, flag bool) {
			engine := first
			if flag { engine = second }
			loadText(engine, a)
			loadText(first, b)
		}`, []string{"a.mg", "b.mg"}},
		{"reassigned parameter", `func run(engine, other Engine) {
			engine.LoadSchemaString(a)
			engine = other
			engine.LoadSchemaString(b)
		}`, []string{"a.mg", "b.mg"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root := writeGoFlowFixture(t, map[string]string{
				"go.mod":  "module example.test/receivers\n\ngo 1.22\n",
				"a.mg":    "Decl a(X).\n",
				"b.mg":    "Decl b(X).\n",
				"host.go": header + tc.body,
			})
			gf, err := ScanGo(root, nil, codenerdProfile(t))
			if err != nil {
				t.Fatal(err)
			}
			var got []string
			for id, files := range gf.Embeds {
				if !strings.HasPrefix(id, "load:") {
					t.Errorf("fragment still judged alone: %s", id)
				}
				got = append(got, strings.Join(files, ","))
			}
			sort.Strings(got)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("programs = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestProgramReceiverFlowsAcrossPackages(t *testing.T) {
	root := writeGoFlowFixture(t, map[string]string{
		"go.mod":           "module example.test/shared\n\ngo 1.22\n",
		"schema/schema.mg": "Decl input(X).\n",
		"schema/load.go": `package schema
//go:embed schema.mg
var schema string
func Load(engine interface{ LoadSchemaString(string) error }) error {
	return engine.LoadSchemaString(schema)
}
`,
		"policy.mg": "output(X) :- input(X).\n",
		"host.go": `package shared
import "example.test/shared/schema"
//go:embed policy.mg
var policy string
func load(engine interface{ LoadSchemaString(string) error }) error {
	if err := schema.Load(engine); err != nil { return err }
	return engine.LoadSchemaString(policy)
}
`,
	})
	gf, err := ScanGo(root, nil, codenerdProfile(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(gf.Embeds) != 1 {
		t.Fatalf("cross-package helper must share the caller's receiver: %v", gf.Embeds)
	}
	for _, files := range gf.Embeds {
		if !reflect.DeepEqual(files, []string{"schema/schema.mg", "policy.mg"}) {
			t.Fatalf("cross-package program = %v", files)
		}
	}
}

func TestEngineArityOverloads(t *testing.T) {
	// ast.PredicateSym contains Symbol AND Arity; ProgramInfo.Decls is keyed
	// by that symbol (program.go uses the engine API directly). The unary
	// input has no rule; only the binary overload is derived.
	src := Source{Text: `
Decl task_complexity(Level) bound [/name].
Decl task_complexity(Task, Level) bound [/string, /name].
task("demo").
task_complexity(Task, /high) :- task(Task).
`}
	if v := Judge(src, testTime); v.Stage != StageOK {
		t.Fatalf("valid overload: %+v", v)
	}
	// The shared name must not rescue a body call at an unknown arity.
	src.Text += "bad(Task) :- task(Task), task_complexity(Task, /high, /extra).\n"
	if v := Judge(src, testTime); v.Stage != StageAnalyze {
		t.Fatalf("undefined arity: %+v", v)
	}
}

func TestHelperNamesArePackageScoped(t *testing.T) {
	root := writeGoFlowFixture(t, map[string]string{
		"go.mod": "module example.test/packages\n\ngo 1.22\n",
		"route/host.go": `package route
type Fact struct { Predicate string; Args []any }
func send(f Fact) { _ = f.Args }
func run() { send(Fact{Predicate: "route_only", Args: []any{1, 2, 3}}) }
`,
		"core/host.go": `package core
type Fact struct { Predicate string; Args []any }
func send(k interface{ Assert(Fact) }, f Fact) { k.Assert(f) }
func run(k interface{ Assert(Fact) }) { send(k, Fact{Predicate: "stored", Args: []any{1, 2}}) }
`,
	})
	gf, err := ScanGo(root, nil, codenerdProfile(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(gf.Asserts) != 1 || gf.Asserts[0].Predicate != "stored" {
		t.Fatalf("package-scoped sends: %+v", gf.Asserts)
	}
}
