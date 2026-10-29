# Mangle LSP diagnostics reference

<!-- Generated from mangle-lsp/src/analysis/diagnostics.ts by `mangle-cli explain --all --markdown`. Do not edit by hand. -->

Every diagnostic reported by the Mangle language server and `mangle-cli check` has a stable code.
Run `mangle-cli explain <CODE>` for the same text in a terminal.

| Code | Title | Category | Severity |
|------|-------|----------|----------|
| [A001](#a001) | Arg-max joined back: use a merge lattice | advice | info |
| [A002](#a002) | Parallel variant predicates: use a tagged union | advice | info |
| [A003](#a003) | Premise tests a value no writer produces | advice | warning |
| [A004](#a004) | Clock comparison: use temporal facts | advice | info |
| [A005](#a005) | Collecting pairs: use fn:collect_to_map | advice | info |
| [A006](#a006) | All paths, then pick one: use a merge lattice | advice | info |
| [B001](#b001) | Rule reads a predicate nothing produces | boundary | warning |
| [B002](#b002) | Declared predicate nothing produces or reads | boundary | info |
| [B003](#b003) | Go asserts an undeclared predicate | boundary | warning |
| [B004](#b004) | Go asserts a predicate with the wrong arity | boundary | error |
| [B005](#b005) | Go queries a predicate the program never defines | boundary | warning |
| [B006](#b006) | Asserted but never read | boundary | info |
| [B007](#b007) | Go builds the wrong constant type for a column | boundary | error |
| [B008](#b008) | External predicate without a Go callback | boundary | warning |
| [B009](#b009) | Go callback without an external Decl | boundary | warning |
| [B010](#b010) | Callback modes disagree with the Decl | boundary | error |
| [B011](#b011) | Rule negates an external; its Go callback never runs | boundary | warning |
| [B012](#b012) | Rule reads a predicate with no recognized producer | boundary | info |
| [E000](#e000) | File or I/O error | io | error |
| [E001](#e001) | Variables in facts must be ground | safety | error |
| [E002](#e002) | Range restriction violation | safety | error |
| [E003](#e003) | Variables in negation must be bound | safety | error |
| [E004](#e004) | Variables in comparison must be bound | safety | error |
| [E005](#e005) | Unknown built-in predicate | builtin | error |
| [E006](#e006) | Built-in predicate arity mismatch | builtin | error |
| [E007](#e007) | Built-in predicate input not bound | builtin | error |
| [E008](#e008) | Unknown built-in function | builtin | error |
| [E009](#e009) | Built-in function arity mismatch | builtin | error |
| [E010](#e010) | Unbound variable in function argument | builtin | error |
| [E011](#e011) | Invalid transform structure | transform | error |
| [E012](#e012) | Unbound variable in group_by | transform | error |
| [E014](#e014) | Unbound variable in function application | builtin | error |
| [E015](#e015) | Negation cycle (unstratifiable program) | stratification | error |
| [E016](#e016) | Recursion without base case | stratification | warning |
| [E017](#e017) | Recursion generates unbounded values | stratification | warning |
| [E018](#e018) | Wrong function casing | builtin | error |
| [E019](#e019) | Cartesian product in rule body | performance | warning |
| [E020](#e020) | Function does not exist in Mangle | builtin | error |
| [E021](#e021) | Late filtering | performance | warning |
| [E022](#e022) | Late negation | performance | warning |
| [E023](#e023) | Massive Cartesian product | performance | warning |
| [E024](#e024) | Declaration arguments must be variables | declaration | error |
| [E025](#e025) | Bound count does not match arity | declaration | error |
| [E026](#e026) | External predicate needs exactly one mode | declaration | error |
| [E027](#e027) | Odd number of key/value arguments | style | error |
| [E030](#e030) | Pattern argument has the wrong type | builtin | error |
| [E031](#e031) | Package name must be lowercase | declaration | error |
| [E032](#e032) | Invalid name constant | style | error |
| [E033](#e033) | Destructuring target must be a variable | builtin | error |
| [E034](#e034) | Field selector must be a constant | builtin | error |
| [E035](#e035) | Division by zero | builtin | error |
| [E036](#e036) | group_by arguments must be variables | transform | error |
| [E037](#e037) | Duplicate variable in group_by | transform | error |
| [E038](#e038) | Invalid string escape | style | error |
| [E039](#e039) | Wildcard in rule head | style | warning |
| [E040](#e040) | Predicate arity mismatch | declaration | error |
| [E041](#e041) | Private predicate used from another package | declaration | error |
| [E043](#e043) | Transform redefines a body variable | transform | error |
| [E044](#e044) | Duplicate declaration | declaration | error |
| [E045](#e045) | Transform without body | transform | error |
| [E046](#e046) | Declaration arity mismatch | declaration | error |
| [E047](#e047) | Variable not available after group_by | transform | error |
| [E048](#e048) | Multiple chained transforms | transform | error |
| [E049](#e049) | Head variable not grouped or aggregated | transform | error |
| [E050](#e050) | Reducer in let-transform | transform | error |
| [E051](#e051) | Multiple doc descriptors | declaration | error |
| [E052](#e052) | Empty doc descriptor | declaration | error |
| [E053](#e053) | Descriptor argument must be a string | declaration | error |
| [E054](#e054) | arg descriptor needs two arguments | declaration | error |
| [E055](#e055) | arg descriptor must start with a variable | declaration | error |
| [E056](#e056) | arg descriptor for unknown variable | declaration | error |
| [E057](#e057) | Missing arg descriptors | declaration | warning |
| [E058](#e058) | Temporal annotation on non-temporal predicate | temporal | error |
| [E059](#e059) | Temporal predicate without annotation | temporal | error |
| [E060](#e060) | Reducer needs an argument | transform | error |
| [E061](#e061) | Malformed type expression | declaration | error |
| [E062](#e062) | Self-recursive temporal predicate | temporal | warning |
| [E063](#e063) | Mutual recursion through temporal predicates | temporal | error |
| [E064](#e064) | Future operator in recursive temporal rule | temporal | error |
| [E065](#e065) | Output argument must be a fresh variable | safety | error |
| [E066](#e066) | Variable is never bound | safety | error |
| [E067](#e067) | Invalid unit for time function | builtin | error |
| [E068](#e068) | Function argument type mismatch | type | error |
| [E069](#e069) | Predicate argument type mismatch | type | error |
| [E070](#e070) | Fact does not match declared bounds | type | error |
| [E071](#e071) | Rule result does not match declared bounds | type | error |
| [E072](#e072) | Variable has conflicting types | type | error |
| [E073](#e073) | Comparison of incompatible types | type | warning |
| [E074](#e074) | Variable used only once | style | warning |
| [E075](#e075) | Undefined predicate | declaration | warning |
| [E076](#e076) | Use fn:count instead of collecting | performance | info |
| [E077](#e077) | Duplicate premise | performance | warning |
| [E078](#e078) | Unknown declaration descriptor | declaration | warning |
| [E079](#e079) | Invalid mode declaration | declaration | warning |
| [E080](#e080) | Wildcard merges rows before aggregation | performance | warning |
| [E081](#e081) | Negated external predicate never calls Go | declaration | warning |
| [E082](#e082) | Bound that strict checking can never satisfy | type | warning |
| [E083](#e083) | Zero-arity Decl breaks strict bounds checking | declaration | warning |
| [E084](#e084) | :string:matches fails strict bounds checking | builtin | warning |
| [P001](#p001) | Syntax error | syntax | error |

## A001

**Arg-max joined back: use a merge lattice** - advice, default severity: info

Mangle has no arg-max reducer, so a common pattern takes `fn:max` (or `fn:min`) per group in one rule and joins the result back to the source in a second to find the winning row. That needs the whole relation and a second stratum. A Decl with `fundep([Key], [P])` and `merge([P], "better")` makes the relation keep one value per key, replaced whenever the deferred comparison rule prefers a new one, inside the fixpoint and inside recursion. Verified on v0.7: same answers as the join-back; ties keep the first winner instead of several rows. The engine replaces the old fact only on stores that support removal (its in-memory stores do; a temporal-store adapter does not, and then both facts stay).

**How to fix:** Add the lattice relation (the quick fix writes it from the aggregating rule) and switch the consumers to it.

Instead of:
```mangle
latest_t(F, M) :- obs(F, T, _) |> do fn:group_by(F), let M = fn:max(T).
latest(F, V) :- latest_t(F, M), obs(F, M, V).
```
write:
```mangle
Decl best_obs(F, P) descr [fundep([F], [P]), merge([P], "obs_later")].
Decl obs_later(P1, P2, B) descr [mode('+', '+', '-'), deferred()].
obs_later(P1, P2, P1) :- :match_pair(P1, T1, _), :match_pair(P2, T2, _), T1 >= T2.
obs_later(P1, P2, P2) :- :match_pair(P1, T1, _), :match_pair(P2, T2, _), T1 < T2.
best_obs(F, fn:pair(T, V)) :- obs(F, T, V).
```

## A002

**Parallel variant predicates: use a tagged union** - advice, default severity: info

Three or more predicates such as `tool_started_event`, `tool_failed_event`, `tool_done_event` are variants of one thing spread over several relations. A Decl bounded by `fn:TaggedUnion(/kind, /started, fn:Struct(...), ...)` keeps them in one relation: a rule can match one variant (`:match_field(E, /kind, K), K = /failed`) or all of them, and a new variant is one more tag instead of a new predicate. Tagged unions pass strict bounds checking in v0.7 (the checker types their tags as /name); unions of singletons do not (E082).

**How to fix:** Declare one relation with a tagged-union value column and assert one fact per event.

## A003

**Premise tests a value no writer produces** - advice, default severity: warning

Every rule and fact that writes this column of the predicate writes a name constant, and the constant this premise tests is not one of them, so the premise can never match and the rule derives nothing. This is the closed-vocabulary failure: a typo such as `/hihg`. A `fn:Singleton` union bound cannot catch it in v0.7 (E082); an invariant relation can: list the vocabulary as facts, derive violations with negation, and have a test assert there are none.

**How to fix:** Fix the constant (the quick fix offers the closest written value), and consider `valid_x(...)` facts plus a `bad_x(V) :- x(V), !valid_x(V).` invariant.

Instead of:
```mangle
sev(/a, /high).
urgent(I) :- sev(I, /hihg).
```
write:
```mangle
sev(/a, /high).
urgent(I) :- sev(I, /high).
```

## A004

**Clock comparison: use temporal facts** - advice, default severity: info

The rule reads a clock fact (`current_time(Now)`) and compares timestamps to decide whether something is recent, expired or due. Mangle has temporal facts: a Decl marked `temporal` holds facts valid over intervals, and operators such as `<-[0s, 24h] seen(X)` ("held at some point in the last 24 hours") read the evaluation time. Expiry needs no sweeper and no clock fact, and pinning the evaluation time replays a decision exactly. Verified on v0.7 (`recent(X) :- <-[0s, 24h] seen(X).`). Evaluation needs a temporal store and an evaluation time.

**How to fix:** Declare the fact temporal, assert it with its validity interval, and replace the comparison by a temporal operator.

**Upstream docs:** https://mangle.readthedocs.io/en/latest/temporal.html

## A005

**Collecting pairs: use fn:collect_to_map** - advice, default severity: info

`fn:collect(fn:pair(K, V))` builds a list of pairs that the host then turns into a map. `fn:collect_to_map(K, V)` builds the map in the aggregation: one answer-shaped fact per group that Go reads without assembling and that rules can query with `fn:map:get`. Verified on v0.7. Keys should be unique per group.

**How to fix:** Replace the reducer (quick fix).

Instead of:
```mangle
m(U, L) :- kv(U, K, V) |> do fn:group_by(U), let L = fn:collect(fn:pair(K, V)).
```
write:
```mangle
m(U, M) :- kv(U, K, V) |> do fn:group_by(U), let M = fn:collect_to_map(K, V).
```

## A006

**All paths, then pick one: use a merge lattice** - advice, default severity: info

A recursive relation accumulates a path or cost (`fn:list:append`, `fn:plus`) for every route, and a later aggregation keeps only the minimum or maximum. On a cyclic graph that recursion never finishes: verified on v0.7, a 5-edge cycle ran 38 s to the 100k fact limit. Declaring the recursive relation with `fundep` and `merge` keeps only the best path per key during the fixpoint (upstream `examples/shortest_path.mg`); the same cyclic graph then terminates with its 16 shortest paths.

**How to fix:** Add `descr [fundep([Source, Target], [Path]), merge([Path], "shorter")]` to the recursive relation and a deferred `shorter` rule, then drop the aggregation.

**Upstream docs:** https://mangle.readthedocs.io/en/latest/aggregation.html

## B001

**Rule reads a predicate nothing produces** - boundary, default severity: warning

A rule body reads this predicate, but no rule or fact in the module's .mg files derives it, no Go code asserts it, and its name appears nowhere else in Go. The rule compiles and never fires. Found by `mangle-cli boundary`, which scans the Go module with go/ast and judges the result with a Mangle program on the real engine.

**How to fix:** Make the producer assert it (with the Decl's shape), or delete the rule and the Decl.

## B002

**Declared predicate nothing produces or reads** - boundary, default severity: info

A Decl that no rule, fact or Go code produces, and nothing reads in .mg or Go. It is dead schema.

**How to fix:** Delete the Decl, or wire the producer and consumer it was meant for.

## B003

**Go asserts an undeclared predicate** - boundary, default severity: warning

Go asserts a fact whose predicate no .mg file declares or defines. No rule can read it (a typo, or a fact nobody consumes), and hosts that validate facts against Decls warn on it.

**How to fix:** Add the Decl (with bounds) to the owning schema file, or correct the predicate name.

## B004

**Go asserts a predicate with the wrong arity** - boundary, default severity: error

In Mangle the arity is part of the predicate: `p/3` and `p/2` are different relations. Go asserts this name with an arity that no Decl and no rule has, so every rule written against the declared arity never sees these facts.

**How to fix:** Make the Go fact match the Decl's arguments, or change the Decl (and its rules) if the Go shape is the intended one.

## B005

**Go queries a predicate the program never defines** - boundary, default severity: warning

Go queries a predicate that no .mg file declares or defines, so the query always returns nothing.

**How to fix:** Fix the name, or add the rule that derives it.

## B006

**Asserted but never read** - boundary, default severity: info

Go asserts this declared predicate, but no rule reads it, no Go code queries it, and its name appears nowhere else in Go. The facts are written and ignored.

**How to fix:** Write the rule that uses it, or stop asserting it.

## B007

**Go builds the wrong constant type for a column** - boundary, default severity: error

The Decl bounds this argument with a base type, and Go builds a value that cannot become a constant of that type: a float64 for a /number column, an int for /float64, a name (`MangleAtom`, or a literal "/x" string that codeNERD's kernel turns into a name) for /string, or a plain string literal for /name. A join between a name and a string never matches, so rules silently derive nothing; strict bounds checking would reject the fact. Shapes the scan cannot know (a string variable) are never reported.

**How to fix:** Build the declared representation at the producer: `types.MangleAtom(x)` for /name, `types.MangleString(x)` or a plain string for /string, `int64(...)` for /number, `float64(...)` for /float64. Or fix the Decl if Go's shape is the intended one.

## B008

**External predicate without a Go callback** - boundary, default severity: warning

The Decl says `descr [external(), mode(...)]`, so evaluation expects a Go callback, but the module registers none for this name and arity. Hosts reject or silently empty the predicate.

**How to fix:** Register the callback with the Decl's name, arity and modes, or remove `external()`.

## B009

**Go callback without an external Decl** - boundary, default severity: warning

Go registers an external-predicate callback, but no .mg Decl marks the predicate `external()` at this arity, so the engine never calls it.

**How to fix:** Declare the predicate with `descr [external(), mode(...)]` matching the callback.

## B010

**Callback modes disagree with the Decl** - boundary, default severity: error

The modes the Go callback is registered with (+ input, - output) differ from the Decl's `mode(...)`. The engine binds arguments by the Decl, so the callback receives inputs it did not expect.

**How to fix:** Make the two agree; the Decl is what analysis and evaluation use.

## B011

**Rule negates an external; its Go callback never runs** - boundary, default severity: warning

The cross-file form of E081: a rule negates an external predicate, and the engine answers negations from stored facts only (v0.7 engine/premise.go), so the Go callback listed with the finding is never called for it.

**How to fix:** Call the external positively in a helper rule that binds its inputs, then negate the helper.

## B012

**Rule reads a predicate with no recognized producer** - boundary, default severity: info

As B001, except that Go mentions the name somewhere the scan does not read as an assert: a list of predicate names, a map, a log line or a producer whose predicate is computed. Check the listed places; if none of them asserts the predicate, the rule never fires.

**How to fix:** Assert the predicate where it is produced, with the Decl's shape.

## E000

**File or I/O error** - io, default severity: error

The CLI could not read the input file (missing path, permissions, encoding).

**How to fix:** Check the path passed on the command line and that the file is readable UTF-8 text.

## E001

**Variables in facts must be ground** - safety, default severity: error

A fact (a clause without `:-` body) states something unconditionally true, so it cannot contain variables: `foo(X).` would mean "foo holds for every possible value", which Datalog cannot represent.

**How to fix:** Replace the variable with a constant, or turn the fact into a rule whose body binds the variable.

Instead of:
```mangle
likes(X, /pizza).
```
write:
```mangle
likes(X, /pizza) :- person(X).
```

## E002

**Range restriction violation** - safety, default severity: error

Every variable in a rule head must be bound by the body: by a positive atom, by `X = <constant or bound expression>`, by a transform `let`, or by an input mode declaration. Otherwise the rule would derive infinitely many facts. This is the Datalog "safety" / range-restriction condition.

**How to fix:** Add a positive body atom that produces the variable, bind it with `=`, or compute it in a `|> let` transform. Check for typos: a head variable spelled differently from the body variable is unbound.

Instead of:
```mangle
adult(Name) :- person(N, Age), Age >= 18.
```
write:
```mangle
adult(Name) :- person(Name, Age), Age >= 18.
```

## E003

**Variables in negation must be bound** - safety, default severity: error

Negation (`!pred(...)`) is negation-as-failure: it can only check that a *specific* tuple is absent. All its variables must be bound by positive premises of the same rule, anywhere in the body: Mangle v0.7 delays a negation until the premises that bind its variables have run. A variable that no positive premise binds is rejected ("variable X is not bound"), and so is `_` inside a negation, because the checker turns each `_` into a fresh variable that nothing binds: `!r(X, _)` does not mean "no r with any second value".

**How to fix:** Bind the variable with a positive atom. To test "no tuple with any value here", project the columns you care about into a helper predicate and negate that (the quick fix writes the helper).

Instead of:
```mangle
lonely(X) :- person(X), !friend(X, _).
```
write:
```mangle
has_friend(X) :- friend(X, _).
lonely(X) :- person(X), !has_friend(X).
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/negation.html

## E004

**Variables in comparison must be bound** - safety, default severity: error

Comparisons only test values; they never produce them. `<`, `<=`, `>`, `>=` and the `:float:` comparisons need both sides bound by an *earlier* premise (v0.7 rejects the rule otherwise: "move the subgoal to the right"). `!=` is different: like a negation it waits until its variables are bound, so its position does not matter, but some premise must still bind them.

**How to fix:** Move the comparison after the atom that binds the variable, or add such an atom. For `!=`, make sure a positive premise or equality binds both sides.

Instead of:
```mangle
big(X) :- X > 100, size(X).
```
write:
```mangle
big(X) :- size(X), X > 100.
```

## E005

**Unknown built-in predicate** - builtin, default severity: error

Names starting with `:` are reserved for built-in predicates, and this one does not exist. User predicates must start with a lowercase letter and must not start with `:`.

**How to fix:** Use one of the built-ins suggested in the message (hover a `:` name to see its signature), or rename your predicate without the leading colon.

Instead of:
```mangle
p(S) :- s(S), :string:startswith(S, "a").
```
write:
```mangle
p(S) :- s(S), :string:starts_with(S, "a").
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/builtins.html

## E006

**Built-in predicate arity mismatch** - builtin, default severity: error

The built-in predicate was called with the wrong number of arguments.

**How to fix:** Check the signature in the message (or hover the predicate).

## E007

**Built-in predicate input not bound** - builtin, default severity: error

Input ("+") arguments of built-in predicates must be constants or variables bound by an earlier premise; built-ins cannot enumerate values for them. Mangle evaluates the body left to right for built-ins.

**How to fix:** Move the built-in to the right of the atom that binds the variable ("move the subgoal to the right").

Instead of:
```mangle
p(X) :- :lt(X, 10), num(X).
```
write:
```mangle
p(X) :- num(X), :lt(X, 10).
```

## E008

**Unknown built-in function** - builtin, default severity: error

Names starting with `fn:` are reserved for built-in functions and this one does not exist. Mangle has a small, fixed function library; there are no user-defined functions.

**How to fix:** Use one of the suggested functions, or express the computation with rules. Hover any `fn:` name to see its signature.

**Upstream docs:** https://mangle.readthedocs.io/en/latest/builtins.html

## E009

**Built-in function arity mismatch** - builtin, default severity: error

The built-in function was applied to the wrong number of arguments.

**How to fix:** Check the signature in the message (or hover the function).

## E010

**Unbound variable in function argument** - builtin, default severity: error

Functions are evaluated, not solved: all their arguments must already have values.

**How to fix:** Bind the variable with an atom before the function application.

Instead of:
```mangle
p(Y) :- Y = fn:plus(X, 1), num(X).
```
write:
```mangle
p(Y) :- num(X), Y = fn:plus(X, 1).
```

## E011

**Invalid transform structure** - transform, default severity: error

A `do` statement in a transform must be `do fn:group_by(...)` and it must come first. Aggregation in Mangle is written: `head :- body |> do fn:group_by(Keys...), let Agg = fn:reducer(...).`

**How to fix:** Start the transform with `do fn:group_by(...)`, or use only `let` statements for per-row computation.

Instead of:
```mangle
total(S) :- sale(X) |> let S = fn:sum(X).
```
write:
```mangle
total(S) :- sale(X) |> do fn:group_by(), let S = fn:sum(X).
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/aggregation.html

## E012

**Unbound variable in group_by** - transform, default severity: error

Grouping keys must be variables bound by the rule body.

**How to fix:** Group by variables that appear in positive body atoms.

## E014

**Unbound variable in function application** - builtin, default severity: error

In `V = fn:f(...)`, every variable inside the function application must be bound before the equality is evaluated.

**How to fix:** Bind the arguments first, then compute.

## E015

**Negation cycle (unstratifiable program)** - stratification, default severity: error

A predicate depends on its own negation through a cycle of rules, e.g. `p :- !q.` and `q :- !p.`. Mangle evaluates negation stratum by stratum, which requires that negated predicates are fully computed first; cycles through negation have no well-defined meaning.

**How to fix:** Break the cycle: introduce a base predicate that does not depend on the negated one, or restructure the logic so negation only refers to lower strata.

**Upstream docs:** https://mangle.readthedocs.io/en/latest/negation.html

## E016

**Recursion without base case** - stratification, default severity: warning

All clauses of this predicate are recursive, so it can never derive a first fact (bottom-up evaluation starts from base cases).

**How to fix:** Add a non-recursive clause, e.g. `path(X, Y) :- edge(X, Y).` next to the recursive one.

## E017

**Recursion generates unbounded values** - stratification, default severity: warning

A recursive rule computes new values with arithmetic (e.g. N+1) without a bounding comparison, so the fixpoint may never be reached.

**How to fix:** Add a bound such as `N < 100`, or derive the value from finite data instead of counting up.

Instead of:
```mangle
nat(0).
nat(M) :- nat(N), M = fn:plus(N, 1).
```
write:
```mangle
nat(0).
nat(M) :- nat(N), N < 100, M = fn:plus(N, 1).
```

## E018

**Wrong function casing** - builtin, default severity: error

Built-in function names are case-sensitive and lowercase after `fn:` (`fn:sum`, not `fn:Sum`). Only type constructors used in `bound [...]` are capitalized (`fn:List`, `fn:Struct`, ...).

**How to fix:** Use the lowercase spelling given in the message.

Instead of:
```mangle
let S = fn:Sum(X)
```
write:
```mangle
let S = fn:sum(X)
```

## E019

**Cartesian product in rule body** - performance, default severity: warning

This atom shares no variable with the atoms before it, so evaluation pairs every row so far with every row of this atom (N x M intermediate tuples) before later premises filter them.

**How to fix:** Reorder the body so each atom joins on a variable already bound (the message names a premise that can be moved earlier), or split the rule through a helper predicate.

Instead of:
```mangle
p(X, Z) :- a(X), b(Z), link(X, Z).
```
write:
```mangle
p(X, Z) :- a(X), link(X, Z), b(Z).
```

## E020

**Function does not exist in Mangle** - builtin, default severity: error

This is a function that exists in SQL, Prolog, Python or other languages but not in Mangle. Mangle is a Datalog: control flow is expressed with rules, alternatives with several rules for the same head, and missing data with negation.

**How to fix:** Follow the replacement given in the message.

## E021

**Late filtering** - performance, default severity: warning

A comparison appears only after several joins even though its variables are available earlier. Filters shrink intermediate results; applying them as early as possible is the single most effective Datalog optimization.

**How to fix:** Move the comparison directly after the atom that binds its variables.

Instead of:
```mangle
p(X) :- big(X), a(X, Y), b(Y, Z), X > 10.
```
write:
```mangle
p(X) :- big(X), X > 10, a(X, Y), b(Y, Z).
```

## E022

**Late negation** - performance, default severity: warning

A negation that could filter rows right after the first atom is placed after further joins, which then process rows that will be discarded.

**How to fix:** Move the negated atom right after the atom that binds its variables.

## E023

**Massive Cartesian product** - performance, default severity: warning

Three or more body atoms share no variables at all, producing an N x M x K product.

**How to fix:** Join through shared variables; if the product is intended, consider whether a smaller helper relation can be precomputed.

## E024

**Declaration arguments must be variables** - declaration, default severity: error

`Decl pred(A, B, ...)` names the columns of a predicate; its arguments must be distinct variables. Types go into `bound [...]`.

**How to fix:** Use variables in the declared atom and put types in a bound list.

Instead of:
```mangle
Decl age(/person, /number).
```
write:
```mangle
Decl age(Person, Years) bound [/name, /number].
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/declarations.html

## E025

**Bound count does not match arity** - declaration, default severity: error

Each `bound [...]` list must contain exactly one type per argument of the declared predicate.

**How to fix:** Add or remove types so the bound list has one entry per argument (use /any for unconstrained columns).

## E026

**External predicate needs exactly one mode** - declaration, default severity: error

Predicates marked `external()` are computed by host code, which needs to know which arguments are inputs; they must declare exactly one `mode(...)`.

**How to fix:** Add a single mode descriptor, e.g. `descr [external(), mode('+', '-')]`.

## E027

**Odd number of key/value arguments** - style, default severity: error

`fn:map` and `fn:struct` take alternating keys and values.

**How to fix:** Use literal syntax: `[k1: v1, k2: v2]` for maps and `{/f1: v1, /f2: v2}` for structs.

## E030

**Pattern argument has the wrong type** - builtin, default severity: error

The pattern of `:string:starts_with`, `:string:ends_with` and `:string:contains` must be a string: a string literal, a variable bound to a string by an earlier premise, or a function that returns one (v0.7 substitutes and evaluates it). A constant of another type, such as the name `/ab`, is a run-time error ("2nd arguments must be string constant"). `:match_prefix` needs a name constant; a variable prefix fails strict type checking.

**How to fix:** Use a string pattern for the string tests (convert a name with `fn:name:to_string`), and a literal name such as `/users` for `:match_prefix`.

Instead of:
```mangle
hit(H) :- hay(H), :string:contains(H, /ab).
```
write:
```mangle
hit(H) :- hay(H), :string:contains(H, "ab").
```

## E031

**Package name must be lowercase** - declaration, default severity: error

Package names are part of predicate names, which are lowercase in Mangle.

**How to fix:** Rename the package to lowercase.

## E032

**Invalid name constant** - style, default severity: error

Name constants are `/`-separated paths of non-empty parts, like /a/b/c.

**How to fix:** Remove empty parts (`//`) and trailing slashes.

## E033

**Destructuring target must be a variable** - builtin, default severity: error

`:match_pair(P, A, B)` and `:match_cons(L, H, T)` bind their 2nd and 3rd arguments; these must be variables.

**How to fix:** Use variables, then constrain them with `=` if needed.

Instead of:
```mangle
:match_cons(L, 1, T)
```
write:
```mangle
:match_cons(L, H, T), H = 1
```

## E034

**Field selector must be a constant** - builtin, default severity: error

The field/key argument of `:match_field` / `:match_entry` selects what to look up and must be a constant (e.g. `/name`).

**How to fix:** Use a name constant for struct fields: `:match_field(S, /name, N)`.

## E035

**Division by zero** - builtin, default severity: error

The divisor of `fn:div`, `fn:float:div` or `fn:mod` is the constant 0; evaluation always fails with a division-by-zero error.

**How to fix:** Use a non-zero divisor, or guard the computation with a condition such as `D != 0` before dividing by a variable.

## E036

**group_by arguments must be variables** - transform, default severity: error

`fn:group_by` takes the key variables of the aggregation; constants or expressions are not allowed.

**How to fix:** Compute the key in the body (`K = fn:...`) and group by K.

## E037

**Duplicate variable in group_by** - transform, default severity: error

Each grouping key must be distinct.

**How to fix:** Remove the duplicate variable.

## E038

**Invalid string escape** - style, default severity: error

Supported escapes: \n \t \r \\ \" \' \xHH and \u{HHHH}.

**How to fix:** Fix or double the backslash.

## E039

**Wildcard in rule head** - style, default severity: warning

`_` in a head produces a column without a value; this is almost always a mistake.

**How to fix:** Use a variable bound in the body, or drop the column from the head predicate.

## E040

**Predicate arity mismatch** - declaration, default severity: error

In Mangle a predicate is identified by name *and* arity; `p/2` and `p/3` are different predicates. This call uses an arity for which no clause or declaration exists.

**How to fix:** Pass the number of arguments listed in the message (use `_` for columns you do not need).

Instead of:
```mangle
edge(/a, /b).
start(X) :- edge(X).
```
write:
```mangle
edge(/a, /b).
start(X) :- edge(X, _).
```

## E041

**Private predicate used from another package** - declaration, default severity: error

Predicates declared with `descr [private()]` are only visible inside their own package (the part of the name before the last `.`).

**How to fix:** Use a public predicate of that package, or remove `private()` from its declaration.

## E043

**Transform redefines a body variable** - transform, default severity: error

`let X = ...` in a transform introduces a new variable; X must not already be bound by the rule body.

**How to fix:** Pick a new variable name for the transform result.

Instead of:
```mangle
p(X) :- q(X) |> let X = fn:plus(X, 1).
```
write:
```mangle
p(Y) :- q(X) |> let Y = fn:plus(X, 1).
```

## E044

**Duplicate declaration** - declaration, default severity: error

A predicate (name/arity) may be declared only once (upstream issue #25).

**How to fix:** Merge the declarations; use several `bound [...]` lists in one Decl for alternatives.

Instead of:
```mangle
Decl p(X) bound [/number].
Decl p(X) bound [/string].
```
write:
```mangle
Decl p(X) bound [/number] bound [/string].
```

## E045

**Transform without body** - transform, default severity: error

A transform (`|> ...`) operates on the rows produced by a rule body; a fact has no rows.

**How to fix:** Add a body, or compute the value directly in a fact.

## E046

**Declaration arity mismatch** - declaration, default severity: error

The declared arity differs from every clause that defines the predicate.

**How to fix:** Make the Decl and the clauses use the same number of arguments.

## E047

**Variable not available after group_by** - transform, default severity: error

After grouping, only the group keys and values defined by earlier `let` statements exist; per-row body variables are gone (they were aggregated away).

**How to fix:** Add the variable to fn:group_by(...), or aggregate it with a reducer first.

Instead of:
```mangle
|> do fn:group_by(K), let Y = fn:plus(V, 1)
```
write:
```mangle
|> do fn:group_by(K), let S = fn:sum(V), let Y = fn:plus(S, 1)
```

## E048

**Multiple chained transforms** - transform, default severity: error

Mangle supports at most one transform per rule (`|> ... |> ...` is not implemented upstream).

**How to fix:** Split the computation into two rules: the first aggregates into a helper predicate, the second transforms it.

## E049

**Head variable not grouped or aggregated** - transform, default severity: error

In an aggregating rule every head variable must be a group_by key or defined by a `let` in the transform, exactly like SQL's "must appear in GROUP BY or an aggregate".

**How to fix:** Add the variable to fn:group_by(...) or define it with `let`.

Instead of:
```mangle
c(Dept, Name, N) :- emp(Dept, Name) |> do fn:group_by(Dept), let N = fn:count().
```
write:
```mangle
c(Dept, N) :- emp(Dept, _) |> do fn:group_by(Dept), let N = fn:count().
```

## E050

**Reducer in let-transform** - transform, default severity: error

A transform that starts with `let` is a per-row transform; reducers (and `do` statements) are only meaningful after `do fn:group_by(...)`.

**How to fix:** Start the transform with `do fn:group_by(...)` to aggregate.

## E051

**Multiple doc descriptors** - declaration, default severity: error

`descr [...]` may contain at most one `doc(...)` atom.

**How to fix:** Merge the documentation strings into one doc("...", "...") atom.

## E052

**Empty doc descriptor** - declaration, default severity: error

`doc()` must contain at least one string.

**How to fix:** Write `doc("what this predicate means")`.

## E053

**Descriptor argument must be a string** - declaration, default severity: error

Arguments of `doc(...)` and the descriptions in `arg(Var, ...)` must be string constants.

**How to fix:** Quote the text.

## E054

**arg descriptor needs two arguments** - declaration, default severity: error

`arg(Var, "description")` documents one column and needs the variable and at least one string.

**How to fix:** Add the description string.

## E055

**arg descriptor must start with a variable** - declaration, default severity: error

The first argument of `arg(...)` names the documented column and must be one of the declared variables.

**How to fix:** Write `arg(X, "...")` with X from the declared atom.

## E056

**arg descriptor for unknown variable** - declaration, default severity: error

The variable in `arg(...)` does not occur in the declared atom.

**How to fix:** Use one of the declared variables (check spelling).

## E057

**Missing arg descriptors** - declaration, default severity: warning

If any column is documented with `arg(...)`, upstream requires all of them to be documented.

**How to fix:** Add `arg(...)` for the listed variables.

## E058

**Temporal annotation on non-temporal predicate** - temporal, default severity: error

The clause uses `@[...]` interval annotations, but the predicate is declared without `temporal()`.

**How to fix:** Add `descr [temporal()]` to the Decl, or remove the annotation.

**Upstream docs:** https://mangle.readthedocs.io/en/latest/temporal.html

## E059

**Temporal predicate without annotation** - temporal, default severity: error

Rules for predicates declared `temporal()` must say when the derived fact holds (`head(...)@[S, E] :- ...`).

**How to fix:** Add a head interval annotation.

**Upstream docs:** https://mangle.readthedocs.io/en/latest/temporal.html

## E060

**Reducer needs an argument** - transform, default severity: error

Variable-arity reducers such as fn:collect need at least one argument (what to collect).

**How to fix:** Pass the variable(s) to collect: `fn:collect(X)`. Use fn:count() to count rows.

## E061

**Malformed type expression** - declaration, default severity: error

Each entry of `bound [...]` must be a type: a base type (/any, /number, /float64, /string, /bytes, /name, /time, /duration), a name prefix such as /person, a type variable, or a structured type built with .List<T>, .Map<K, V>, .Pair<A, B>, .Tuple<A, B, C...>, .Option<T>, .Struct</field : T, opt /f : T>, .Union<T1, ...>, .Singleton</c>, .TaggedUnion</tag, /variant : .Struct<...>, ...>, .Fun<...> or .Rel<...>.

**How to fix:** Fix the constructor name, its number of arguments or the shape of its fields as described in the message.

Instead of:
```mangle
Decl p(X) bound [.List</string, /number>].
```
write:
```mangle
Decl p(X) bound [.List</string>].
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/typeexpressions.html

## E062

**Self-recursive temporal predicate** - temporal, default severity: warning

A temporal predicate that depends on itself can create an ever-growing number of intervals (interval explosion) unless intervals are coalesced or bounded.

**How to fix:** Bound the recursion with interval limits or make sure derived intervals are coalesced.

**Upstream docs:** https://mangle.readthedocs.io/en/latest/temporal.html

## E063

**Mutual recursion through temporal predicates** - temporal, default severity: error

Several predicates, at least one temporal, depend on each other in a cycle; upstream temporal evaluation may not terminate.

**How to fix:** Break the cycle or make only one predicate of the cycle temporal.

**Upstream docs:** https://mangle.readthedocs.io/en/latest/temporal.html

## E064

**Future operator in recursive temporal rule** - temporal, default severity: error

Future operators (`<+`, `[+`) inside a recursive temporal rule can generate facts arbitrarily far into the future.

**How to fix:** Use past operators (`<-`, `[-`) in recursive rules, or remove the recursion.

**Upstream docs:** https://mangle.readthedocs.io/en/latest/temporal.html

## E065

**Output argument must be a fresh variable** - safety, default severity: error

Some built-in predicates have output ("-") arguments: they bind a *fresh* variable, e.g. `:match_pair(P, First, Second)` binds First and Second. Passing a constant or an already-bound variable in an output position is rejected by upstream mode checking.

**How to fix:** Use a new variable in the output position and compare it afterwards with `=`.

Instead of:
```mangle
p(A) :- q(P, A), :match_pair(P, A, B).
```
write:
```mangle
p(A) :- q(P, A), :match_pair(P, A2, B), A2 = A.
```

## E066

**Variable is never bound** - safety, default severity: error

Every variable in a rule must get a value from somewhere. This variable only occurs in positions that consume values - input ("+") arguments of mode-declared predicates, function arguments or comparisons - so evaluation can never assign it.

**How to fix:** Bind the variable with a positive atom (in an output or unrestricted position) or an equality before it is used.

## E067

**Invalid unit for time function** - builtin, default severity: error

Time functions take their unit as a name constant, and each accepts only specific units: `fn:time:trunc` supports fixed-duration units (/day, /hour, /minute, /second, /millisecond, /microsecond, /nanosecond) in UTC; calendar units (/year, /month, /week, /day) need `fn:time:trunc_civil` / `fn:time:add_civil` with a timezone; `fn:time:format[_civil]` supports /year ... /nanosecond.

**How to fix:** Use one of the listed units, or switch to the `_civil` variant for calendar units.

Instead of:
```mangle
W = fn:time:trunc(T, /week)
```
write:
```mangle
W = fn:time:trunc_civil(T, "UTC", /week)
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/basictypes.html

## E068

**Function argument type mismatch** - type, default severity: error

An argument of a built-in function has a type the function cannot accept at runtime (e.g. a /string passed to `fn:plus`, or a /number where a /duration is expected). Types come from constants, declared `bound [...]`s of body predicates, and results of other built-ins.

**How to fix:** Convert the value (e.g. `fn:duration:from_seconds(N)`, `fn:number:to_string(N)`), use the variant for the right type (`fn:float:plus` for floats), or fix the declaration that gave the variable its type.

Instead of:
```mangle
later(T2) :- ev(T), T2 = fn:time:add(T, 60).
```
write:
```mangle
later(T2) :- ev(T), T2 = fn:time:add(T, fn:duration:from_seconds(60)).
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/basictypes.html

## E069

**Predicate argument type mismatch** - type, default severity: error

An argument of a built-in predicate has the wrong type. Comparisons are type-specific in Mangle: `<`/`:lt` compare /number only, `:float:lt` compares /float64 (no coercion), `:time:lt` compares /time and `:duration:lt` compares /duration.

**How to fix:** Use the comparison predicate for the value type, or convert the value first.

Instead of:
```mangle
hot(X) :- temp(X, C), C > 30.5.
```
write:
```mangle
hot(X) :- temp(X, C), :float:gt(C, 30.5).
```

## E070

**Fact does not match declared bounds** - type, default severity: error

The predicate has a `Decl ... bound [...]` and this fact matches none of its bound alternatives. A name constant used as a type (e.g. `/person`) admits only names strictly below it (`/person/alice`); a struct type requires its non-optional fields; a tagged union requires a valid tag.

**How to fix:** Fix the constant (often a missing name prefix) or widen the declaration.

Instead of:
```mangle
Decl works_at(P, C) bound [/person, /company].
works_at(/alice, /acme).
```
write:
```mangle
Decl works_at(P, C) bound [/person, /company].
works_at(/person/alice, /company/acme).
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/declarations.html

## E071

**Rule result does not match declared bounds** - type, default severity: error

The types inferred for this rule's head (from its body) are incompatible with the predicate's declared bounds, so every fact it could derive would violate the declaration.

**How to fix:** Fix the rule body (wrong join column or conversion) or the declaration.

## E072

**Variable has conflicting types** - type, default severity: error

The same variable is required to have two incompatible types (for example it joins a /number column with a /string column). No value can satisfy both, so the rule can never produce a result. Upstream bounds checking rejects such rules.

**How to fix:** Check that the join uses the right columns; use different variables if the values are unrelated.

Instead of:
```mangle
Decl age(P, A) bound [/name, /number].
Decl email(P, E) bound [/name, /string].
bad(P) :- age(P, X), email(P, X).
```
write:
```mangle
ok(P) :- age(P, _), email(P, _).
```

## E073

**Comparison of incompatible types** - type, default severity: warning

The two sides of `=` or `!=` can never hold the same value because their types are disjoint (e.g. a /string and a /number). Mangle equality is syntactic and never converts: `"1" = 1` is false. An `=` like this makes the rule dead; a `!=` is always true and redundant.

**How to fix:** Convert one side (e.g. `fn:number:to_string(N)`), or compare against a constant of the right type (`/active` is a name, `"active"` is a string).

Instead of:
```mangle
active(U) :- status(U, S), S = "active".   # S is declared /name
```
write:
```mangle
active(U) :- status(U, S), S = /active.
```

## E074

**Variable used only once** - style, default severity: warning

A named variable that occurs exactly once in a clause does not connect anything; it is usually a typo of another variable (e.g. `Person` vs `Persn`), which silently turns a join into a cross product or leaves a filter ineffective.

**How to fix:** If you mean "any value", write `_` instead. Otherwise fix the spelling so it matches the other occurrence. (Not reported in aggregating rules, where every named body variable keeps rows apart - see E080.)

Instead of:
```mangle
owns(P, C) :- person(P), car(Cr), owner(Cr, P).
```
write:
```mangle
owns(P, C) :- person(P), car(C), owner(C, P).
```

## E075

**Undefined predicate** - declaration, default severity: warning

The predicate is used in a rule body but has no clause and no declaration in this file. Upstream Mangle rejects programs that use undefined predicates; it is fine only if the predicate is defined in another file of the same program or supplied externally.

**How to fix:** Check the spelling (see the suggestion in the message), define the predicate, or add a `Decl` for it (with `descr [extensional()]` for predicates loaded from data).

## E076

**Use fn:count instead of collecting** - performance, default severity: info

Collecting all values of a group into a list only to take its length materializes every value; fn:collect keeps one entry per row, so the fn:count() reducer computes the same number directly.

**How to fix:** Replace `let L = fn:collect(X), let N = fn:list:len(L)` with `let N = fn:count()`. (fn:list:len(fn:collect_distinct(X)) counts distinct X values, which fn:count_distinct() does not match when rows have other columns, so it is left alone.)

Instead of:
```mangle
|> do fn:group_by(K), let L = fn:collect(V), let N = fn:list:len(L)
```
write:
```mangle
|> do fn:group_by(K), let N = fn:count()
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/aggregation.html

## E077

**Duplicate premise** - performance, default severity: warning

The same premise occurs twice in one rule body. It never changes the result but repeats the work.

**How to fix:** Remove the repetition.

## E078

**Unknown declaration descriptor** - declaration, default severity: warning

Unknown atoms inside `descr [...]` are silently ignored by upstream Mangle, so a misspelled descriptor has no effect.

**How to fix:** Use one of: doc, arg, mode, external, extensional, private, reflects, fundep, merge, deferred, temporal, name, synthetic, desugared.

## E079

**Invalid mode declaration** - declaration, default severity: warning

A `mode(...)` descriptor needs one quoted '+' (input), '-' (output) or '?' (either) per argument. Upstream silently ignores malformed modes, so the declaration would have no effect.

**How to fix:** Write e.g. mode('+', '-') with one entry per argument of the declared predicate.

## E080

**Wildcard merges rows before aggregation** - performance, default severity: warning

Upstream Mangle evaluates an aggregation whose body is more than one atom by first materializing the body into an internal relation over its named variables; `_` columns are not part of that relation (rewrite/rewrite.go). Relations are sets, so rows that differ only in `_` columns become one row before fn:count, fn:sum, fn:avg or fn:collect run - a silent under-count. (For the same reason, a variable used only once in an aggregating rule is not redundant: it keeps rows apart.)

**How to fix:** Name the column that distinguishes rows (e.g. an id) if every row must count; keep `_` only when merging such rows is what you want.

Instead of:
```mangle
total(S) :- sale(_, Amount), valid(Amount) |> do fn:group_by(), let S = fn:sum(Amount).
```
write:
```mangle
total(S) :- sale(Id, Amount), valid(Amount) |> do fn:group_by(), let S = fn:sum(Amount).
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/aggregation.html

## E081

**Negated external predicate never calls Go** - declaration, default severity: warning

A predicate declared `descr [external(), mode(...)]` is answered by a Go callback during evaluation, but only in positive premises. In v0.7, `engine/premise.go` answers a negated premise `!ext(...)` from the fact store alone and never calls the callback, so the negation is true whenever nothing happened to store that row: usually always.

**How to fix:** Call the external positively in a helper rule whose body binds its inputs, then negate the helper. The quick fix writes the helper from the rule's own positive premises.

Instead of:
```mangle
Decl ext(X, Y) descr [external(), mode('+', '-')].
miss(X) :- item(X), !ext(X, "hit").
```
write:
```mangle
ext_holds(X) :- item(X), ext(X, "hit").
miss(X) :- item(X), !ext_holds(X).
```

## E082

**Bound that strict checking can never satisfy** - type, default severity: warning

In v0.7 the bounds checker infers the base type of a constant (`/name` for `/high`), and `/name` does not conform to `fn:Singleton(/high)` or to a union of singletons. A related trap: Decl bounds have no boolean base type, so `/bool` is the name-prefix type of names under `/bool/`, and `/true` is not one of them. With strict checking (`AnalyzeAndCheckBounds(..., ErrorForBoundsMismatch)`) every fact and rule that writes such a column is rejected, including correct ones; without it the bound is not checked at all. `fn:TaggedUnion` is the exception: the checker reads its tags as `/name`.

**How to fix:** Declare the column `/name` (for booleans too), and enforce a closed vocabulary with an invariant relation that tests can query, e.g. `valid_sev(/low). valid_sev(/high). bad_sev(I, S) :- sev(I, S), !valid_sev(S).`

Instead of:
```mangle
Decl sev(I, S) bound [/name, fn:Union(fn:Singleton(/low), fn:Singleton(/high))].
```
write:
```mangle
Decl sev(I, S) bound [/name, /name].
valid_sev(/low). valid_sev(/high).
bad_sev(I, S) :- sev(I, S), !valid_sev(S).
```

## E083

**Zero-arity Decl breaks strict bounds checking** - declaration, default severity: warning

Upstream v0.7 strict bounds checking (`AnalyzeAndCheckBounds(..., ErrorForBoundsMismatch)`) fails the whole program on a zero-arity Decl that has no bound list, with "no bound decls in p()". Loose checking accepts it, and a zero-arity predicate without a Decl is fine either way. Verified on v0.7.0.

**How to fix:** Give the Decl an empty bound list.

Instead of:
```mangle
Decl ready().
```
write:
```mangle
Decl ready() bound [].
```

## E084

**:string:matches fails strict bounds checking** - builtin, default severity: warning

Upstream v0.7.0 added `:string:matches` (RE2 regular expressions) but not its entry in the built-in type table (`symbols.go` lists `:string:starts_with`, `:string:ends_with` and `:string:contains` only). Strict bounds checking therefore rejects any rule that uses it ("cannot find assignment that works for premise"). Loose analysis accepts it and evaluation is correct. Verified on v0.7.0.

**How to fix:** Under strict checking, use `:string:starts_with`, `:string:ends_with` or `:string:contains` where they suffice; otherwise run loose analysis until upstream adds the signature.

## P001

**Syntax error** - syntax, default severity: error

The source does not match the Mangle grammar. Every clause must end with a period; rules are written `head :- body.`; variables start with an uppercase letter; name constants start with `/`; functions start with `fn:`; built-in predicates start with `:`.

**How to fix:** Look at the reported position: typical causes are a missing `.` at the end of the previous clause, `,` vs `.` confusion, lowercase variables, or SQL/Prolog syntax that Mangle does not have (no `if`, `or`, `;`, `not`; negation is `!pred(...)`).

Instead of:
```mangle
ancestor(x, y) :- parent(x, y)
```
write:
```mangle
ancestor(X, Y) :- parent(X, Y).
```

**Upstream docs:** https://mangle.readthedocs.io/en/latest/syntax.html

