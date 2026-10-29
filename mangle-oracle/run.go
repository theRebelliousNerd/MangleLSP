package main

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"codeberg.org/TauCeti/mangle-go/ast"
	"codeberg.org/TauCeti/mangle-go/factstore"
	"codeberg.org/TauCeti/mangle-go/parse"
	"codeberg.org/TauCeti/mangle-go/provenance"
)

// Proof is a proof tree in JSON form.
type Proof struct {
	Fact      string   `json:"fact"`
	Kind      string   `json:"kind"`
	Rule      string   `json:"rule,omitempty"`
	Transform string   `json:"transform,omitempty"`
	Partial   bool     `json:"partial,omitempty"`
	Premises  []*Proof `json:"premises,omitempty"`
}

var proofKinds = map[provenance.Kind]string{
	provenance.KindEDB:         "fact",
	provenance.KindDerived:     "rule",
	provenance.KindAbsence:     "absent",
	provenance.KindLetRow:      "let",
	provenance.KindDoAggregate: "aggregate",
}

func toProof(n *provenance.ProofNode, depth int) *Proof {
	p := &Proof{Fact: n.Fact.String(), Kind: proofKinds[n.Kind], Transform: n.TransformText, Partial: n.Partial}
	if n.Rule != nil {
		p.Rule = n.Rule.String()
	}
	if depth > 64 {
		p.Partial = true
		return p
	}
	for _, sub := range n.Premises {
		p.Premises = append(p.Premises, toProof(sub, depth+1))
	}
	return p
}

// splitPredicate reads "name" or "name/arity".
func splitPredicate(s string) (string, int) {
	if i := strings.LastIndex(s, "/"); i > 0 {
		if n, err := strconv.Atoi(s[i+1:]); err == nil {
			return s[:i], n
		}
	}
	return s, 0
}

// Facts lists every fact of a predicate, sorted; temporal facts carry their interval.
func (ev *Evaluation) Facts(sym ast.PredicateSym) []string {
	out := []string{}
	q := ast.NewQuery(sym)
	if decl, ok := ev.Info.Decls[sym]; ok && (decl.IsTemporal() || decl.IsMaybeTemporal()) {
		_ = ev.Temporal.GetAllFacts(q, func(tf factstore.TemporalFact) error {
			iv := tf.Interval.String()
			if !strings.HasPrefix(iv, "@") {
				iv = "@" + iv
			}
			out = append(out, tf.Atom.String()+iv)
			return nil
		})
	} else {
		_ = ev.Store.GetFacts(q, func(a ast.Atom) error { out = append(out, a.String()); return nil })
	}
	sort.Strings(out)
	return out
}

// RunResult answers a query and, optionally, why one fact holds.
type RunResult struct {
	Predicate string   `json:"predicate"`
	Count     int      `json:"count"`
	Facts     []string `json:"facts"`
	Why       []*Proof `json:"why,omitempty"`
	WhyError  string   `json:"whyError,omitempty"`
}

// Run queries a predicate after evaluation and explains a goal with proofs.
func Run(ev *Evaluation, query, why string) (RunResult, error) {
	name, arity := splitPredicate(query)
	sym, err := predicateByName(ev.Info, name, arity)
	if err != nil {
		return RunResult{}, err
	}
	facts := ev.Facts(sym)
	res := RunResult{Predicate: predName(sym), Count: len(facts), Facts: facts}
	if why == "" {
		return res, nil
	}
	goal, err := parse.Atom(why)
	if err != nil {
		res.WhyError = err.Error()
		return res, nil
	}
	var proofs []*provenance.ProofNode
	if ev.Recorder != nil {
		proofs, err = provenance.BuildFromRecording(ev.Recorder, ev.Store, goal, provenance.Options{MaxProofs: 3})
	} else {
		proofs, err = provenance.Explain(ev.Info, ev.Store, goal, provenance.Options{MaxProofs: 3})
	}
	if err != nil {
		res.WhyError = err.Error()
		return res, nil
	}
	for _, p := range proofs {
		res.Why = append(res.Why, toProof(p, 0))
	}
	return res, nil
}

// strataOf lists the predicates of each stratum in evaluation order.
func strataOf(ev *Evaluation) [][]string {
	out := make([][]string, 0, len(ev.Stats.Strata))
	for _, stratum := range ev.Stats.Strata {
		names := make([]string, 0, len(stratum))
		for _, p := range stratum {
			names = append(names, predName(p))
		}
		sort.Strings(names)
		out = append(out, names)
	}
	return out
}

// predName renders a predicate as name/arity.
func predName(p ast.PredicateSym) string { return fmt.Sprintf("%s/%d", p.Symbol, p.Arity) }
