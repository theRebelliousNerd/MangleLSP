/**
 * Diagnostic catalog for the Mangle LSP and CLI.
 *
 * Single source of truth for every diagnostic code the analyzer can emit. Each
 * entry is written for a reader who has never seen Mangle before - typically a
 * coding agent - and explains *why* the rule exists, *how* to fix it, and shows
 * a minimal before/after example. The LSP (hover text, code descriptions), the
 * CLI (`mangle-cli explain`, JSON/text/SARIF output) and docs/DIAGNOSTICS.md are
 * all derived from this table.
 *
 * Invariants (enforced by test/analysis/diagnostics.test.ts):
 * - every code emitted anywhere in src/ has an entry here;
 * - codes are unique and never reused for a different meaning.
 */

export type DiagnosticCategory =
    | 'io'
    | 'syntax'
    | 'safety'
    | 'builtin'
    | 'type'
    | 'transform'
    | 'declaration'
    | 'stratification'
    | 'temporal'
    | 'performance'
    | 'style'
    | 'advice'
    | 'boundary';

export type CatalogSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticInfo {
    /** Stable code, e.g. "E002". */
    readonly code: string;
    /** Short title (used for SARIF rule names and headings). */
    readonly title: string;
    readonly category: DiagnosticCategory;
    /** Default severity of the diagnostic. */
    readonly severity: CatalogSeverity;
    /** What the rule means, in terms of Mangle semantics. */
    readonly explanation: string;
    /** How to fix it. */
    readonly fix: string;
    /** A minimal failing program and its corrected version. */
    readonly example?: { readonly bad: string; readonly good: string };
    /** Upstream documentation page (relative to the Mangle readthedocs). */
    readonly docs?: string;
}

/** Base URL of the upstream Mangle documentation. */
export const MANGLE_DOCS_BASE = 'https://mangle.readthedocs.io/en/latest/';

/** Location of the generated diagnostics reference in this repository. */
export const DIAGNOSTICS_DOC_URL = 'https://github.com/theRebelliousNerd/MangleLSP/blob/main/docs/DIAGNOSTICS.md';

