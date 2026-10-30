# Judgments over the Go <-> .mg boundary of one Go module.
#
# Go measures (gofacts.go, mgfacts.go assert the EDB below), Mangle judges
# (the finding/7 rules), Go reports. Every finding also carries its proof:
# the facts it rests on and the facts whose absence it rests on.

# ---------------------------------------------------------------- EDB: .mg side
Decl decl(Pred, Arity, File, Line) descr [extensional()] bound [/string, /number, /string, /number].
Decl decl_type(Pred, Arity, Pos, Alt, Type) descr [extensional()] bound [/string, /number, /number, /number, /name].
Decl decl_external(Pred, Arity, Modes) descr [extensional()] bound [/string, /number, /string].
Decl mg_defines(Pred, Arity) descr [extensional()] bound [/string, /number].
Decl mg_uses(Pred, Arity, File) descr [extensional()] bound [/string, /number, /string].
Decl mg_negates(Pred, Arity, File, Line) descr [extensional()] bound [/string, /number, /string, /number].
# One rule or fact (Len atoms in its body), and its body atoms in order; a
# negated atom (/neg) never blocks a rule, a positive one (/pos) does.
Decl mg_rule(Rule, Pred, Arity, File, Line, Len) descr [extensional()] bound [/number, /string, /number, /string, /number, /number].
# A rule with at least one body atom: it derives, where a fact only states.
Decl mg_derivation(Rule, Pred, Arity, File, Line) descr [extensional()] bound [/number, /string, /number, /string, /number].
Decl mg_premise(Rule, Idx, Pred, Arity, Sign) descr [extensional()] bound [/number, /number, /string, /number, /name].

# ---------------------------------------------------------------- EDB: Go side
Decl go_assert(Site, Pred, Arity, File, Line) descr [extensional()] bound [/number, /string, /number, /string, /number].
Decl go_arg(Site, Pos, Kind) descr [extensional()] bound [/number, /number, /name].
Decl site_regime(Site, Regime) descr [extensional()] bound [/number, /name].
Decl site_role(Site, Role) descr [extensional()] bound [/number, /name].
Decl go_query(Pred, Arity, File, Line) descr [extensional()] bound [/string, /number, /string, /number].
Decl go_mention(Pred, File, Line) descr [extensional()] bound [/string, /string, /number].
Decl go_external(Pred, Arity, Modes, File, Line) descr [extensional()] bound [/string, /number, /string, /string, /number].

# ---------------------------------------------- how Go values become constants
# behaves(Regime, GoKind, ConstantType): a Go argument of GoKind may become a
# constant of ConstantType. /dynstring (a string whose value is unknown) may
# become either, so it never proves a mismatch.
behaves(R, /name, /name) :- regime(R).
behaves(R, /string, /string) :- regime(R).
behaves(R, /number, /number) :- regime(R).
behaves(R, /float64, /float64) :- regime(R).
behaves(R, /time, /time) :- regime(R).
behaves(R, /duration, /duration) :- regime(R).
behaves(R, /bool, /name) :- regime(R).
behaves(R, /dynstring, /string) :- regime(R).
behaves(R, /dynstring, /name) :- regime(R).
# /name_heuristic: a string that looks like a name ("/x") becomes a name, any
# other string stays a string. /decl_coerced: a string takes the Decl's type.
# /unknown: nothing is known. The host profile says which fact type does what.
behaves(/name_heuristic, /lit_name, /name).
behaves(/name_heuristic, /lit_string, /string).
behaves(R, /lit_name, T) :- loose_regime(R), string_like(T).
behaves(R, /lit_string, T) :- loose_regime(R), string_like(T).
regime(/name_heuristic). regime(/decl_coerced). regime(/unknown).
loose_regime(/decl_coerced). loose_regime(/unknown).
string_like(/name). string_like(/string).

