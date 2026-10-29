# bound [] makes the zero-arity Decl pass.
Decl ok() bound [].
ok().
q(/x) :- ok().
