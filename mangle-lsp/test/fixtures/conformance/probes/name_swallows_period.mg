# The final . is read as part of the name /a.: parse error.
p(/a).
q(X) :- p(X), X = /a.
r(1).
