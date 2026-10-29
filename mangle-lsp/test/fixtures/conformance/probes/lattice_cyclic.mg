# A merge lattice on a cyclic graph terminates with the shortest paths;
# the all-paths version of this graph runs to the fact limit.
Decl shortest_path(Source, Target, Path) descr [fundep([Source, Target], [Path]), merge([Path], "shorter")].
Decl shorter(P1, P2, S) descr [mode('+', '+', '-'), deferred()].
edge(/a, /b). edge(/b, /c). edge(/c, /d). edge(/a, /d). edge(/d, /a).
shortest_path(X, Y, [X, Y]) :- edge(X, Y).
shortest_path(X, Z, NewPath) :- shortest_path(X, Y, Path), edge(Y, Z) |> let NewPath = fn:list:append(Path, Z).
shorter(P1, P2, S) :- fn:list:len(P1) < fn:list:len(P2), S = P1.
shorter(P1, P2, S) :- fn:list:len(P2) <= fn:list:len(P1), S = P2.
