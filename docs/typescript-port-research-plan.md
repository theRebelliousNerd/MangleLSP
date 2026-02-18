# Mangle TypeScript Port Research Plan

## Executive Summary

This document outlines a comprehensive research and implementation plan for porting Google Mangle to TypeScript. The port will leverage TypeScript's strong type system, modern JavaScript runtime capabilities, and npm ecosystem while maintaining semantic parity with the upstream Go implementation.

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

### 1.3 Parser Architecture

- Uses ANTLR4 for grammar definition
- Grammar file: `Mangle.g4`
- Visitor pattern for AST construction

### 1.4 Evaluation Engines

1. **Naive Bottom-Up**: Simple fixed-point iteration
2. **Semi-Naive Bottom-Up**: Optimized with delta rules
3. **Top-Down**: Goal-directed evaluation with memoization

---

## 2. TypeScript Implementation Strategy

### 2.1 Technology Choices

| Component | TypeScript Technology | Rationale |
|-----------|----------------------|-----------|
| Parser | ANTLR4 for TypeScript | Grammar compatibility with upstream |
| AST | Discriminated unions + readonly | Type-safe, immutable patterns |
| Runtime | Node.js + Bun compatible | Broad deployment options |
| Type Checking | TypeScript strict mode | Maximum type safety |
| Testing | Vitest or Jest | Fast, TypeScript-native |
| Bundling | tsup or esbuild | Modern, fast builds |
| Packaging | npm package | Standard distribution |

### 2.2 Module Structure

```
mangle-ts/
├── src/
│   ├── index.ts              # Public API exports
│   ├── ast/
│   │   ├── index.ts
│   │   ├── types.ts          # ConstantType enum, type definitions
│   │   ├── constant.ts       # Constant class/functions
│   │   ├── variable.ts       # Variable type
│   │   ├── terms.ts          # Term, BaseTerm, ApplyFn
│   │   ├── atoms.ts          # Atom, NegAtom, Eq, Ineq
│   │   ├── clause.ts         # Clause, Transform
│   │   ├── decl.ts           # Decl, BoundDecl
│   │   └── subst.ts          # Substitution types
│   ├── parse/
│   │   ├── index.ts
│   │   ├── parser.ts         # Main parser interface
│   │   ├── visitor.ts        # AST builder visitor
│   │   └── generated/        # ANTLR-generated code
│   ├── analysis/
│   │   ├── index.ts
│   │   ├── validation.ts
│   │   ├── stratification.ts
│   │   ├── declcheck.ts
│   │   └── rewrite.ts
│   ├── builtin/
│   │   ├── index.ts
│   │   ├── predicates.ts
│   │   ├── functions.ts
│   │   └── reducers.ts
│   ├── engine/
│   │   ├── index.ts
│   │   ├── naive.ts
│   │   ├── seminaive.ts
│   │   ├── topdown.ts
│   │   └── transform.ts
│   ├── store/
│   │   ├── index.ts
│   │   ├── types.ts          # FactStore interface
│   │   └── memory.ts         # In-memory implementation
│   ├── unify/
│   │   ├── index.ts
│   │   └── unionfind.ts
│   ├── symbols/
│   │   ├── index.ts
│   │   ├── predicates.ts
│   │   ├── functions.ts
│   │   └── types.ts
│   ├── functional/
│   │   ├── index.ts
│   │   └── eval.ts
│   └── interpreter/
│       ├── index.ts
│       └── repl.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── parity/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 2.3 TypeScript-Specific Design Decisions

#### 2.3.1 Discriminated Unions for AST

```typescript
// Constant types as discriminated union
export const ConstantType = {
  Name: 'name',
  String: 'string',
  Bytes: 'bytes',
  Number: 'number',
  Float64: 'float64',
  Pair: 'pair',
  List: 'list',
  Map: 'map',
  Struct: 'struct',
} as const;

export type ConstantType = typeof ConstantType[keyof typeof ConstantType];

// Constant as immutable object
export interface Constant {
  readonly type: ConstantType;
  readonly symbol: string;
  readonly numValue: bigint;
  readonly fst: Constant | null;
  readonly snd: Constant | null;
}
```

#### 2.3.2 Term Type Hierarchy

```typescript
// Base interfaces
export interface Term {
  readonly kind: string;
  equals(other: Term): boolean;
  applySubst(subst: Subst): Term;
  toString(): string;
}

export interface BaseTerm extends Term {
  hash(): bigint;
  applySubstBase(subst: Subst): BaseTerm;
}

// Discriminated union for all term types
export type AnyTerm =
  | Constant
  | Variable
  | ApplyFn
  | Atom
  | NegAtom
  | Eq
  | Ineq;

