# collect_to_map builds the payload (A005 advice on the pair form).
kv(/u, /a, 1). kv(/u, /b, 2).
m(U, M) :- kv(U, K, V) |> do fn:group_by(U), let M = fn:collect_to_map(K, V).
pairs(U, L) :- kv(U, K, V) |> do fn:group_by(U), let L = fn:collect(fn:pair(K, V)).
