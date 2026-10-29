# :float:gt is the comparison for /float64: accepted.
Decl score(I, S) bound [/name, /float64].
score(/a, 0.95).
hi(I) :- score(I, S), :float:gt(S, 0.9).
