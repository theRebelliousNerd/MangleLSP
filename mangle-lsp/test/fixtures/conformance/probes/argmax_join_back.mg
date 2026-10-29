# Arg-max by fn:max and join-back (A001 advice).
obs(/f1, 10, "old"). obs(/f1, 30, "new"). obs(/f2, 5, "only").
latest_t(F, M) :- obs(F, T, _) |> do fn:group_by(F), let M = fn:max(T).
latest(F, V) :- latest_t(F, M), obs(F, M, V).
