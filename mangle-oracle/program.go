package main

import (
	"fmt"
	"os"
	"strings"
	"time"

	"codeberg.org/TauCeti/mangle-go/analysis"
	"codeberg.org/TauCeti/mangle-go/ast"
	"codeberg.org/TauCeti/mangle-go/engine"
	"codeberg.org/TauCeti/mangle-go/factstore"
	"codeberg.org/TauCeti/mangle-go/parse"
	"codeberg.org/TauCeti/mangle-go/provenance"
)

// Source is one program the engine should judge: a single file, or several
// files assembled into one program the way a host concatenates them.
type Source struct {
	Files []string
	Text  string
}

// LoadSource reads and concatenates files into one program text.
func LoadSource(files []string) (Source, error) {
	var b strings.Builder
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			return Source{}, err
		}
		b.Write(data)
		if len(data) > 0 && data[len(data)-1] != '\n' {
			b.WriteByte('\n')
		}
	}
	return Source{Files: files, Text: b.String()}, nil
}

// Stage names where the engine first rejected a program.
const (
	StageParse   = "parse"
	StageAnalyze = "analyze"
	StageBounds  = "bounds"
	StageEval    = "eval"
	StageOK      = "ok"
)

// Evaluation is the outcome of running a program on the engine.
type Evaluation struct {
	Info     *analysis.ProgramInfo
	Store    factstore.FactStore
	Temporal *factstore.TemporalStore
	Stats    engine.Stats
	// Recorder holds every derivation when Options.Record is set, so proofs
	// can explain facts that come out of let/do transforms.
	Recorder *provenance.MemoryRecorder
}

// Options controls analysis and evaluation.
type Options struct {
	Strict    bool
	Record    bool
	At        time.Time
	FactLimit int
}

func parseUnit(text string) (parse.SourceUnit, error) {
	return parse.Unit(strings.NewReader(text))
}

func analyze(unit parse.SourceUnit, strict bool) (*analysis.ProgramInfo, error) {
	mode := analysis.NoBoundsChecking
	if strict {
		mode = analysis.ErrorForBoundsMismatch
	}
	return analysis.AnalyzeAndCheckBounds([]parse.SourceUnit{unit}, nil, mode)
}

// silentExternal answers every external predicate with no rows, so programs
// that declare externals can be evaluated without their Go host.
type silentExternal struct{}

func (silentExternal) ShouldPushdown() bool                                        { return false }
func (silentExternal) ShouldQuery([]ast.Constant, []ast.BaseTerm, []ast.Term) bool { return true }
func (silentExternal) ExecuteQuery([]ast.Constant, []ast.BaseTerm, []ast.Term, func([]ast.BaseTerm)) error {
	return nil
}

func externalsOf(info *analysis.ProgramInfo) map[ast.PredicateSym]engine.ExternalPredicateCallback {
	out := map[ast.PredicateSym]engine.ExternalPredicateCallback{}
	for sym, decl := range info.Decls {
		if decl.IsExternal() {
			out[sym] = silentExternal{}
		}
	}
	return out
}

// Evaluate runs an analyzed program on a store that supports fact removal
// (so merge lattices replace facts) plus a temporal store.
func Evaluate(info *analysis.ProgramInfo, opts Options) (*Evaluation, error) {
	store := factstore.NewSimpleInMemoryStore()
	ts := factstore.NewTemporalStore()
	limit := opts.FactLimit
	if limit == 0 {
		limit = 100000
	}
	at := opts.At
	if at.IsZero() {
		at = time.Now()
	}
	evalOpts := []engine.EvalOption{
		engine.WithTemporalStore(ts), engine.WithEvaluationTime(at),
		engine.WithExternalPredicates(externalsOf(info)), engine.WithCreatedFactLimit(limit),
		engine.WithDeterministicOrder(),
	}
	var rec *provenance.MemoryRecorder
	if opts.Record {
		rec = provenance.NewMemoryRecorder()
		evalOpts = append(evalOpts, engine.WithDerivationRecorder(rec))
	}
	stats, err := engine.EvalProgramWithStats(info, store, evalOpts...)
	return &Evaluation{Info: info, Store: store, Temporal: ts, Stats: stats, Recorder: rec}, err
}

// Build parses, analyzes and evaluates a program, returning the stage that
// rejected it.
func Build(src Source, opts Options) (*Evaluation, string, error) {
	unit, err := parseUnit(src.Text)
	if err != nil {
		return nil, StageParse, err
	}
	info, err := analyze(unit, false)
	if err != nil {
		return nil, StageAnalyze, err
	}
	if opts.Strict {
		if info, err = analyze(unit, true); err != nil {
			return nil, StageBounds, err
		}
	}
	ev, err := Evaluate(info, opts)
	if err != nil {
		return ev, StageEval, err
	}
	return ev, StageOK, nil
}

// predicateByName finds the predicate with this name (and arity, if > 0).
func predicateByName(info *analysis.ProgramInfo, name string, arity int) (ast.PredicateSym, error) {
	var found []ast.PredicateSym
	for sym := range info.Decls {
		if sym.Symbol == name && (arity <= 0 || sym.Arity == arity) {
			found = append(found, sym)
		}
	}
	switch len(found) {
	case 0:
		return ast.PredicateSym{}, fmt.Errorf("no predicate %q in the program", name)
	case 1:
		return found[0], nil
	default:
		return ast.PredicateSym{}, fmt.Errorf("predicate %s has several arities; write %s/<arity>", name, name)
	}
}
