# A zero-arity Decl without bound [] fails strict bounds checking.
Decl ok().
ok().
q(/x) :- ok().
