# Mangle Python Port Research Plan

## Executive Summary

This document outlines a comprehensive research and implementation plan for porting Google Mangle to Python. Mangle is a deductive database programming language extending Datalog with aggregation, function calls, and optional type-checking. The port will maintain semantic parity with the upstream Go implementation while leveraging Python's strengths.

## 1. Upstream Implementation Analysis

### 1.1 Core Architecture (Go Implementation)

The upstream Mangle implementation consists of these key modules:

| Module | Go Package | Purpose | Lines of Code (approx) |
|--------|-----------|---------|----------------------|
| AST | `ast/` | Abstract Syntax Tree types and operations | ~1,400 |
| Parser | `parse/` | ANTLR-based parsing | ~740 |
| Analysis | `analysis/` | Semantic analysis, stratification, validation | ~1,200 |
| Builtins | `builtin/` | Built-in predicates and functions | ~600 |
| Engine | `engine/` | Evaluation engines (naive, semi-naive, top-down) | ~800 |
| FactStore | `factstore/` | Fact storage and retrieval | ~400 |
| Interpreter | `interpreter/` | Interactive REPL | ~440 |
| Symbols | `symbols/` | Symbol table and type expressions | ~600 |
| UnionFind | `unionfind/` | Unification algorithm | ~300 |
| Functional | `functional/` | Function evaluation | ~400 |

### 1.2 Key Data Structures

#### Constants (`ast.Constant`)
```
Types: NameType, StringType, BytesType, NumberType, Float64Type
Shapes: PairShape, ListShape, MapShape, StructShape
```

#### Terms (Interface Hierarchy)
```
Term (interface)
├── BaseTerm (interface)
│   ├── Constant
│   ├── Variable
│   └── ApplyFn
├── Atom
├── NegAtom
├── Eq
└── Ineq
```

#### Declarations
```
Decl
├── DeclaredAtom (Atom)
├── Descr ([]Atom) - descriptors
├── Bounds ([]BoundDecl) - type bounds
└── Constraints (*InclusionConstraint)
```

### 1.3 Parser Architecture

- Uses ANTLR4 for grammar definition
- Grammar file: `Mangle.g4`
- Visitor pattern for AST construction
- Pooled lexer/parser instances for performance

### 1.4 Evaluation Engines

1. **Naive Bottom-Up**: Simple fixed-point iteration
2. **Semi-Naive Bottom-Up**: Optimized with delta rules
3. **Top-Down**: Goal-directed evaluation with memoization

### 1.5 Built-in Operations

**Predicates:**
- Comparison: `:lt`, `:le`, `:gt`, `:ge`
- String: `:string:starts_with`, `:string:ends_with`, `:string:contains`
- Pattern: `:match_prefix`, `:match_pair`, `:match_cons`, `:match_nil`, `:match_field`, `:match_entry`
- List: `:list:member`, `:filter`
- Distance: `:within_distance`

**Functions (fn:):**
- Arithmetic: `plus`, `minus`, `mult`, `div`, `sqrt`, `float_div`, `float_mult`, `float_plus`
- List: `list`, `append`, `cons`, `len`, `list:get`, `list:contains`
- Aggregation: `collect`, `collect_distinct`, `collect_to_map`, `pick_any`, `max`, `min`, `sum`, `count`, `avg`
- Structure: `pair`, `map`, `struct`, `tuple`, `struct:get`
- Conversion: `number_to_string`, `float64_to_string`, `name_to_string`
- Name: `name:root`, `name:tip`, `name:list`

---

## 2. Python Implementation Strategy

### 2.1 Technology Choices

| Component | Python Technology | Rationale |
|-----------|------------------|-----------|
| Parser | ANTLR4 for Python | Grammar compatibility with upstream |
| AST | dataclasses + Protocol | Type-safe, immutable-friendly |
| Pattern Matching | Python 3.10+ match/case | Clean visitor alternative |
| Type Checking | mypy + Protocol | Static analysis support |
| Testing | pytest | Standard, comprehensive |
| Packaging | pyproject.toml + hatch | Modern Python packaging |

