# != waits for its variables like a negation: accepted.
p(1, /x). p(2, /y).
q(X) :- R != /y, p(X, R).
