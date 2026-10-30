# PredicateSym in engine ast/ast.go carries Symbol and Arity independently.
# An input Decl has no defining rule, while a same-name overload does.
Decl task_complexity(Level) bound [/name].
Decl task_complexity(Task, Level) bound [/string, /name].
task("demo").
task_complexity(Task, /high) :- task(Task).