# ------------------------------------------------------------------ helpers
declared(P, A) :- decl(P, A, _, _).
declared_name(P) :- decl(P, _, _, _).
defined_name(P) :- mg_defines(P, _).
external_decl(P, A) :- decl_external(P, A, _).
go_external_pred(P, A) :- go_external(P, A, _, _, _).
asserted(P, A) :- go_assert(_, P, A, _, _).
asserted_unknown_arity(P) :- go_assert(_, P, -1, _, _).
queried(P) :- go_query(P, _, _, _).
read_in_mg(P, A) :- mg_uses(P, A, _).
read_in_mg(P, A) :- mg_negates(P, A, _, _).
sees_externals(/yes) :- go_external(_, _, _, _, _).
mentioned(P) :- go_mention(P, _, _).

produced(P, A) :- mg_defines(P, A).
produced(P, A) :- asserted(P, A).
produced(P, A) :- declared(P, A), asserted_unknown_arity(P).
produced(P, A) :- external_decl(P, A).

# ---------------------------------------------------------------- findings
# finding(Code, Pred, Arity, File, Line, Pos, Note)
Decl finding(Code, Pred, Arity, File, Line, Pos, Note) bound [/name, /string, /number, /string, /number, /number, /string].

# B001: a rule reads a predicate that nothing produces: no rule, no fact, no Go
# assert, and the name appears nowhere else in Go either.
finding(/B001, P, A, F, L, -1, "") :- decl(P, A, F, L), read_in_mg(P, A), !produced(P, A), !mentioned(P).
# B012: as B001, but Go mentions the name somewhere the scan does not read as
# an assert (a list, a map, a dynamic producer): check those places.
finding(/B012, P, A, F, L, -1, "") :- decl(P, A, F, L), read_in_mg(P, A), !produced(P, A), mentioned(P).
# B002: a Decl nothing produces and nothing reads, in .mg or Go.
finding(/B002, P, A, F, L, -1, "") :- decl(P, A, F, L), !produced(P, A), !read_in_mg(P, A), !queried(P), !mentioned(P).
# B003: Go asserts a predicate no .mg file declares or defines.
finding(/B003, P, A, F, L, -1, "") :- go_assert(_, P, A, F, L), !declared_name(P), !defined_name(P).
# B004: Go asserts a declared name at an arity no Decl or rule has (a different
# predicate). A Fact value built outside an Assert call may be a retraction key
# (codeNERD retracts by prefix), so it counts only when it is longer than every Decl.
max_decl_arity(P, M) :- decl(P, A, _, _) |> do fn:group_by(P), let M = fn:max(A).
arity_unknown_to_mg(S) :- go_assert(S, P, A, _, _), A >= 0, declared_name(P), !declared(P, A), !mg_defines(P, A).
finding(/B004, P, A, F, L, -1, "") :- go_assert(S, P, A, F, L), arity_unknown_to_mg(S), site_role(S, /assert).
finding(/B004, P, A, F, L, -1, "") :-
    go_assert(S, P, A, F, L), arity_unknown_to_mg(S), site_role(S, /literal),
    max_decl_arity(P, M), A > M.
# B005: Go queries a predicate the program never declares or defines.
finding(/B005, P, A, F, L, -1, "") :- go_query(P, A, F, L), !declared_name(P), !defined_name(P).
# B006: Go asserts it, and nothing reads it: no rule body, no Go query.
finding(/B006, P, A, F, L, -1, "") :-
    decl(P, A, F, L), asserted(P, A), !mg_defines(P, A), !read_in_mg(P, A), !queried(P), !mentioned(P).

# B007: Go builds an argument whose constant type no Decl alternative admits.
site_kind(S, Pos, T) :- go_arg(S, Pos, K), site_regime(S, R), behaves(R, K, T).
fits(S, Pos) :- go_assert(S, P, A, _, _), site_kind(S, Pos, T), decl_type(P, A, Pos, _, T).
fits(S, Pos) :- go_assert(S, P, A, _, _), go_arg(S, Pos, _), decl_type(P, A, Pos, _, /any).
typed(P, A, Pos) :- decl_type(P, A, Pos, _, _).
finding(/B007, P, A, F, L, Pos, N) :-
    go_assert(S, P, A, F, L), go_arg(S, Pos, K), typed(P, A, Pos), !fits(S, Pos),
    N = fn:name:to_string(K).

