# The merge-lattice form of argmax_join_back.mg: same winners.
obs(/f1, 10, "old"). obs(/f1, 30, "new"). obs(/f2, 5, "only").
Decl best_obs(F, P) descr [fundep([F], [P]), merge([P], "obs_later")].
Decl obs_later(P1, P2, B) descr [mode('+', '+', '-'), deferred()].
obs_later(P1, P2, P1) :- :match_pair(P1, T1, _), :match_pair(P2, T2, _), T1 >= T2.
obs_later(P1, P2, P2) :- :match_pair(P1, T1, _), :match_pair(P2, T2, _), T1 < T2.
best_obs(F, fn:pair(T, V)) :- obs(F, T, V).