export type AnyBaseTerm = Constant | Variable | ApplyFn;
```

#### 2.3.3 Exhaustive Pattern Matching

```typescript
function evalPremise(premise: Term, subst: UnionFind): UnionFind[] {
  switch (premise.kind) {
    case 'atom':
      return evalAtom(premise as Atom, subst);
    case 'negAtom':
      return evalNegAtom(premise as NegAtom, subst);
    case 'eq':
      return evalEq(premise as Eq, subst);
    case 'ineq':
      return evalIneq(premise as Ineq, subst);
    default:
      // TypeScript ensures exhaustiveness
      const _exhaustive: never = premise;
      throw new Error(`Unknown premise type: ${_exhaustive}`);
  }
}
```

#### 2.3.4 Result Type for Error Handling

```typescript
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Usage
function name(symbol: string): Result<Constant, string> {
  if (symbol.length <= 1) {
    return err("constant symbol must be non-empty");
  }
  if (!symbol.startsWith('/')) {
    return err("constant symbol must start with '/'");
  }
  return ok(createNameConstant(symbol));
}
```

---

## 3. Implementation Phases

### Phase 1: Foundation (AST + Parser)
**Goal:** Parse Mangle source code into TypeScript AST

1. Set up TypeScript project with strict mode
2. Port ANTLR grammar (reuse Mangle.g4)
3. Implement AST types with discriminated unions
4. Create parser visitor for AST construction
5. Port string escaping/unescaping utilities
6. Implement AST pretty-printing

**Test Coverage:**
- Parse all example programs from upstream
- Round-trip testing (parse -> toString -> parse)

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
2. Add Node.js CLI
3. Browser-compatible build
4. Documentation (TypeDoc)
5. Performance optimization
6. npm package publishing

---

## 4. Testing Strategy

### 4.1 Test Categories

1. **Unit Tests**: Individual function/method coverage
2. **Integration Tests**: Cross-module interactions
3. **Parity Tests**: Direct comparison with Go implementation
4. **Property-Based Tests**: fast-check for fuzzing

### 4.2 Upstream Test Porting

Port all `_test.go` files to TypeScript:
- `ast/ast_test.go` → `tests/unit/ast/constant.test.ts`
- `parse/parse_test.go` → `tests/unit/parse/parser.test.ts`
- etc.

### 4.3 CI/CD Pipeline

```yaml
# GitHub Actions workflow
- Run vitest with coverage
- Run tsc --noEmit for type checking
- Run eslint
- Compare outputs with Go implementation
- Performance regression tests
- Build for Node.js and browser
```

---

## 5. Contribution Guidelines (TensorFlow-style)

### 5.1 Code Style
- Follow Google TypeScript Style Guide
- Use Prettier for formatting
- Use ESLint with strict rules
- Type annotations required everywhere

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

---

## 6. Browser Compatibility

### 6.1 Build Targets

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### 6.2 Dual Package (ESM + CJS)

```json
// package.json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

### 6.3 Browser Bundle

Use esbuild or tsup for browser-compatible bundle:
- No Node.js-specific APIs in core
- Optional Node.js wrapper for CLI/REPL
- WASM for compute-intensive operations (optional)

---

## 7. Performance Considerations

### 7.1 BigInt for Hashing

Use BigInt for 64-bit hash compatibility with Go:

```typescript
function hashBytes(bytes: Uint8Array): bigint {
  // FNV-64a implementation
  let hash = 14695981039346656037n;
  const prime = 1099511628211n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash *= prime;
    hash &= 0xFFFFFFFFFFFFFFFFn; // Keep 64 bits
  }
  return hash;
}
```

### 7.2 Immutable Data Structures

Consider Immer or custom implementations for efficient immutability:

```typescript
import { produce } from 'immer';

function extendSubst(subst: SubstMap, v: Variable, t: BaseTerm): SubstMap {
  return produce(subst, draft => {
    draft.set(v.symbol, t);
  });
}
```

### 7.3 Lazy Evaluation

Use generators for large result sets:

```typescript
function* getFacts(query: Atom): Generator<Atom> {
  for (const fact of this.facts.get(query.predicate.symbol) ?? []) {
    if (matches(query, fact)) {
      yield fact;
    }
  }
}
```

---

## 8. File Mapping

| Go File | TypeScript Module |
|---------|------------------|
| `ast/ast.go` | `src/ast/constant.ts`, `src/ast/terms.ts` |
| `ast/decl.go` | `src/ast/decl.ts` |
| `parse/parse.go` | `src/parse/parser.ts`, `src/parse/visitor.ts` |
| `analysis/validation.go` | `src/analysis/validation.ts` |
| `analysis/stratification.go` | `src/analysis/stratification.ts` |
| `builtin/builtin.go` | `src/builtin/predicates.ts`, `src/builtin/functions.ts` |
| `engine/naivebottomup.go` | `src/engine/naive.ts` |
| `engine/seminaivebottomup.go` | `src/engine/seminaive.ts` |
| `engine/topdown.go` | `src/engine/topdown.ts` |
| `factstore/factstore.go` | `src/store/types.ts`, `src/store/memory.ts` |
| `interpreter/interpreter.go` | `src/interpreter/repl.ts` |
| `symbols/symbols.go` | `src/symbols/predicates.ts`, `src/symbols/functions.ts` |
| `unionfind/unionfind.go` | `src/unify/unionfind.ts` |
| `functional/functional.go` | `src/functional/eval.ts` |

---

## 9. Success Metrics

1. **Correctness**: Pass 100% of upstream tests
2. **Type Safety**: Zero `any` types in public API
3. **Performance**: Within 5x of Go implementation
4. **Size**: <100KB minified bundle for browser
5. **Usability**: npm installable, TypeDoc documented
