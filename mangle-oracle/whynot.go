package main

import (
	"fmt"
	"sort"
	"time"

	"codeberg.org/TauCeti/mangle-go/analysis"
	"codeberg.org/TauCeti/mangle-go/ast"
	"codeberg.org/TauCeti/mangle-go/parse"
)

// Why-not works with programs as data: for every rule that could derive the
// goal, it writes one probe rule per body prefix (in the order the engine
// evaluates the body, after RewriteClause), adds the probes to the program,
// evaluates once, and reads how many rows survive each premise. The first
// premise that leaves no rows is what blocks the goal.

// FunnelStep is one premise of a rule body and the rows that survive it.
type FunnelStep struct {
	Premise string `json:"premise"`
	Rows    int    `json:"rows"`
}

// RuleDiagnosis explains why one rule does not derive the goal.
type RuleDiagnosis struct {
	Rule string `json:"rule"`
	// Funnel lists the premises in evaluation order with surviving rows.
	Funnel []FunnelStep `json:"funnel,omitempty"`
	// BlockedAt is the index in Funnel of the first premise with no rows (-1 if none).
	BlockedAt int    `json:"blockedAt"`
	Reason    string `json:"reason"`
}

// WhyNotResult explains why a goal has no facts (or which rules fail).
type WhyNotResult struct {
	Goal    string          `json:"goal"`
	Holds   []string        `json:"holds,omitempty"`
	Kind    string          `json:"kind"`
	Rules   []RuleDiagnosis `json:"rules"`
	Summary string          `json:"summary"`
}

type probe struct {
	rule, step int
	head       ast.Atom
}

// boundVars are the variables a premise can bind: those of positive atoms
// and equalities (wildcards excluded).
func boundVars(premises []ast.Term) []ast.BaseTerm {
	seen := map[ast.Variable]bool{}
	var out []ast.BaseTerm
	for _, p := range premises {
		vars := map[ast.Variable]bool{}
		switch p := p.(type) {
		case ast.Atom:
			if p.Predicate.IsBuiltin() {
				continue
			}
			ast.AddVars(p, vars)
		case ast.Eq:
			ast.AddVars(p, vars)
		default:
			continue
		}
		var names []ast.Variable
		for v := range vars {
			if v.Symbol != "_" && !seen[v] {
				names = append(names, v)
			}
		}
		sort.Slice(names, func(i, j int) bool { return names[i].Symbol < names[j].Symbol })
		for _, v := range names {
			seen[v] = true
			out = append(out, v)
		}
	}
	return out
}

// specialize binds the rule head to the goal's constants with equalities.
func specialize(rule ast.Clause, goal ast.Atom) ([]ast.Term, string) {
	var pre []ast.Term
	for i, arg := range goal.Args {
		c, ok := arg.(ast.Constant)
		if !ok {
			continue
		}
		switch h := rule.Head.Args[i].(type) {
		case ast.Variable:
			pre = append(pre, ast.Eq{Left: h, Right: c})
		case ast.Constant:
			if !h.Equals(c) {
				return nil, fmt.Sprintf("the head has %v where the goal has %v", h, c)
			}
		default:
			pre = append(pre, ast.Eq{Left: h, Right: c})
		}
	}
	return append(pre, rule.Premises...), ""
}

// WhyNot diagnoses a goal such as "q(/a)" or "q(X)".
func WhyNot(src Source, goalText string, at time.Time) (WhyNotResult, error) {
	goal, err := parse.Atom(goalText)
	if err != nil {
		return WhyNotResult{}, err
	}
	unit, err := parseUnit(src.Text)
	if err != nil {
		return WhyNotResult{}, err
	}
	info, err := analyze(unit, false)
	if err != nil {
		return WhyNotResult{}, err
	}
	res := WhyNotResult{Goal: goal.String(), Rules: []RuleDiagnosis{}}
	sym := goal.Predicate
	if _, ok := info.Decls[sym]; !ok {
		return res, fmt.Errorf("no predicate %s in the program", predName(sym))
	}
	ev, err := Evaluate(info, Options{At: at})
	if err != nil {
		return res, fmt.Errorf("evaluation failed: %w", err)
	}
	for _, f := range ev.Facts(sym) {
		if a, err := parse.Atom(f); err == nil && matches(goal, a) {
			res.Holds = append(res.Holds, f)
		}
	}
	if _, idb := info.IdbPredicates[sym]; !idb {
		res.Kind = "extensional"
		if decl := info.Decls[sym]; decl != nil && decl.IsExternal() {
			res.Kind = "external"
		}
		res.Summary = summarizeEDB(res)
		return res, nil
	}
	res.Kind = "derived"

	var probes []probe
	var bodies [][]ast.Term
	var rules []ast.Clause
	for _, rule := range info.Rules {
		if rule.Head.Predicate != sym {
			continue
		}
		idx := len(rules)
		rules = append(rules, rule)
		diag := RuleDiagnosis{Rule: rule.String(), BlockedAt: -1}
		body, mismatch := specialize(rule, goal)
		if mismatch != "" {
			diag.Reason = "cannot match the goal: " + mismatch
			res.Rules = append(res.Rules, diag)
			bodies = append(bodies, nil)
			continue
		}
		rewritten := analysis.RewriteClause(info.Decls, ast.Clause{Head: rule.Head, Premises: body})
		body = rewritten.Premises
		bodies = append(bodies, body)
		for k := 1; k <= len(body); k++ {
			name := fmt.Sprintf("whynot_probe_%d_%d", idx, k)
			args := boundVars(body[:k])
			if len(args) == 0 {
				args = []ast.BaseTerm{ast.TrueConstant}
			}
			probes = append(probes, probe{rule: idx, step: k, head: ast.Atom{Predicate: ast.PredicateSym{Symbol: name, Arity: len(args)}, Args: args}})
		}
		res.Rules = append(res.Rules, diag)
	}

	counts, probeErr := runProbes(unit, probes, bodies, at)
	for i := range res.Rules {
		d := &res.Rules[i]
		if d.Reason != "" {
			continue
		}
		body := bodies[i]
		if probeErr != nil {
			d.Reason = "could not probe the body: " + probeErr.Error()
			continue
		}
		for k := 1; k <= len(body); k++ {
			rows := counts[fmt.Sprintf("whynot_probe_%d_%d", i, k)]
			d.Funnel = append(d.Funnel, FunnelStep{Premise: termString(body[k-1]), Rows: rows})
			if rows == 0 && d.BlockedAt < 0 {
				d.BlockedAt = k - 1
			}
		}
		d.Reason = explainBlock(ev, d, body, rules[i])
	}
	res.Summary = summarizeIDB(res)
	return res, nil
}