# B008: an external Decl with no Go callback registered.
finding(/B008, P, A, F, L, -1, "") :- decl(P, A, F, L), external_decl(P, A), sees_externals(/yes), !go_external_pred(P, A).
# B009: a Go callback for a predicate not declared external().
finding(/B009, P, A, F, L, -1, M) :- go_external(P, A, M, F, L), !external_decl(P, A).
# B010: the callback's modes disagree with the Decl's mode(...) (when Go states modes).
finding(/B010, P, A, F, L, -1, M) :- go_external(P, A, M, F, L), decl_external(P, A, D), M != "", M != D.
# B011: a rule negates an external; the engine never calls Go for a negation.
finding(/B011, P, A, F, L, -1, "") :- mg_negates(P, A, F, L), external_decl(P, A).

# ------------------------------------------------- liveness: what can ever hold
# A predicate is live when some fact of it can exist: Go asserts it, a Go
# callback answers it, Go names it somewhere the scan reads as a possible
# producer, or a rule for it can fire. A rule fires when every positive body
# atom is live (a negated atom never blocks it). chain(R, K) says the first K
# atoms of rule R are live; it only grows through live atoms, so the whole
# computation is positive recursion (no negation inside the fixpoint), and
# "starved" is the complement taken once the fixpoint is done.
known_arity(P, A) :- decl(P, A, _, _).
known_arity(P, A) :- mg_defines(P, A).
known_arity(P, A) :- read_in_mg(P, A).

live(P, A) :- asserted(P, A).
live(P, A) :- external_decl(P, A).
live(P, A) :- declared(P, A), asserted_unknown_arity(P).
live(P, A) :- mentioned(P), known_arity(P, A).
chain(R, 0) :- mg_rule(R, _, _, _, _, _).
chain(R, K1) :- chain(R, K), mg_premise(R, K, _, _, /neg), K1 = fn:plus(K, 1).
chain(R, K1) :- chain(R, K), mg_premise(R, K, P, A, /pos), live(P, A), K1 = fn:plus(K, 1).
live(P, A) :- mg_rule(R, P, A, _, _, N), chain(R, N).

blocked(R, P, A) :- chain(R, K), mg_premise(R, K, P, A, /pos), !live(P, A).

# B013: a rule that can never fire: a positive premise is starved, because
# nothing produces it or every rule that derives it is itself blocked.
finding(/B013, HP, HA, F, L, -1, N) :-
    blocked(R, P, A), mg_rule(R, HP, HA, F, L, _),
    N = fn:string:concat(P, "/", fn:number:to_string(A)).

# ------------------------------------------------- consumption: who reads what
# A predicate is needed when Go queries it (a query call with the name, per the
# host profile; a bare string literal elsewhere does not count: a check a
# literal satisfies teaches writing literals), or a rule reads it whose own
# head is needed. Predicates of ground facts only are tables, not conclusions.
needed(P, A) :- known_arity(P, A), go_query(P, _, _, _).
needed(P, A) :- mg_rule(R, Q, QA, _, _, _), needed(Q, QA), mg_premise(R, _, P, A, _).

# B014: derived by rules or facts, but no rule premise and no Go query reaches it.
derived(P, A) :- mg_derivation(_, P, A, _, _).
unconsumed(P, A) :- derived(P, A), !needed(P, A).
# One finding per predicate and file, at its first rule. (No `do` transform
# here: a post-hoc proof cannot explain a fact that came out of one.)
derived_site(P, A, F, L) :- mg_derivation(_, P, A, F, L).
site_after(P, A, F, L) :- derived_site(P, A, F, L0), derived_site(P, A, F, L), L0 < L.
finding(/B014, P, A, F, L, -1, "") :- unconsumed(P, A), derived_site(P, A, F, L), !site_after(P, A, F, L).
