# v0.7 replaces _ with a fresh variable nothing binds: rejected.
p(1). r(2, 3).
q(X) :- p(X), !r(X, _).
