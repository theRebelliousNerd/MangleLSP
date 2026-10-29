# External predicates in Go: what the engine actually does

`go-as-oracle.md` covers when to call Go from inside a fixpoint. This
file covers how to write the callback, against the v0.7 source
(`engine/topdown.go` `EvalExternalQuery`, `engine/seminaivebottomup.go`
`oneStepEvalPremise` and `getPushdown`). Templates copied from older
skills get several of these behaviors wrong.

## The call, step by step (read from source)

1. The premise is substituted first, so input variables bound by earlier
   premises arrive as constants. An external needs exactly one `mode`.
2. **Store first.** If any fact already matches the query, Go is not
   called. Within one evaluation, each distinct input tuple is fetched at
   most once, and its rows become ordinary facts in the store.
3. **An empty answer stores nothing,** so the same inputs are asked again
   every time the premise is re-evaluated. Remember known-empty inputs and
   return false from `ShouldQuery` for them.
4. `ShouldQuery(inputs, filters, pushdown)` returning false means *no rows
   this time*, not "use what you cached". A cache hit must still reach the
   engine.
5. `ExecuteQuery` calls `cb(outputs)` once per row, with exactly as many
   values as output positions. Constant filters in output positions are
   applied by the engine; rows that don't match are dropped.
6. **Pushdown quirk:** `getPushdown` collects the external premise's own
   variables, so with `ShouldPushdown() == true` the callback receives
   every other atom premise of the rule, repeated once per output
   variable. Treat pushdown as a hint list, and dedupe it.
7. **Negation never calls Go.** `!ext(...)` reads the store only (see
   `verified-traps.md`), so its answer depends on which positive premises
   happened to fetch rows first. Negate a positive projection instead.

## A cache that is correct

```go
func (c *cached) ShouldQuery(in []ast.Constant, _ []ast.BaseTerm, _ []ast.Term) bool {
	return !c.knownEmpty[key(in)] // a hit still goes to ExecuteQuery
}
func (c *cached) ExecuteQuery(in []ast.Constant, f []ast.BaseTerm, p []ast.Term, cb func([]ast.BaseTerm)) error {
	rows, ok := c.rows[key(in)]
	if !ok {
		var err error
		if rows, err = c.backend(in); err != nil {
			return err // see the error policy below
		}
		c.rows[key(in)] = rows
		if len(rows) == 0 {
			c.knownEmpty[key(in)] = true
		}
	}
	for _, r := range rows {
		cb(r)
	}
	return nil
}
```

Key the cache on the canonical form of the inputs. Scope it to one program
generation, and invalidate it when the backend's data changes.

## Error policy: absence is not failure

Returning `nil` on a backend error, as many templates do, makes "the
service is down" indistinguishable from "no matches". That is silent
truncation of the decision's inputs. Pick one per predicate:

- **Fail the evaluation** (`return err`) when no safe decision exists
  without the answer, such as a permission or a safety gate.
- **Report it as data.** Add a status column so rules can reason about
  degraded inputs (this passes strict analysis):

```mangle
Decl search(Q, Status, Hit) descr [external(), mode('+', '-', '-')] bound [/string, /name, /string].
hit(Q, H) :- query(Q), search(Q, /ok, H).
degraded(Q) :- query(Q), search(Q, /unavailable, Reason).
answered(Q) :- query(Q), search(Q, S, H).
decide(Q) :- query(Q), answered(Q), !degraded(Q).
```

Go emits `[/unavailable, "<reason>"]` once on failure. The proof of every
decision then shows whether it rested on degraded data.

## Contract checklist

- One Decl per external: `descr [external(), mode(...)]` plus `bound [...]`
  matching the Go output types (`ast.String`, `ast.Name`, `ast.Number`,
  `ast.Float64`, `ast.List`, ...). Use `fn:List(T)`, capital L, in bounds.
- Register under `ast.PredicateSym{Symbol, Arity}` in the map passed to
  `engine.WithExternalPredicates`, with the same name and arity as the
  Decl. `mangle-cli boundary` reports mismatches between the two (B-codes).
- Deterministic within one evaluation. Time out network calls, and gate
  slow ones in `ShouldQuery`.
- Tests: a positive case, an empty answer (asked once, then memoized), a
  backend failure (status row or error), and a negated use (the projection
  pattern).
- Custom boolean checks such as signature verification are externals with
  `mode('+', '+')`, not `:check(fn:...)`: user code can't register `fn:`
  functions, and `:check` isn't a built-in.
