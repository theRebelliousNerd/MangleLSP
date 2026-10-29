# :string:matches is new in v0.7: accepted.
name("abc").
ok(N) :- name(N), :string:matches(N, "^[a-z]+$").
