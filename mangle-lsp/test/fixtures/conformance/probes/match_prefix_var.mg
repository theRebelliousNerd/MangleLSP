# A variable prefix fails strict type checking.
item(/users/a). pre(/users).
q(X) :- item(X), pre(P), :match_prefix(X, P).