const entries: DiagnosticInfo[] = [
    // ------------------------------------------------------------------ io/syntax
    {
        code: 'E000', title: 'File or I/O error', category: 'io', severity: 'error',
        explanation: 'The CLI could not read the input file (missing path, permissions, encoding).',
        fix: 'Check the path passed on the command line and that the file is readable UTF-8 text.',
    },
    {
        code: 'P001', title: 'Syntax error', category: 'syntax', severity: 'error',
        explanation: 'The source does not match the Mangle grammar. Every clause must end with a period; rules are written `head :- body.`; variables start with an uppercase letter; name constants start with `/`; functions start with `fn:`; built-in predicates start with `:`.',
        fix: 'Look at the reported position: typical causes are a missing `.` at the end of the previous clause, `,` vs `.` confusion, lowercase variables, or SQL/Prolog syntax that Mangle does not have (no `if`, `or`, `;`, `not`; negation is `!pred(...)`).',
        example: { bad: 'ancestor(x, y) :- parent(x, y)', good: 'ancestor(X, Y) :- parent(X, Y).' },
        docs: 'syntax.html',
    },

    // --------------------------------------------------------------------- safety
    {
        code: 'E001', title: 'Variables in facts must be ground', category: 'safety', severity: 'error',
        explanation: 'A fact (a clause without `:-` body) states something unconditionally true, so it cannot contain variables: `foo(X).` would mean "foo holds for every possible value", which Datalog cannot represent.',
        fix: 'Replace the variable with a constant, or turn the fact into a rule whose body binds the variable.',
        example: { bad: 'likes(X, /pizza).', good: 'likes(X, /pizza) :- person(X).' },
    },
    {
        code: 'E002', title: 'Range restriction violation', category: 'safety', severity: 'error',
        explanation: 'Every variable in a rule head must be bound by the body: by a positive atom, by `X = <constant or bound expression>`, by a transform `let`, or by an input mode declaration. Otherwise the rule would derive infinitely many facts. This is the Datalog "safety" / range-restriction condition.',
        fix: 'Add a positive body atom that produces the variable, bind it with `=`, or compute it in a `|> let` transform. Check for typos: a head variable spelled differently from the body variable is unbound.',
        example: { bad: 'adult(Name) :- person(N, Age), Age >= 18.', good: 'adult(Name) :- person(Name, Age), Age >= 18.' },
    },
    {
        code: 'E003', title: 'Variables in negation must be bound', category: 'safety', severity: 'error',
        explanation: 'Negation (`!pred(...)`) is negation-as-failure: it can only check that a *specific* tuple is absent. All its variables must be bound by positive premises of the same rule, anywhere in the body: Mangle v0.7 delays a negation until the premises that bind its variables have run. A variable that no positive premise binds is rejected ("variable X is not bound"), and so is `_` inside a negation, because the checker turns each `_` into a fresh variable that nothing binds: `!r(X, _)` does not mean "no r with any second value".',
        fix: 'Bind the variable with a positive atom. To test "no tuple with any value here", project the columns you care about into a helper predicate and negate that (the quick fix writes the helper).',
        example: {
            bad: 'lonely(X) :- person(X), !friend(X, _).',
            good: 'has_friend(X) :- friend(X, _).\nlonely(X) :- person(X), !has_friend(X).',
        },
        docs: 'negation.html',
    },
    {
        code: 'E004', title: 'Variables in comparison must be bound', category: 'safety', severity: 'error',
        explanation: 'Comparisons only test values; they never produce them. `<`, `<=`, `>`, `>=` and the `:float:` comparisons need both sides bound by an *earlier* premise (v0.7 rejects the rule otherwise: "move the subgoal to the right"). `!=` is different: like a negation it waits until its variables are bound, so its position does not matter, but some premise must still bind them.',
        fix: 'Move the comparison after the atom that binds the variable, or add such an atom. For `!=`, make sure a positive premise or equality binds both sides.',
        example: { bad: 'big(X) :- X > 100, size(X).', good: 'big(X) :- size(X), X > 100.' },
    },
    {
        code: 'E065', title: 'Output argument must be a fresh variable', category: 'safety', severity: 'error',
        explanation: 'Some built-in predicates have output ("-") arguments: they bind a *fresh* variable, e.g. `:match_pair(P, First, Second)` binds First and Second. Passing a constant or an already-bound variable in an output position is rejected by upstream mode checking.',
        fix: 'Use a new variable in the output position and compare it afterwards with `=`.',
        example: { bad: 'p(A) :- q(P, A), :match_pair(P, A, B).', good: 'p(A) :- q(P, A), :match_pair(P, A2, B), A2 = A.' },
    },
    {
        code: 'E066', title: 'Variable is never bound', category: 'safety', severity: 'error',
        explanation: 'Every variable in a rule must get a value from somewhere. This variable only occurs in positions that consume values - input ("+") arguments of mode-declared predicates, function arguments or comparisons - so evaluation can never assign it.',
        fix: 'Bind the variable with a positive atom (in an output or unrestricted position) or an equality before it is used.',
    },

    // -------------------------------------------------------------------- builtin
    {
        code: 'E005', title: 'Unknown built-in predicate', category: 'builtin', severity: 'error',
        explanation: 'Names starting with `:` are reserved for built-in predicates, and this one does not exist. User predicates must start with a lowercase letter and must not start with `:`.',
        fix: 'Use one of the built-ins suggested in the message (hover a `:` name to see its signature), or rename your predicate without the leading colon.',
        example: { bad: 'p(S) :- s(S), :string:startswith(S, "a").', good: 'p(S) :- s(S), :string:starts_with(S, "a").' },
        docs: 'builtins.html',
    },
    {
        code: 'E006', title: 'Built-in predicate arity mismatch', category: 'builtin', severity: 'error',
        explanation: 'The built-in predicate was called with the wrong number of arguments.',
        fix: 'Check the signature in the message (or hover the predicate).',
    },
    {
        code: 'E007', title: 'Built-in predicate input not bound', category: 'builtin', severity: 'error',
        explanation: 'Input ("+") arguments of built-in predicates must be constants or variables bound by an earlier premise; built-ins cannot enumerate values for them. Mangle evaluates the body left to right for built-ins.',
        fix: 'Move the built-in to the right of the atom that binds the variable ("move the subgoal to the right").',
        example: { bad: 'p(X) :- :lt(X, 10), num(X).', good: 'p(X) :- num(X), :lt(X, 10).' },
    },
    {
        code: 'E008', title: 'Unknown built-in function', category: 'builtin', severity: 'error',
        explanation: 'Names starting with `fn:` are reserved for built-in functions and this one does not exist. Mangle has a small, fixed function library; there are no user-defined functions.',
        fix: 'Use one of the suggested functions, or express the computation with rules. Hover any `fn:` name to see its signature.',
        docs: 'builtins.html',
    },
    {
        code: 'E009', title: 'Built-in function arity mismatch', category: 'builtin', severity: 'error',
        explanation: 'The built-in function was applied to the wrong number of arguments.',
        fix: 'Check the signature in the message (or hover the function).',
    },
    {
        code: 'E010', title: 'Unbound variable in function argument', category: 'builtin', severity: 'error',
        explanation: 'Functions are evaluated, not solved: all their arguments must already have values.',
        fix: 'Bind the variable with an atom before the function application.',
        example: { bad: 'p(Y) :- Y = fn:plus(X, 1), num(X).', good: 'p(Y) :- num(X), Y = fn:plus(X, 1).' },
    },
    {
        code: 'E014', title: 'Unbound variable in function application', category: 'builtin', severity: 'error',
        explanation: 'In `V = fn:f(...)`, every variable inside the function application must be bound before the equality is evaluated.',
        fix: 'Bind the arguments first, then compute.',
    },
    {
        code: 'E018', title: 'Wrong function casing', category: 'builtin', severity: 'error',
        explanation: 'Built-in function names are case-sensitive and lowercase after `fn:` (`fn:sum`, not `fn:Sum`). Only type constructors used in `bound [...]` are capitalized (`fn:List`, `fn:Struct`, ...).',
        fix: 'Use the lowercase spelling given in the message.',
        example: { bad: 'let S = fn:Sum(X)', good: 'let S = fn:sum(X)' },
    },
    {
        code: 'E020', title: 'Function does not exist in Mangle', category: 'builtin', severity: 'error',
        explanation: 'This is a function that exists in SQL, Prolog, Python or other languages but not in Mangle. Mangle is a Datalog: control flow is expressed with rules, alternatives with several rules for the same head, and missing data with negation.',
        fix: 'Follow the replacement given in the message.',
    },
    {
        code: 'E030', title: 'Pattern argument has the wrong type', category: 'builtin', severity: 'error',
        explanation: 'The pattern of `:string:starts_with`, `:string:ends_with` and `:string:contains` must be a string: a string literal, a variable bound to a string by an earlier premise, or a function that returns one (v0.7 substitutes and evaluates it). A constant of another type, such as the name `/ab`, is a run-time error ("2nd arguments must be string constant"). `:match_prefix` needs a name constant; a variable prefix fails strict type checking.',
        fix: 'Use a string pattern for the string tests (convert a name with `fn:name:to_string`), and a literal name such as `/users` for `:match_prefix`.',
        example: { bad: 'hit(H) :- hay(H), :string:contains(H, /ab).', good: 'hit(H) :- hay(H), :string:contains(H, "ab").' },
    },
    {
        code: 'E033', title: 'Destructuring target must be a variable', category: 'builtin', severity: 'error',
        explanation: '`:match_pair(P, A, B)` and `:match_cons(L, H, T)` bind their 2nd and 3rd arguments; these must be variables.',
        fix: 'Use variables, then constrain them with `=` if needed.',
        example: { bad: ':match_cons(L, 1, T)', good: ':match_cons(L, H, T), H = 1' },
    },
    {
        code: 'E034', title: 'Field selector must be a constant', category: 'builtin', severity: 'error',
        explanation: 'The field/key argument of `:match_field` / `:match_entry` selects what to look up and must be a constant (e.g. `/name`).',
        fix: 'Use a name constant for struct fields: `:match_field(S, /name, N)`.',
    },
    {
        code: 'E035', title: 'Division by zero', category: 'builtin', severity: 'error',
        explanation: 'The divisor of `fn:div`, `fn:float:div` or `fn:mod` is the constant 0; evaluation always fails with a division-by-zero error.',
        fix: 'Use a non-zero divisor, or guard the computation with a condition such as `D != 0` before dividing by a variable.',
    },
    {
        code: 'E067', title: 'Invalid unit for time function', category: 'builtin', severity: 'error',
        explanation: 'Time functions take their unit as a name constant, and each accepts only specific units: `fn:time:trunc` supports fixed-duration units (/day, /hour, /minute, /second, /millisecond, /microsecond, /nanosecond) in UTC; calendar units (/year, /month, /week, /day) need `fn:time:trunc_civil` / `fn:time:add_civil` with a timezone; `fn:time:format[_civil]` supports /year ... /nanosecond.',
        fix: 'Use one of the listed units, or switch to the `_civil` variant for calendar units.',
        example: { bad: 'W = fn:time:trunc(T, /week)', good: 'W = fn:time:trunc_civil(T, "UTC", /week)' },
        docs: 'basictypes.html',
    },

    // ----------------------------------------------------------------------- type
    {
        code: 'E068', title: 'Function argument type mismatch', category: 'type', severity: 'error',
        explanation: 'An argument of a built-in function has a type the function cannot accept at runtime (e.g. a /string passed to `fn:plus`, or a /number where a /duration is expected). Types come from constants, declared `bound [...]`s of body predicates, and results of other built-ins.',
        fix: 'Convert the value (e.g. `fn:duration:from_seconds(N)`, `fn:number:to_string(N)`), use the variant for the right type (`fn:float:plus` for floats), or fix the declaration that gave the variable its type.',
        example: { bad: 'later(T2) :- ev(T), T2 = fn:time:add(T, 60).', good: 'later(T2) :- ev(T), T2 = fn:time:add(T, fn:duration:from_seconds(60)).' },
        docs: 'basictypes.html',
    },
    {
        code: 'E069', title: 'Predicate argument type mismatch', category: 'type', severity: 'error',
        explanation: 'An argument of a built-in predicate has the wrong type. Comparisons are type-specific in Mangle: `<`/`:lt` compare /number only, `:float:lt` compares /float64 (no coercion), `:time:lt` compares /time and `:duration:lt` compares /duration.',
        fix: 'Use the comparison predicate for the value type, or convert the value first.',
        example: { bad: 'hot(X) :- temp(X, C), C > 30.5.', good: 'hot(X) :- temp(X, C), :float:gt(C, 30.5).' },
    },
    {
        code: 'E070', title: 'Fact does not match declared bounds', category: 'type', severity: 'error',
        explanation: 'The predicate has a `Decl ... bound [...]` and this fact matches none of its bound alternatives. A name constant used as a type (e.g. `/person`) admits only names strictly below it (`/person/alice`); a struct type requires its non-optional fields; a tagged union requires a valid tag.',
        fix: 'Fix the constant (often a missing name prefix) or widen the declaration.',
        example: { bad: 'Decl works_at(P, C) bound [/person, /company].\nworks_at(/alice, /acme).', good: 'Decl works_at(P, C) bound [/person, /company].\nworks_at(/person/alice, /company/acme).' },
        docs: 'declarations.html',
    },
    {
        code: 'E071', title: 'Rule result does not match declared bounds', category: 'type', severity: 'error',
        explanation: 'The types inferred for this rule\'s head (from its body) are incompatible with the predicate\'s declared bounds, so every fact it could derive would violate the declaration.',
        fix: 'Fix the rule body (wrong join column or conversion) or the declaration.',
    },
    {
        code: 'E072', title: 'Variable has conflicting types', category: 'type', severity: 'error',
        explanation: 'The same variable is required to have two incompatible types (for example it joins a /number column with a /string column). No value can satisfy both, so the rule can never produce a result. Upstream bounds checking rejects such rules.',
        fix: 'Check that the join uses the right columns; use different variables if the values are unrelated.',
        example: { bad: 'Decl age(P, A) bound [/name, /number].\nDecl email(P, E) bound [/name, /string].\nbad(P) :- age(P, X), email(P, X).', good: 'ok(P) :- age(P, _), email(P, _).' },
    },
    {
        code: 'E073', title: 'Comparison of incompatible types', category: 'type', severity: 'warning',
        explanation: 'The two sides of `=` or `!=` can never hold the same value because their types are disjoint (e.g. a /string and a /number). Mangle equality is syntactic and never converts: `"1" = 1` is false. An `=` like this makes the rule dead; a `!=` is always true and redundant.',
        fix: 'Convert one side (e.g. `fn:number:to_string(N)`), or compare against a constant of the right type (`/active` is a name, `"active"` is a string).',
        example: { bad: 'active(U) :- status(U, S), S = "active".   # S is declared /name', good: 'active(U) :- status(U, S), S = /active.' },
    },

    // ------------------------------------------------------------------ transform
    {
        code: 'E011', title: 'Invalid transform structure', category: 'transform', severity: 'error',
        explanation: 'A `do` statement in a transform must be `do fn:group_by(...)` and it must come first. Aggregation in Mangle is written: `head :- body |> do fn:group_by(Keys...), let Agg = fn:reducer(...).`',
        fix: 'Start the transform with `do fn:group_by(...)`, or use only `let` statements for per-row computation.',
        example: { bad: 'total(S) :- sale(X) |> let S = fn:sum(X).', good: 'total(S) :- sale(X) |> do fn:group_by(), let S = fn:sum(X).' },
        docs: 'aggregation.html',
    },
    {
        code: 'E012', title: 'Unbound variable in group_by', category: 'transform', severity: 'error',
        explanation: 'Grouping keys must be variables bound by the rule body.',
        fix: 'Group by variables that appear in positive body atoms.',
    },
    {
        code: 'E036', title: 'group_by arguments must be variables', category: 'transform', severity: 'error',
        explanation: '`fn:group_by` takes the key variables of the aggregation; constants or expressions are not allowed.',
        fix: 'Compute the key in the body (`K = fn:...`) and group by K.',
    },
    {
        code: 'E037', title: 'Duplicate variable in group_by', category: 'transform', severity: 'error',
        explanation: 'Each grouping key must be distinct.',
        fix: 'Remove the duplicate variable.',
    },
    {
        code: 'E043', title: 'Transform redefines a body variable', category: 'transform', severity: 'error',
        explanation: '`let X = ...` in a transform introduces a new variable; X must not already be bound by the rule body.',
        fix: 'Pick a new variable name for the transform result.',
        example: { bad: 'p(X) :- q(X) |> let X = fn:plus(X, 1).', good: 'p(Y) :- q(X) |> let Y = fn:plus(X, 1).' },
    },
    {
        code: 'E045', title: 'Transform without body', category: 'transform', severity: 'error',
        explanation: 'A transform (`|> ...`) operates on the rows produced by a rule body; a fact has no rows.',
        fix: 'Add a body, or compute the value directly in a fact.',
    },
    {
        code: 'E047', title: 'Variable not available after group_by', category: 'transform', severity: 'error',
        explanation: 'After grouping, only the group keys and values defined by earlier `let` statements exist; per-row body variables are gone (they were aggregated away).',
        fix: 'Add the variable to fn:group_by(...), or aggregate it with a reducer first.',
        example: { bad: '|> do fn:group_by(K), let Y = fn:plus(V, 1)', good: '|> do fn:group_by(K), let S = fn:sum(V), let Y = fn:plus(S, 1)' },
    },
    {
        code: 'E048', title: 'Multiple chained transforms', category: 'transform', severity: 'error',
        explanation: 'Mangle supports at most one transform per rule (`|> ... |> ...` is not implemented upstream).',
        fix: 'Split the computation into two rules: the first aggregates into a helper predicate, the second transforms it.',
    },
    {
        code: 'E049', title: 'Head variable not grouped or aggregated', category: 'transform', severity: 'error',
        explanation: 'In an aggregating rule every head variable must be a group_by key or defined by a `let` in the transform, exactly like SQL\'s "must appear in GROUP BY or an aggregate".',
        fix: 'Add the variable to fn:group_by(...) or define it with `let`.',
        example: { bad: 'c(Dept, Name, N) :- emp(Dept, Name) |> do fn:group_by(Dept), let N = fn:count().', good: 'c(Dept, N) :- emp(Dept, _) |> do fn:group_by(Dept), let N = fn:count().' },
    },
    {
        code: 'E050', title: 'Reducer in let-transform', category: 'transform', severity: 'error',
        explanation: 'A transform that starts with `let` is a per-row transform; reducers (and `do` statements) are only meaningful after `do fn:group_by(...)`.',
        fix: 'Start the transform with `do fn:group_by(...)` to aggregate.',
    },
    {
        code: 'E060', title: 'Reducer needs an argument', category: 'transform', severity: 'error',
        explanation: 'Variable-arity reducers such as fn:collect need at least one argument (what to collect).',
        fix: 'Pass the variable(s) to collect: `fn:collect(X)`. Use fn:count() to count rows.',
    },

    // ---------------------------------------------------------------- declaration
    {
        code: 'E024', title: 'Declaration arguments must be variables', category: 'declaration', severity: 'error',
        explanation: '`Decl pred(A, B, ...)` names the columns of a predicate; its arguments must be distinct variables. Types go into `bound [...]`.',
        fix: 'Use variables in the declared atom and put types in a bound list.',
        example: { bad: 'Decl age(/person, /number).', good: 'Decl age(Person, Years) bound [/name, /number].' },
        docs: 'declarations.html',
    },
    {
        code: 'E025', title: 'Bound count does not match arity', category: 'declaration', severity: 'error',
        explanation: 'Each `bound [...]` list must contain exactly one type per argument of the declared predicate.',
        fix: 'Add or remove types so the bound list has one entry per argument (use /any for unconstrained columns).',
    },
    {
        code: 'E026', title: 'External predicate needs exactly one mode', category: 'declaration', severity: 'error',
        explanation: 'Predicates marked `external()` are computed by host code, which needs to know which arguments are inputs; they must declare exactly one `mode(...)`.',
        fix: "Add a single mode descriptor, e.g. `descr [external(), mode('+', '-')]`.",
    },
    {
        code: 'E031', title: 'Package name must be lowercase', category: 'declaration', severity: 'error',
        explanation: 'Package names are part of predicate names, which are lowercase in Mangle.',
        fix: 'Rename the package to lowercase.',
    },
    {
        code: 'E040', title: 'Predicate arity mismatch', category: 'declaration', severity: 'error',
        explanation: 'In Mangle a predicate is identified by name *and* arity; `p/2` and `p/3` are different predicates. This call uses an arity for which no clause or declaration exists.',
        fix: 'Pass the number of arguments listed in the message (use `_` for columns you do not need).',
        example: { bad: 'edge(/a, /b).\nstart(X) :- edge(X).', good: 'edge(/a, /b).\nstart(X) :- edge(X, _).' },
    },
    {
        code: 'E041', title: 'Private predicate used from another package', category: 'declaration', severity: 'error',
        explanation: 'Predicates declared with `descr [private()]` are only visible inside their own package (the part of the name before the last `.`).',
        fix: 'Use a public predicate of that package, or remove `private()` from its declaration.',
    },
    {
        code: 'E044', title: 'Duplicate declaration', category: 'declaration', severity: 'error',
        explanation: 'A predicate (name/arity) may be declared only once (upstream issue #25).',
        fix: 'Merge the declarations; use several `bound [...]` lists in one Decl for alternatives.',
        example: { bad: 'Decl p(X) bound [/number].\nDecl p(X) bound [/string].', good: 'Decl p(X) bound [/number] bound [/string].' },
    },
    {
        code: 'E046', title: 'Declaration arity mismatch', category: 'declaration', severity: 'error',
        explanation: 'The declared arity differs from every clause that defines the predicate.',
        fix: 'Make the Decl and the clauses use the same number of arguments.',
    },
    {
        code: 'E051', title: 'Multiple doc descriptors', category: 'declaration', severity: 'error',
        explanation: '`descr [...]` may contain at most one `doc(...)` atom.',
        fix: 'Merge the documentation strings into one doc("...", "...") atom.',
    },
    {
        code: 'E052', title: 'Empty doc descriptor', category: 'declaration', severity: 'error',
        explanation: '`doc()` must contain at least one string.',
        fix: 'Write `doc("what this predicate means")`.',
    },
    {
        code: 'E053', title: 'Descriptor argument must be a string', category: 'declaration', severity: 'error',
        explanation: 'Arguments of `doc(...)` and the descriptions in `arg(Var, ...)` must be string constants.',
        fix: 'Quote the text.',
    },
    {
        code: 'E054', title: 'arg descriptor needs two arguments', category: 'declaration', severity: 'error',
        explanation: '`arg(Var, "description")` documents one column and needs the variable and at least one string.',
        fix: 'Add the description string.',
    },
    {
        code: 'E055', title: 'arg descriptor must start with a variable', category: 'declaration', severity: 'error',
        explanation: 'The first argument of `arg(...)` names the documented column and must be one of the declared variables.',
        fix: 'Write `arg(X, "...")` with X from the declared atom.',
    },
    {
        code: 'E056', title: 'arg descriptor for unknown variable', category: 'declaration', severity: 'error',
        explanation: 'The variable in `arg(...)` does not occur in the declared atom.',
        fix: 'Use one of the declared variables (check spelling).',
    },
    {
        code: 'E057', title: 'Missing arg descriptors', category: 'declaration', severity: 'warning',
        explanation: 'If any column is documented with `arg(...)`, upstream requires all of them to be documented.',
        fix: 'Add `arg(...)` for the listed variables.',
    },
    {
        code: 'E061', title: 'Malformed type expression', category: 'declaration', severity: 'error',
        explanation: 'Each entry of `bound [...]` must be a type: a base type (/any, /number, /float64, /string, /bytes, /name, /time, /duration), a name prefix such as /person, a type variable, or a structured type built with .List<T>, .Map<K, V>, .Pair<A, B>, .Tuple<A, B, C...>, .Option<T>, .Struct</field : T, opt /f : T>, .Union<T1, ...>, .Singleton</c>, .TaggedUnion</tag, /variant : .Struct<...>, ...>, .Fun<...> or .Rel<...>.',
        fix: 'Fix the constructor name, its number of arguments or the shape of its fields as described in the message.',
        example: { bad: 'Decl p(X) bound [.List</string, /number>].', good: 'Decl p(X) bound [.List</string>].' },
        docs: 'typeexpressions.html',
    },
    {
        code: 'E075', title: 'Undefined predicate', category: 'declaration', severity: 'warning',
        explanation: 'The predicate is used in a rule body but has no clause and no declaration in this file. Upstream Mangle rejects programs that use undefined predicates; it is fine only if the predicate is defined in another file of the same program or supplied externally.',
        fix: 'Check the spelling (see the suggestion in the message), define the predicate, or add a `Decl` for it (with `descr [extensional()]` for predicates loaded from data).',
    },
    {
        code: 'E078', title: 'Unknown declaration descriptor', category: 'declaration', severity: 'warning',
        explanation: 'Unknown atoms inside `descr [...]` are silently ignored by upstream Mangle, so a misspelled descriptor has no effect.',
        fix: 'Use one of: doc, arg, mode, external, extensional, private, reflects, fundep, merge, deferred, temporal, name, synthetic, desugared.',
    },
    {
        code: 'E079', title: 'Invalid mode declaration', category: 'declaration', severity: 'warning',
        explanation: "A `mode(...)` descriptor needs one quoted '+' (input), '-' (output) or '?' (either) per argument. Upstream silently ignores malformed modes, so the declaration would have no effect.",
        fix: "Write e.g. mode('+', '-') with one entry per argument of the declared predicate.",
    },
    {
        code: 'E081', title: 'Negated external predicate never calls Go', category: 'declaration', severity: 'warning',
        explanation: 'A predicate declared `descr [external(), mode(...)]` is answered by a Go callback during evaluation, but only in positive premises. In v0.7, `engine/premise.go` answers a negated premise `!ext(...)` from the fact store alone and never calls the callback, so the negation is true whenever nothing happened to store that row: usually always.',
        fix: 'Call the external positively in a helper rule whose body binds its inputs, then negate the helper. The quick fix writes the helper from the rule\'s own positive premises.',
        example: {
            bad: 'Decl ext(X, Y) descr [external(), mode(\'+\', \'-\')].\nmiss(X) :- item(X), !ext(X, "hit").',
            good: 'ext_holds(X) :- item(X), ext(X, "hit").\nmiss(X) :- item(X), !ext_holds(X).',
        },
    },
    {
        code: 'E082', title: 'Bound that strict checking can never satisfy', category: 'type', severity: 'warning',
        explanation: 'In v0.7 the bounds checker infers the base type of a constant (`/name` for `/high`), and `/name` does not conform to `fn:Singleton(/high)` or to a union of singletons. A related trap: Decl bounds have no boolean base type, so `/bool` is the name-prefix type of names under `/bool/`, and `/true` is not one of them. With strict checking (`AnalyzeAndCheckBounds(..., ErrorForBoundsMismatch)`) every fact and rule that writes such a column is rejected, including correct ones; without it the bound is not checked at all. `fn:TaggedUnion` is the exception: the checker reads its tags as `/name`.',
        fix: 'Declare the column `/name` (for booleans too), and enforce a closed vocabulary with an invariant relation that tests can query, e.g. `valid_sev(/low). valid_sev(/high). bad_sev(I, S) :- sev(I, S), !valid_sev(S).`',
        example: {
            bad: 'Decl sev(I, S) bound [/name, fn:Union(fn:Singleton(/low), fn:Singleton(/high))].',
            good: 'Decl sev(I, S) bound [/name, /name].\nvalid_sev(/low). valid_sev(/high).\nbad_sev(I, S) :- sev(I, S), !valid_sev(S).',
        },
    },

    // ------------------------------------------------------------- stratification
    {
        code: 'E015', title: 'Negation cycle (unstratifiable program)', category: 'stratification', severity: 'error',
        explanation: 'A predicate depends on its own negation through a cycle of rules, e.g. `p :- !q.` and `q :- !p.`. Mangle evaluates negation stratum by stratum, which requires that negated predicates are fully computed first; cycles through negation have no well-defined meaning.',
        fix: 'Break the cycle: introduce a base predicate that does not depend on the negated one, or restructure the logic so negation only refers to lower strata.',
        docs: 'negation.html',
    },
    {
        code: 'E016', title: 'Recursion without base case', category: 'stratification', severity: 'warning',
        explanation: 'All clauses of this predicate are recursive, so it can never derive a first fact (bottom-up evaluation starts from base cases).',
        fix: 'Add a non-recursive clause, e.g. `path(X, Y) :- edge(X, Y).` next to the recursive one.',
    },
    {
        code: 'E017', title: 'Recursion generates unbounded values', category: 'stratification', severity: 'warning',
        explanation: 'A recursive rule computes new values with arithmetic (e.g. N+1) without a bounding comparison, so the fixpoint may never be reached.',
        fix: 'Add a bound such as `N < 100`, or derive the value from finite data instead of counting up.',
        example: { bad: 'nat(0).\nnat(M) :- nat(N), M = fn:plus(N, 1).', good: 'nat(0).\nnat(M) :- nat(N), N < 100, M = fn:plus(N, 1).' },
    },

    // ---------------------------------------------------------------- temporal
    {
        code: 'E058', title: 'Temporal annotation on non-temporal predicate', category: 'temporal', severity: 'error',
        explanation: 'The clause uses `@[...]` interval annotations, but the predicate is declared without `temporal()`.',
        fix: 'Add `descr [temporal()]` to the Decl, or remove the annotation.',
        docs: 'temporal.html',
    },
    {
        code: 'E059', title: 'Temporal predicate without annotation', category: 'temporal', severity: 'error',
        explanation: 'Rules for predicates declared `temporal()` must say when the derived fact holds (`head(...)@[S, E] :- ...`).',
        fix: 'Add a head interval annotation.',
        docs: 'temporal.html',
    },
    {
        code: 'E062', title: 'Self-recursive temporal predicate', category: 'temporal', severity: 'warning',
        explanation: 'A temporal predicate that depends on itself can create an ever-growing number of intervals (interval explosion) unless intervals are coalesced or bounded.',
        fix: 'Bound the recursion with interval limits or make sure derived intervals are coalesced.',
        docs: 'temporal.html',
    },
    {
        code: 'E063', title: 'Mutual recursion through temporal predicates', category: 'temporal', severity: 'error',
        explanation: 'Several predicates, at least one temporal, depend on each other in a cycle; upstream temporal evaluation may not terminate.',
        fix: 'Break the cycle or make only one predicate of the cycle temporal.',
        docs: 'temporal.html',
    },
    {
        code: 'E064', title: 'Future operator in recursive temporal rule', category: 'temporal', severity: 'error',
        explanation: 'Future operators (`<+`, `[+`) inside a recursive temporal rule can generate facts arbitrarily far into the future.',
        fix: 'Use past operators (`<-`, `[-`) in recursive rules, or remove the recursion.',
        docs: 'temporal.html',
    },

    // --------------------------------------------------------------- performance
    {
        code: 'E019', title: 'Cartesian product in rule body', category: 'performance', severity: 'warning',
        explanation: 'This atom shares no variable with the atoms before it, so evaluation pairs every row so far with every row of this atom (N x M intermediate tuples) before later premises filter them.',
        fix: 'Reorder the body so each atom joins on a variable already bound (the message names a premise that can be moved earlier), or split the rule through a helper predicate.',
        example: { bad: 'p(X, Z) :- a(X), b(Z), link(X, Z).', good: 'p(X, Z) :- a(X), link(X, Z), b(Z).' },
    },
    {
        code: 'E021', title: 'Late filtering', category: 'performance', severity: 'warning',
        explanation: 'A comparison appears only after several joins even though its variables are available earlier. Filters shrink intermediate results; applying them as early as possible is the single most effective Datalog optimization.',
        fix: 'Move the comparison directly after the atom that binds its variables.',
        example: { bad: 'p(X) :- big(X), a(X, Y), b(Y, Z), X > 10.', good: 'p(X) :- big(X), X > 10, a(X, Y), b(Y, Z).' },
    },
    {
        code: 'E022', title: 'Late negation', category: 'performance', severity: 'warning',
        explanation: 'A negation that could filter rows right after the first atom is placed after further joins, which then process rows that will be discarded.',
        fix: 'Move the negated atom right after the atom that binds its variables.',
    },
    {
        code: 'E023', title: 'Massive Cartesian product', category: 'performance', severity: 'warning',
        explanation: 'Three or more body atoms share no variables at all, producing an N x M x K product.',
        fix: 'Join through shared variables; if the product is intended, consider whether a smaller helper relation can be precomputed.',
    },
    {
        code: 'E076', title: 'Use fn:count instead of collecting', category: 'performance', severity: 'info',
        explanation: 'Collecting all values of a group into a list only to take its length materializes every value; fn:collect keeps one entry per row, so the fn:count() reducer computes the same number directly.',
        fix: 'Replace `let L = fn:collect(X), let N = fn:list:len(L)` with `let N = fn:count()`. (fn:list:len(fn:collect_distinct(X)) counts distinct X values, which fn:count_distinct() does not match when rows have other columns, so it is left alone.)',
        example: { bad: '|> do fn:group_by(K), let L = fn:collect(V), let N = fn:list:len(L)', good: '|> do fn:group_by(K), let N = fn:count()' },
        docs: 'aggregation.html',
    },
    {
        code: 'E077', title: 'Duplicate premise', category: 'performance', severity: 'warning',
        explanation: 'The same premise occurs twice in one rule body. It never changes the result but repeats the work.',
        fix: 'Remove the repetition.',
    },

    {
        code: 'E080', title: 'Wildcard merges rows before aggregation', category: 'performance', severity: 'warning',
        explanation: 'Upstream Mangle evaluates an aggregation whose body is more than one atom by first materializing the body into an internal relation over its named variables; `_` columns are not part of that relation (rewrite/rewrite.go). Relations are sets, so rows that differ only in `_` columns become one row before fn:count, fn:sum, fn:avg or fn:collect run - a silent under-count. (For the same reason, a variable used only once in an aggregating rule is not redundant: it keeps rows apart.)',
        fix: 'Name the column that distinguishes rows (e.g. an id) if every row must count; keep `_` only when merging such rows is what you want.',
        example: {
            bad: 'total(S) :- sale(_, Amount), valid(Amount) |> do fn:group_by(), let S = fn:sum(Amount).',
            good: 'total(S) :- sale(Id, Amount), valid(Amount) |> do fn:group_by(), let S = fn:sum(Amount).',
        },
        docs: 'aggregation.html',
    },

    // --------------------------------------------------------------------- style
    {
        code: 'E032', title: 'Invalid name constant', category: 'style', severity: 'error',
        explanation: 'Name constants are `/`-separated paths of non-empty parts, like /a/b/c.',
        fix: 'Remove empty parts (`//`) and trailing slashes.',
    },
    {
        code: 'E038', title: 'Invalid string escape', category: 'style', severity: 'error',
        explanation: 'Supported escapes: \\n \\t \\r \\\\ \\" \\\' \\xHH and \\u{HHHH}.',
        fix: 'Fix or double the backslash.',
    },
    {
        code: 'E039', title: 'Wildcard in rule head', category: 'style', severity: 'warning',
        explanation: '`_` in a head produces a column without a value; this is almost always a mistake.',
        fix: 'Use a variable bound in the body, or drop the column from the head predicate.',
    },
    {
        code: 'E027', title: 'Odd number of key/value arguments', category: 'style', severity: 'error',
        explanation: '`fn:map` and `fn:struct` take alternating keys and values.',
        fix: 'Use literal syntax: `[k1: v1, k2: v2]` for maps and `{/f1: v1, /f2: v2}` for structs.',
    },
    {
        code: 'E074', title: 'Variable used only once', category: 'style', severity: 'warning',
        explanation: 'A named variable that occurs exactly once in a clause does not connect anything; it is usually a typo of another variable (e.g. `Person` vs `Persn`), which silently turns a join into a cross product or leaves a filter ineffective.',
        fix: 'If you mean "any value", write `_` instead. Otherwise fix the spelling so it matches the other occurrence. (Not reported in aggregating rules, where every named body variable keeps rows apart - see E080.)',
        example: { bad: 'owns(P, C) :- person(P), car(Cr), owner(Cr, P).', good: 'owns(P, C) :- person(P), car(C), owner(C, P).' },
    },
    {
        code: 'E083', title: 'Zero-arity Decl breaks strict bounds checking', category: 'declaration', severity: 'warning',
        explanation: 'Upstream v0.7 strict bounds checking (`AnalyzeAndCheckBounds(..., ErrorForBoundsMismatch)`) fails the whole program on a zero-arity Decl that has no bound list, with "no bound decls in p()". Loose checking accepts it, and a zero-arity predicate without a Decl is fine either way. Verified on v0.7.0.',
        fix: 'Give the Decl an empty bound list.',
        example: { bad: 'Decl ready().', good: 'Decl ready() bound [].' },
    },

    {
        code: 'E084', title: ':string:matches fails strict bounds checking', category: 'builtin', severity: 'warning',
        explanation: 'Upstream v0.7.0 added `:string:matches` (RE2 regular expressions) but not its entry in the built-in type table (`symbols.go` lists `:string:starts_with`, `:string:ends_with` and `:string:contains` only). Strict bounds checking therefore rejects any rule that uses it ("cannot find assignment that works for premise"). Loose analysis accepts it and evaluation is correct. Verified on v0.7.0.',
        fix: 'Under strict checking, use `:string:starts_with`, `:string:ends_with` or `:string:contains` where they suffice; otherwise run loose analysis until upstream adds the signature.',
    },

    // --------------------------------------------------------------------- advice
    {
        code: 'A001', title: 'Arg-max joined back: use a merge lattice', category: 'advice', severity: 'info',
        explanation: 'Mangle has no arg-max reducer, so a common pattern takes `fn:max` (or `fn:min`) per group in one rule and joins the result back to the source in a second to find the winning row. That needs the whole relation and a second stratum. A Decl with `fundep([Key], [P])` and `merge([P], "better")` makes the relation keep one value per key, replaced whenever the deferred comparison rule prefers a new one, inside the fixpoint and inside recursion. Verified on v0.7: same answers as the join-back; ties keep the first winner instead of several rows. The engine replaces the old fact only on stores that support removal (its in-memory stores do; a temporal-store adapter does not, and then both facts stay).',
        fix: 'Add the lattice relation (the quick fix writes it from the aggregating rule) and switch the consumers to it.',
        example: {
            bad: 'latest_t(F, M) :- obs(F, T, _) |> do fn:group_by(F), let M = fn:max(T).\nlatest(F, V) :- latest_t(F, M), obs(F, M, V).',
            good: 'Decl best_obs(F, P) descr [fundep([F], [P]), merge([P], "obs_later")].\nDecl obs_later(P1, P2, B) descr [mode(\'+\', \'+\', \'-\'), deferred()].\nobs_later(P1, P2, P1) :- :match_pair(P1, T1, _), :match_pair(P2, T2, _), T1 >= T2.\nobs_later(P1, P2, P2) :- :match_pair(P1, T1, _), :match_pair(P2, T2, _), T1 < T2.\nbest_obs(F, fn:pair(T, V)) :- obs(F, T, V).',
        },
    },
    {
        code: 'A002', title: 'Parallel variant predicates: use a tagged union', category: 'advice', severity: 'info',
        explanation: 'Three or more predicates such as `tool_started_event`, `tool_failed_event`, `tool_done_event` are variants of one thing spread over several relations. A Decl bounded by `fn:TaggedUnion(/kind, /started, fn:Struct(...), ...)` keeps them in one relation: a rule can match one variant (`:match_field(E, /kind, K), K = /failed`) or all of them, and a new variant is one more tag instead of a new predicate. Tagged unions pass strict bounds checking in v0.7 (the checker types their tags as /name); unions of singletons do not (E082).',
        fix: 'Declare one relation with a tagged-union value column and assert one fact per event.',
    },
    {
        code: 'A003', title: 'Premise tests a value no writer produces', category: 'advice', severity: 'warning',
        explanation: 'Every rule and fact that writes this column of the predicate writes a name constant, and the constant this premise tests is not one of them, so the premise can never match and the rule derives nothing. This is the closed-vocabulary failure: a typo such as `/hihg`. A `fn:Singleton` union bound cannot catch it in v0.7 (E082); an invariant relation can: list the vocabulary as facts, derive violations with negation, and have a test assert there are none.',
        fix: 'Fix the constant (the quick fix offers the closest written value), and consider `valid_x(...)` facts plus a `bad_x(V) :- x(V), !valid_x(V).` invariant.',
        example: { bad: 'sev(/a, /high).\nurgent(I) :- sev(I, /hihg).', good: 'sev(/a, /high).\nurgent(I) :- sev(I, /high).' },
    },
    {
        code: 'A004', title: 'Clock comparison: use temporal facts', category: 'advice', severity: 'info',
        explanation: 'The rule reads a clock fact (`current_time(Now)`) and compares timestamps to decide whether something is recent, expired or due. Mangle has temporal facts: a Decl marked `temporal` holds facts valid over intervals, and operators such as `<-[0s, 24h] seen(X)` ("held at some point in the last 24 hours") read the evaluation time. Expiry needs no sweeper and no clock fact, and pinning the evaluation time replays a decision exactly. Verified on v0.7 (`recent(X) :- <-[0s, 24h] seen(X).`). Evaluation needs a temporal store and an evaluation time.',
        fix: 'Declare the fact temporal, assert it with its validity interval, and replace the comparison by a temporal operator.',
        docs: 'temporal.html',
    },
    {
        code: 'A005', title: 'Collecting pairs: use fn:collect_to_map', category: 'advice', severity: 'info',
        explanation: '`fn:collect(fn:pair(K, V))` builds a list of pairs that the host then turns into a map. `fn:collect_to_map(K, V)` builds the map in the aggregation: one answer-shaped fact per group that Go reads without assembling and that rules can query with `fn:map:get`. Verified on v0.7. Keys should be unique per group.',
        fix: 'Replace the reducer (quick fix).',
        example: { bad: 'm(U, L) :- kv(U, K, V) |> do fn:group_by(U), let L = fn:collect(fn:pair(K, V)).', good: 'm(U, M) :- kv(U, K, V) |> do fn:group_by(U), let M = fn:collect_to_map(K, V).' },
    },
    {
        code: 'A006', title: 'All paths, then pick one: use a merge lattice', category: 'advice', severity: 'info',
        explanation: 'A recursive relation accumulates a path or cost (`fn:list:append`, `fn:plus`) for every route, and a later aggregation keeps only the minimum or maximum. On a cyclic graph that recursion never finishes: verified on v0.7, a 5-edge cycle ran 38 s to the 100k fact limit. Declaring the recursive relation with `fundep` and `merge` keeps only the best path per key during the fixpoint (upstream `examples/shortest_path.mg`); the same cyclic graph then terminates with its 16 shortest paths.',
        fix: 'Add `descr [fundep([Source, Target], [Path]), merge([Path], "shorter")]` to the recursive relation and a deferred `shorter` rule, then drop the aggregation.',
        docs: 'aggregation.html',
    },

    // ------------------------------------------------------------------- boundary
    {
        code: 'B001', title: 'Rule reads a predicate nothing produces', category: 'boundary', severity: 'warning',
        explanation: 'A rule body reads this predicate, but no rule or fact in the module\'s .mg files derives it, no Go code asserts it, and its name appears nowhere else in Go. The rule compiles and never fires. Found by `mangle-cli boundary`, which scans the Go module with go/ast and judges the result with a Mangle program on the real engine.',
        fix: 'Make the producer assert it (with the Decl\'s shape), or delete the rule and the Decl.',
    },
    {
        code: 'B002', title: 'Declared predicate nothing produces or reads', category: 'boundary', severity: 'info',
        explanation: 'A Decl that no rule, fact or Go code produces, and nothing reads in .mg or Go. It is dead schema.',
        fix: 'Delete the Decl, or wire the producer and consumer it was meant for.',
    },
    {
        code: 'B003', title: 'Go asserts an undeclared predicate', category: 'boundary', severity: 'warning',
        explanation: 'Go asserts a fact whose predicate no .mg file declares or defines. No rule can read it (a typo, or a fact nobody consumes), and hosts that validate facts against Decls warn on it.',
        fix: 'Add the Decl (with bounds) to the owning schema file, or correct the predicate name.',
    },
    {
        code: 'B004', title: 'Go asserts a predicate with the wrong arity', category: 'boundary', severity: 'error',
        explanation: 'In Mangle the arity is part of the predicate: `p/3` and `p/2` are different relations. Go asserts this name with an arity that no Decl and no rule has, so every rule written against the declared arity never sees these facts.',
        fix: 'Make the Go fact match the Decl\'s arguments, or change the Decl (and its rules) if the Go shape is the intended one.',
    },
    {
        code: 'B005', title: 'Go queries a predicate the program never defines', category: 'boundary', severity: 'warning',
        explanation: 'Go queries a predicate that no .mg file declares or defines, so the query always returns nothing.',
        fix: 'Fix the name, or add the rule that derives it.',
    },
    {
        code: 'B006', title: 'Asserted but never read', category: 'boundary', severity: 'info',
        explanation: 'Go asserts this declared predicate, but no rule reads it, no Go code queries it, and its name appears nowhere else in Go. The facts are written and ignored.',
        fix: 'Write the rule that uses it, or stop asserting it.',
    },
    {
        code: 'B007', title: 'Go builds the wrong constant type for a column', category: 'boundary', severity: 'error',
        explanation: 'The Decl bounds this argument with a base type, and Go builds a value that cannot become a constant of that type: a float64 for a /number column, an int for /float64, a name (`MangleAtom`, or a literal "/x" string that codeNERD\'s kernel turns into a name) for /string, or a plain string literal for /name. A join between a name and a string never matches, so rules silently derive nothing; strict bounds checking would reject the fact. Shapes the scan cannot know (a string variable) are never reported.',
        fix: 'Build the declared representation at the producer: `types.MangleAtom(x)` for /name, `types.MangleString(x)` or a plain string for /string, `int64(...)` for /number, `float64(...)` for /float64. Or fix the Decl if Go\'s shape is the intended one.',
    },
    {
        code: 'B008', title: 'External predicate without a Go callback', category: 'boundary', severity: 'warning',
        explanation: 'The Decl says `descr [external(), mode(...)]`, so evaluation expects a Go callback, but the module registers none for this name and arity. Hosts reject or silently empty the predicate.',
        fix: 'Register the callback with the Decl\'s name, arity and modes, or remove `external()`.',
    },
    {
        code: 'B009', title: 'Go callback without an external Decl', category: 'boundary', severity: 'warning',
        explanation: 'Go registers an external-predicate callback, but no .mg Decl marks the predicate `external()` at this arity, so the engine never calls it.',
        fix: 'Declare the predicate with `descr [external(), mode(...)]` matching the callback.',
    },
    {
        code: 'B010', title: 'Callback modes disagree with the Decl', category: 'boundary', severity: 'error',
        explanation: 'The modes the Go callback is registered with (+ input, - output) differ from the Decl\'s `mode(...)`. The engine binds arguments by the Decl, so the callback receives inputs it did not expect.',
        fix: 'Make the two agree; the Decl is what analysis and evaluation use.',
    },
    {
        code: 'B011', title: 'Rule negates an external; its Go callback never runs', category: 'boundary', severity: 'warning',
        explanation: 'The cross-file form of E081: a rule negates an external predicate, and the engine answers negations from stored facts only (v0.7 engine/premise.go), so the Go callback listed with the finding is never called for it.',
        fix: 'Call the external positively in a helper rule that binds its inputs, then negate the helper.',
    },
    {
        code: 'B012', title: 'Rule reads a predicate with no recognized producer', category: 'boundary', severity: 'info',
        explanation: 'As B001, except that Go mentions the name somewhere the scan does not read as an assert: a list of predicate names, a map, a log line or a producer whose predicate is computed. Check the listed places; if none of them asserts the predicate, the rule never fires.',
        fix: 'Assert the predicate where it is produced, with the Decl\'s shape.',
    },
    {
        code: 'B013', title: 'Rule can never fire: a premise is starved', category: 'boundary', severity: 'warning',
        explanation: 'A positive premise of this rule can never hold: nothing produces it (no fact, no Go assert, no external callback, no recognized Go producer), or every rule that derives it is itself blocked by such a premise. The check is a least fixpoint over the whole module (a predicate is live when a fact of it can exist or a rule for it can fire; a rule fires when every positive body atom is live), so a block that travels through several derived predicates is found. Negated premises never block (an empty relation makes the negation true). The finding names the first starved premise, and its proof lists the absences it rests on.',
        fix: 'Wire a producer for the starved premise (a Go assert with the Decl\'s shape, a fact, or a rule that can fire), or delete the rule and everything that only exists to read its head.',
    },
    {
        code: 'B014', title: 'Conclusion nothing reads', category: 'boundary', severity: 'warning',
        explanation: 'The predicate is derived by rules, but no rule premise (positive or negated) of a needed predicate reads it and no Go query names it. A predicate is needed when Go queries it (a query call the host profile knows) or a needed rule reads it; a bare string literal naming it elsewhere does not count. Facts only stated as ground data are tables, not conclusions, and are not reported.',
        fix: 'Query it from the code that should act on it, read it in a rule that is itself used, or delete the rules that derive it. If Go reaches it through a query helper the scan does not know, list the helper in the project profile (`queryMethods` in .mangle/oracle-profile.json).',
    },
];