### 2.2 Module Structure

```
mangle_py/
├── __init__.py
├── ast/
│   ├── __init__.py
│   ├── terms.py          # Term, BaseTerm, Constant, Variable, etc.
│   ├── atoms.py          # Atom, NegAtom, Eq, Ineq
│   ├── clauses.py        # Clause, Transform, TransformStmt
│   ├── decls.py          # Decl, BoundDecl, InclusionConstraint
│   └── serde.py          # Serialization/deserialization
├── parse/
│   ├── __init__.py
│   ├── parser.py         # Main parser interface
│   ├── visitor.py        # AST builder visitor
│   └── gen/              # ANTLR-generated code
├── analysis/
│   ├── __init__.py
│   ├── validation.py     # Rule validation
│   ├── stratification.py # Stratification algorithm
│   ├── declcheck.py      # Declaration checking
│   └── rewrite.py        # Clause rewriting
├── builtin/
│   ├── __init__.py
│   ├── predicates.py     # Built-in predicates
│   ├── functions.py      # Built-in functions
│   └── reducers.py       # Aggregation functions
├── engine/
│   ├── __init__.py
│   ├── naive.py          # Naive bottom-up
│   ├── seminaive.py      # Semi-naive bottom-up
│   ├── topdown.py        # Top-down evaluation
│   └── transform.py      # Transform evaluation
├── store/
│   ├── __init__.py
│   ├── base.py           # Abstract FactStore
│   └── memory.py         # In-memory implementation
├── unify/
│   ├── __init__.py
│   └── unionfind.py      # Unification with union-find
├── symbols/
│   ├── __init__.py
│   ├── symbols.py        # Predefined symbols
│   └── types.py          # Type expressions
├── interpreter/
│   ├── __init__.py
│   └── repl.py           # Interactive interpreter
└── functional/
    ├── __init__.py
    └── eval.py           # Expression evaluation
```

### 2.3 Python-Specific Design Decisions

#### 2.3.1 AST with Dataclasses

```python
from dataclasses import dataclass
from typing import Protocol, Union, Sequence
from enum import Enum, auto

class ConstantType(Enum):
    NAME = auto()
    STRING = auto()
    BYTES = auto()
    NUMBER = auto()
    FLOAT64 = auto()
    PAIR = auto()
    LIST = auto()
    MAP = auto()
    STRUCT = auto()

@dataclass(frozen=True)
class Constant:
    type: ConstantType
    symbol: str
    num_value: int
    fst: "Constant | None" = None
    snd: "Constant | None" = None

    def hash(self) -> int:
        return hash((self.type, self.symbol, self.num_value))
```

#### 2.3.2 Protocol-Based Term Interface

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Term(Protocol):
    def equals(self, other: "Term") -> bool: ...
    def apply_subst(self, subst: "Subst") -> "Term": ...
    def __str__(self) -> str: ...

@runtime_checkable
class BaseTerm(Term, Protocol):
    def hash(self) -> int: ...
    def apply_subst_base(self, subst: "Subst") -> "BaseTerm": ...
```

#### 2.3.3 Pattern Matching for Visitors

```python
def eval_premise(self, premise: Term, subst: UnionFind) -> list[UnionFind]:
    match premise:
        case Atom() as a:
            return self._eval_atom(a, subst)
        case NegAtom(atom=a):
            return self._eval_neg_atom(a, subst)
        case Eq(left=l, right=r):
            return self._eval_eq(l, r, subst)
        case Ineq(left=l, right=r):
            return self._eval_ineq(l, r, subst)
