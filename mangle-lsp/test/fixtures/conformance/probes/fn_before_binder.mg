# A function argument must be bound before the equality: rejected.
p(1).
q(Y) :- Y = fn:plus(X, 1), p(X).
