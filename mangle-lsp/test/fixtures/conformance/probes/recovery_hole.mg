# Error recovery leaves a hole: parse error, and analysis must not chase it.
h(1).
q(H) :- h(C), H = C./host.
r(X) :- h(X).