func termString(t ast.Term) string {
	if s, ok := t.(fmt.Stringer); ok {
		return s.String()
	}
	return fmt.Sprintf("%v", t)
}

func runProbes(unit parse.SourceUnit, probes []probe, bodies [][]ast.Term, at time.Time) (map[string]int, error) {
	extended := unit
	extended.Clauses = append(append([]ast.Clause{}, unit.Clauses...), probeClauses(probes, bodies)...)
	info, err := analyze(extended, false)
	if err != nil {
		return nil, err
	}
	ev, err := Evaluate(info, Options{At: at})
	if err != nil {
		return nil, err
	}
	counts := map[string]int{}
	for _, p := range probes {
		counts[p.head.Predicate.Symbol] = len(ev.Facts(p.head.Predicate))
	}
	return counts, nil
}

func probeClauses(probes []probe, bodies [][]ast.Term) []ast.Clause {
	out := make([]ast.Clause, 0, len(probes))
	for _, p := range probes {
		out = append(out, ast.Clause{Head: p.head, Premises: bodies[p.rule][:p.step]})
	}
	return out
}

func matches(goal, fact ast.Atom) bool {
	if len(goal.Args) != len(fact.Args) {
		return false
	}
	for i, a := range goal.Args {
		if c, ok := a.(ast.Constant); ok && !c.Equals(fact.Args[i]) {
			return false
		}
	}
	return true
}

func explainBlock(ev *Evaluation, d *RuleDiagnosis, body []ast.Term, rule ast.Clause) string {
	if d.BlockedAt < 0 {
		if rule.Transform != nil {
			return "the body holds; the transform produced no matching row"
		}
		return "the body holds: this rule derives matching facts"
	}
	p := body[d.BlockedAt]
	switch p := p.(type) {
	case ast.Atom:
		if p.Predicate.IsBuiltin() {
			return fmt.Sprintf("premise %d, the built-in %v, rejects every row that reaches it", d.BlockedAt+1, p.Predicate.Symbol)
		}
		n := len(ev.Facts(p.Predicate))
		if n == 0 {
			if _, idb := ev.Info.IdbPredicates[p.Predicate]; idb {
				return fmt.Sprintf("premise %d: %v has no facts at all; ask why-not on %v", d.BlockedAt+1, predName(p.Predicate), p.Predicate.Symbol)
			}
			if decl := ev.Info.Decls[p.Predicate]; decl != nil && decl.IsExternal() {
				return fmt.Sprintf("premise %d: %s is external; this run answers externals with no rows", d.BlockedAt+1, predName(p.Predicate))
			}
			return fmt.Sprintf("premise %d: %v has no facts and no rules: something outside the program must assert it", d.BlockedAt+1, predName(p.Predicate))
		}
		return fmt.Sprintf("premise %d: %v has %d facts, but none joins with the rows before it (check shared variables and name vs string constants)", d.BlockedAt+1, predName(p.Predicate), n)
	case ast.NegAtom:
		return fmt.Sprintf("premise %d: every surviving row is excluded by the negation %v", d.BlockedAt+1, p)
	case ast.Eq, ast.Ineq:
		return fmt.Sprintf("premise %d, %v, fails for every row that reaches it", d.BlockedAt+1, p)
	default:
		return fmt.Sprintf("premise %d (%v) leaves no rows", d.BlockedAt+1, p)
	}
}

func summarizeEDB(res WhyNotResult) string {
	if len(res.Holds) > 0 {
		return fmt.Sprintf("%s holds: %d matching facts", res.Goal, len(res.Holds))
	}
	if res.Kind == "external" {
		return res.Goal + " is answered by a Go callback at run time; this run has none"
	}
	return res.Goal + " has no rules: only asserted facts can make it true, and none match"
}

func summarizeIDB(res WhyNotResult) string {
	if len(res.Holds) > 0 {
		return fmt.Sprintf("%s holds: %d matching facts", res.Goal, len(res.Holds))
	}
	if len(res.Rules) == 0 {
		return res.Goal + " has no rules"
	}
	for _, r := range res.Rules {
		if r.BlockedAt >= 0 {
			return fmt.Sprintf("no rule derives %s; first block: %s", res.Goal, r.Reason)
		}
	}
	return "no rule derives " + res.Goal
}
