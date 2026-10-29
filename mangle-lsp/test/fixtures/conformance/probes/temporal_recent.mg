# Temporal freshness: accepted, needs a temporal store.
Decl seen(X) temporal bound [/name].
seen(/a)@[2024-01-09T12:00:00Z].
recent(X) :- <-[0s, 24h] seen(X).