/** The catalog, keyed by code. */
export const DIAGNOSTIC_CATALOG: ReadonlyMap<string, DiagnosticInfo> = new Map(entries.map(e => [e.code, e]));

/** All catalog entries, sorted by code. */
export function getAllDiagnosticInfos(): DiagnosticInfo[] {
    return [...DIAGNOSTIC_CATALOG.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** Looks up a catalog entry (case-insensitive). */
export function getDiagnosticInfo(code: string): DiagnosticInfo | undefined {
    return DIAGNOSTIC_CATALOG.get(code.toUpperCase());
}

/** Anchor of a code within docs/DIAGNOSTICS.md. */
export function diagnosticDocUrl(code: string): string {
    return `${DIAGNOSTICS_DOC_URL}#${code.toLowerCase()}`;
}

/**
 * Renders the long-form explanation of a code (used by `mangle-cli explain`
 * and docs/DIAGNOSTICS.md).
 */
export function renderExplanation(info: DiagnosticInfo, markdown = false): string {
    const lines: string[] = [];
    if (markdown) {
        lines.push(`## ${info.code}`);
        lines.push('');
        lines.push(`**${info.title}** - ${info.category}, default severity: ${info.severity}`);
    } else {
        lines.push(`${info.code}: ${info.title}  [${info.category}, ${info.severity}]`);
    }
    lines.push('');
    lines.push(info.explanation);
    lines.push('');
    lines.push(markdown ? `**How to fix:** ${info.fix}` : `How to fix: ${info.fix}`);
    if (info.example) {
        lines.push('');
        if (markdown) {
            lines.push('Instead of:');
            lines.push('```mangle');
            lines.push(info.example.bad);
            lines.push('```');
            lines.push('write:');
            lines.push('```mangle');
            lines.push(info.example.good);
            lines.push('```');
        } else {
            lines.push('Instead of:');
            lines.push(indent(info.example.bad));
            lines.push('write:');
            lines.push(indent(info.example.good));
        }
    }
    if (info.docs) {
        lines.push('');
        lines.push(`${markdown ? '**Upstream docs:** ' : 'Upstream docs: '}${MANGLE_DOCS_BASE}${info.docs}`);
    }
    return lines.join('\n');
}

function indent(text: string): string {
    return text.split('\n').map(l => `    ${l}`).join('\n');
}

/** Renders the whole catalog as the markdown reference docs/DIAGNOSTICS.md. */
export function renderDiagnosticsMarkdown(): string {
    const lines: string[] = [];
    lines.push('# Mangle LSP diagnostics reference');
    lines.push('');
    lines.push('<!-- Generated from mangle-lsp/src/analysis/diagnostics.ts by `mangle-cli explain --all --markdown`. Do not edit by hand. -->');
    lines.push('');
    lines.push('Every diagnostic reported by the Mangle language server and `mangle-cli check` has a stable code.');
    lines.push('Run `mangle-cli explain <CODE>` for the same text in a terminal.');
    lines.push('');
    lines.push('| Code | Title | Category | Severity |');
    lines.push('|------|-------|----------|----------|');
    for (const info of getAllDiagnosticInfos()) {
        lines.push(`| [${info.code}](#${info.code.toLowerCase()}) | ${info.title} | ${info.category} | ${info.severity} |`);
    }
    lines.push('');
    for (const info of getAllDiagnosticInfos()) {
        lines.push(renderExplanation(info, true));
        lines.push('');
    }
    return lines.join('\n');
}

// ============================================================================
// Suggestions
// ============================================================================

/** Levenshtein edit distance (small inputs only). */
export function editDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = new Array<number>(n + 1);
    let cur = new Array<number>(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
        cur[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
        }
        [prev, cur] = [cur, prev];
    }
    return prev[n]!;
}

/**
 * Returns up to `max` candidates that are plausibly what `name` meant: close in
 * edit distance, or sharing its last name segment (`fn:string:startswith` ->
 * `:string:starts_with`).
 */
export function suggestSimilar(name: string, candidates: Iterable<string>, max = 3): string[] {
    const lower = name.toLowerCase();
    const tail = (s: string): string => s.slice(s.lastIndexOf(':') + 1).replace(/_/g, '');
    const scored: Array<{ c: string; d: number }> = [];
    for (const c of candidates) {
        if (c === name) continue;
        const d = editDistance(lower, c.toLowerCase());
        // Short names need near-exact matches: 'ev' must not suggest 'wk'.
        const len = Math.min(name.length, c.length);
        const threshold = len <= 3 ? 1 : len <= 6 ? 2 : Math.max(2, Math.floor(len / 3));
        if (d <= threshold && d < len) {
            scored.push({ c, d });
        } else if (tail(c).length >= 3 && tail(c) === tail(lower)) {
            scored.push({ c, d: threshold + 1 });
        }
    }
    scored.sort((x, y) => x.d - y.d || x.c.localeCompare(y.c));
    return scored.slice(0, max).map(s => s.c);
}

/** Formats a "did you mean" hint, or undefined when there are no candidates. */
export function didYouMean(suggestions: string[]): string | undefined {
    if (suggestions.length === 0) return undefined;
    if (suggestions.length === 1) return `did you mean '${suggestions[0]}'?`;
    return `did you mean one of: ${suggestions.map(s => `'${s}'`).join(', ')}?`;
}
