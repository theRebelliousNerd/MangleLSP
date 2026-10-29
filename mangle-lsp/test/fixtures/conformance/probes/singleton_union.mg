# Strict bounds reject even correct values under a union of singletons.
Decl sev(I, S) bound [/name, fn:Union(fn:Singleton(/low), fn:Singleton(/high))].
sev(/a, /high).
