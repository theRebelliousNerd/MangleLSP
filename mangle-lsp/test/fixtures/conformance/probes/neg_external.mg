# Accepted, but the negation never calls the Go callback (E081 warning).
Decl ext(X, Y) descr [external(), mode('+', '-')].
item(1). item(2).
neg(X) :- item(X), !ext(X, "hit").