```

---

## 3. Implementation Phases

### Phase 1: Foundation (AST + Parser)
**Goal:** Parse Mangle source code into Python AST

1. Port ANTLR grammar (reuse Mangle.g4)
2. Implement AST types with dataclasses
3. Create parser visitor for AST construction
4. Port string escaping/unescaping utilities
5. Implement AST pretty-printing

**Test Coverage:**
- Parse all example programs from upstream
- Round-trip testing (parse -> print -> parse)

### Phase 2: Core Analysis
**Goal:** Semantic analysis and validation

1. Port validation rules
2. Implement stratification algorithm
3. Port declaration checking
4. Implement clause rewriting

**Test Coverage:**
- Upstream analysis test cases
- Error message parity

### Phase 3: Builtins + Functions
**Goal:** Full built-in operation support

1. Port all built-in predicates
2. Port all built-in functions
3. Port reducer/aggregation functions
4. Implement functional evaluation

**Test Coverage:**
- Exhaustive built-in tests from upstream

### Phase 4: Evaluation Engine
**Goal:** Complete Datalog evaluation

1. Implement FactStore interface and in-memory store
2. Port union-find unification
3. Implement naive bottom-up engine
4. Implement semi-naive bottom-up engine
5. Implement top-down engine
6. Port transform evaluation

**Test Coverage:**
- All upstream engine tests
- Performance benchmarks

### Phase 5: Interpreter + Polish
**Goal:** Interactive usage and production-ready

1. Port REPL interpreter
2. Add Python-specific CLI
3. Documentation
4. Performance optimization
5. Packaging and distribution

---

## 4. Testing Strategy

### 4.1 Test Categories

1. **Unit Tests**: Individual function/method coverage
2. **Integration Tests**: Cross-module interactions
3. **Parity Tests**: Direct comparison with Go implementation
4. **Property-Based Tests**: Hypothesis-driven fuzzing

### 4.2 Upstream Test Porting

Port all `_test.go` files:
- `ast/ast_test.go`, `ast/decl_test.go`, `ast/serde_test.go`
- `parse/parse_test.go`, `parse/parse_strings_test.go`
- `analysis/validation_test.go`, `analysis/stratification_test.go`, etc.
- `builtin/builtin_test.go`
- `engine/naivebottomup_test.go`, `engine/seminaivebottomup_test.go`, etc.

### 4.3 CI/CD Pipeline

```yaml
# GitHub Actions workflow
- Run pytest with coverage
- Run mypy type checking
- Run ruff linting
- Compare outputs with Go implementation
- Performance regression tests
```

---

## 5. Contribution Guidelines (TensorFlow-style)

Following the TensorFlow contribution model:

### 5.1 Code Style
- Follow Google Python Style Guide
- Use ruff for formatting and linting
- Type annotations required for all public APIs
- Docstrings following Google style

### 5.2 Testing Requirements
- All new features must have tests
- Maintain >90% code coverage
- Parity tests against upstream required

### 5.3 PR Process
1. Open issue describing the change
2. Fork and create feature branch
3. Write code with tests
4. Submit PR with clear description
5. Address review feedback
6. Ensure CI passes

### 5.4 Documentation
- README with quick start
- API documentation (Sphinx)
- Examples directory
- Contribution guide

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ANTLR Python runtime differences | Medium | High | Early parser testing |
| Performance gap vs Go | High | Medium | Profile early, optimize hot paths |
| Semantic drift from upstream | Medium | High | Automated parity testing |
| Go-specific idioms hard to port | Low | Medium | Document alternatives |
| Type system complexity | Medium | Medium | Iterative Protocol refinement |

---

## 7. Success Metrics

1. **Correctness**: Pass 100% of upstream tests
2. **Performance**: Within 10x of Go implementation
3. **Usability**: pip-installable, well-documented
4. **Maintainability**: 90%+ type coverage, clean architecture

---

## 8. Timeline Estimate

| Phase | Deliverables |
|-------|-------------|
| Phase 1 | AST types, parser, basic tests |
| Phase 2 | Validation, stratification, analysis |
| Phase 3 | Built-in predicates and functions |
| Phase 4 | Evaluation engines, FactStore |
| Phase 5 | Interpreter, docs, packaging |

---

## Appendix A: File Mapping

| Go File | Python Module |
|---------|--------------|
| `ast/ast.go` | `mangle_py/ast/terms.py`, `mangle_py/ast/atoms.py` |
| `ast/decl.go` | `mangle_py/ast/decls.py` |
| `parse/parse.go` | `mangle_py/parse/parser.py`, `mangle_py/parse/visitor.py` |
| `analysis/validation.go` | `mangle_py/analysis/validation.py` |
| `analysis/stratification.go` | `mangle_py/analysis/stratification.py` |
| `builtin/builtin.go` | `mangle_py/builtin/predicates.py`, `mangle_py/builtin/functions.py` |
| `engine/naivebottomup.go` | `mangle_py/engine/naive.py` |
| `engine/seminaivebottomup.go` | `mangle_py/engine/seminaive.py` |
| `engine/topdown.go` | `mangle_py/engine/topdown.py` |
| `factstore/factstore.go` | `mangle_py/store/base.py`, `mangle_py/store/memory.py` |
| `interpreter/interpreter.go` | `mangle_py/interpreter/repl.py` |
| `symbols/symbols.go` | `mangle_py/symbols/symbols.py` |
| `unionfind/unionfind.go` | `mangle_py/unify/unionfind.py` |
| `functional/functional.go` | `mangle_py/functional/eval.py` |

---

## Appendix B: Built-in Symbols Reference

### Predicates
```python
MATCH_PREFIX = PredicateSym(":match_prefix", 2)
STARTS_WITH = PredicateSym(":string:starts_with", 2)
ENDS_WITH = PredicateSym(":string:ends_with", 2)
CONTAINS = PredicateSym(":string:contains", 2)
FILTER = PredicateSym(":filter", 1)
LT = PredicateSym(":lt", 2)
LE = PredicateSym(":le", 2)
GT = PredicateSym(":gt", 2)
GE = PredicateSym(":ge", 2)
LIST_MEMBER = PredicateSym(":list:member", 2)
WITHIN_DISTANCE = PredicateSym(":within_distance", 3)
MATCH_PAIR = PredicateSym(":match_pair", 3)
MATCH_CONS = PredicateSym(":match_cons", 3)
MATCH_NIL = PredicateSym(":match_nil", 1)
MATCH_FIELD = PredicateSym(":match_field", 3)
MATCH_ENTRY = PredicateSym(":match_entry", 3)
```

### Functions
```python
# Arithmetic
DIV = FunctionSym("fn:div", 2)
FLOAT_DIV = FunctionSym("fn:float:div", 2)
MULT = FunctionSym("fn:mult", 2)
PLUS = FunctionSym("fn:plus", 2)
MINUS = FunctionSym("fn:minus", 2)
SQRT = FunctionSym("fn:sqrt", 1)

# List operations
LIST_GET = FunctionSym("fn:list:get", 2)
LIST_CONTAINS = FunctionSym("fn:list:contains", 2)
APPEND = FunctionSym("fn:append", 2)
CONS = FunctionSym("fn:cons", 2)
LEN = FunctionSym("fn:len", 1)

# Aggregation (Reducers)
COLLECT = FunctionSym("fn:collect", 1)
COLLECT_DISTINCT = FunctionSym("fn:collect_distinct", 1)
COLLECT_TO_MAP = FunctionSym("fn:collect_to_map", 2)
PICK_ANY = FunctionSym("fn:pick_any", 1)
MAX = FunctionSym("fn:max", 1)
MIN = FunctionSym("fn:min", 1)
SUM = FunctionSym("fn:sum", 1)
COUNT = FunctionSym("fn:count", 1)
AVG = FunctionSym("fn:avg", 1)
```
