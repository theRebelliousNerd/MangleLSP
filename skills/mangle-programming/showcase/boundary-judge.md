# Mangle judges the Go code that feeds it

**The claim.** Whether a rule can ever fire depends on Go code no rule can
see. A Mangle program judges facts that go/ast extracts from Go and the
engine's parser extracts from `.mg`, and every finding carries its proof,
including the *absences* it rests on, so the report explains itself.

## Where it lives

- Judge: MangleLSP `mangle-oracle/boundary.mg` (B001-B012), analyzed with
  strict bounds (`TestBoundaryProgramIsStrictlyTyped`).
- Extraction: `mangle-oracle/gofacts.go` (Go), `mgfacts.go` (.mg), host
  profile `profiles/codenerd.json`.
- Tests: `mangle-oracle/boundary_test.go` (every code plus near misses),
  `mangle-lsp/test/cli/agent.test.ts`.
- Run it: `mangle-cli boundary --root /home/rebelliousnerd/codeProjects/codenerd`.

## Distillation (`new-lab.sh boundary_judge`)

```mangle
Decl decl(P, A, File, Line) bound [/string, /number, /string, /number].
Decl mg_uses(P, A, File) bound [/string, /number, /string].
Decl mg_defines(P, A) bound [/string, /number].
Decl go_assert(Site, P, A, File, Line) bound [/number, /string, /number, /string, /number].
Decl go_mention(P, File, Line) bound [/string, /string, /number].

decl("active_goal", 1, "schemas_analysis.mg", 15).
decl("user_intent", 5, "schemas_intent.mg", 29).
mg_uses("active_goal", 1, "policy/activation.mg").
mg_uses("user_intent", 5, "policy/routing.mg").
go_assert(7, "user_intent", 5, "perception.go", 412).

produced(P, A) :- mg_defines(P, A).
produced(P, A) :- go_assert(_, P, A, _, _).
mentioned(P) :- go_mention(P, _, _).
never_produced(P, A, F, L) :-
    decl(P, A, F, L), mg_uses(P, A, _), !produced(P, A), !mentioned(P).
```

## Output (v0.7.0, `r.Why`)

```
never_produced("active_goal",1,"schemas_analysis.mg",15)
  by never_produced(P,A,F,L) :- decl(P,A,F,L), mg_uses(P,A,_), !produced(P,A), !mentioned(P).
  premises:
    decl("active_goal",1,"schemas_analysis.mg",15)   [EDB]
    produced("active_goal",1)                         [absent]
    mentioned("active_goal")                          [absent]
```

`active_goal` is real: `policy/activation.mg` reads it and nothing in
codeNERD asserts it, so that rule never fires.

## What it enabled

Before: "rule compiles but derives nothing" was found by reading code.
After, on codeNERD in 3.5 s: 66 rules read predicates nothing produces, 27
Go asserts use an arity no Decl has (`next_action/3` vs `Decl
next_action/1`), 11 build the wrong constant type (`float64` into
`/number`, `"/verify"` into `/string`), and the 10 externals are all wired
with agreeing modes.

## Cost

1385 Go files, 166 `.mg` files, 1345 assert sites: 3.5 s, almost all of it
go/ast. The Mangle judgment is a few thousand facts and under 100 ms.
