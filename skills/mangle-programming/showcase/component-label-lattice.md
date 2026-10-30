# One label per component, kept inside the fixpoint

**The claim.** A connected component's label (its smallest ordinal) is a
merge lattice: each node holds one label, a smaller offer replaces it, and the
minimum floods the component during the fixpoint. Plain Datalog computes
every (node, reachable node) pair first and takes `fn:min` afterwards.

## Where it lives (codeNERD, public)

- Rules: `internal/orient/lineage.mg` (`read_component_ord`, the
  `orient_lower_ord` merge, `read_component`).
- Decls: `internal/orient/schema.mg` (`fundep([Path], [Ord])`,
  `merge([Ord], "orient_lower_ord")`, and the `deferred()` merge Decl with
  its `mode('+', '+', '-')`).
- Test: `internal/orient/component_label_test.go` (one row per linked path,
  the right label per path).
- Tooling: the merge's comparator rules have head variables that only the
  Decl's modes bind. Checked alone they used to draw 4 E002 and 4 E004 in the
  editor; MangleLSP 1.3 analyzes a file with the Decls of its program.

## Distillation (`new-lab.sh component_label`)

```mangle
Decl edge(A, B) bound [/name, /name].
Decl tie(P, Ord) bound [/name, /number].
Decl label(P, Ord) descr [fundep([P], [Ord]), merge([Ord], "lower")] bound [/name, /number].
Decl lower(Held, Offered, Kept) descr [mode('+', '+', '-'), deferred()] bound [/number, /number, /number].

tie(/a, 3). tie(/b, 1). tie(/c, 2). tie(/x, 5). tie(/y, 4).
edge(/a, /b). edge(/b, /a). edge(/b, /c). edge(/c, /b). edge(/x, /y). edge(/y, /x).

lower(Held, Offered, Held) :- Held <= Offered.
lower(Held, Offered, Offered) :- Offered < Held.
label(P, O) :- edge(P, _), tie(P, O).
label(A, O) :- label(B, O), edge(A, B).
```

## Output (v0.7.0, `mangle-cli run comp.mg --query label`)

```
label(/a,1)  label(/b,1)  label(/c,1)  label(/x,4)  label(/y,4)
```

The closure form (`reach/2` has 13 rows for these 6 edges, then
`... |> do fn:group_by(P), let O = fn:min(T)`) gives the same five rows.

## What it replaced

A closure of every (path, smaller reachable path) pair followed by `fn:min`.
On the repository's own corpus (1,445 paths) the closure held 25,293 pairs
and took 1.6 s; the lattice gives the same labels in 0.4 s (measured by
codeNERD's authors, per the comment in `lineage.mg`).

## Cost and a trap

Rows are bounded by paths, not pairs. Keep self-loops out of the edge
relation: a recursive cost lattice over a graph with a self-loop edge never
terminates and ignores the fact limit
([verified-traps-evaluation](../references/verified-traps-evaluation.md));
the min-label rules above exclude them because a node never connects to
itself (`Path != Anchor`).
