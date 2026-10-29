# > is for /number: strict bounds reject it on /float64, evaluation fails without them.
Decl score(I, S) bound [/name, /float64].
score(/a, 0.95).
hi(I) :- score(I, S), S > 0.9.
