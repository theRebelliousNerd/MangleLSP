// Command mangle-oracle answers questions about Mangle programs with the real
// engine (codeberg.org/TauCeti/mangle-go), for mangle-cli and its tests.
//
//	mangle-oracle version
//	mangle-oracle verdict [--program] files...      engine verdict per file (or for the assembled program)
//	mangle-oracle run --query pred [--why atom] files...
//	mangle-oracle whynot --goal atom files...
//	mangle-oracle boundary [--root dir] [--profile p] Go <-> .mg boundary findings for a Go module
//
// Every command prints one JSON document on stdout. --at RFC3339 pins the
// evaluation time.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"
)

func main() {
	os.Exit(run(os.Args[1:]))
}

func emit(v any) int {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	return 0
}

func fail(err error) int {
	fmt.Fprintln(os.Stderr, "mangle-oracle:", err)
	return 2
}

func run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: mangle-oracle version|verdict|run|whynot|boundary ...")
		return 2
	}
	fs := flag.NewFlagSet(args[0], flag.ContinueOnError)
	program := fs.Bool("program", false, "judge all files as one assembled program")
	query := fs.String("query", "", "predicate to list (name or name/arity)")
	why := fs.String("why", "", "ground atom to explain with a proof")
	goal := fs.String("goal", "", "atom to diagnose (constants fix columns, variables leave them open)")
	atText := fs.String("at", "", "evaluation time (RFC3339)")
	root := fs.String("root", ".", "module root for boundary")
	profile := fs.String("profile", "", "host profile: a built-in name (generic, codenerd) or a JSON file; default: .mangle/oracle-profile.json, else by go.mod module")
	if err := fs.Parse(args[1:]); err != nil {
		return 2
	}
	at := time.Now()
	if *atText != "" {
		t, err := time.Parse(time.RFC3339, *atText)
		if err != nil {
			return fail(err)
		}
		at = t
	}
	files := fs.Args()
	switch args[0] {
	case "version":
		return emit(map[string]string{"engine": EngineVersion()})
	case "verdict":
		out := struct {
			Engine   string    `json:"engine"`
			Verdicts []Verdict `json:"verdicts"`
		}{Engine: EngineVersion(), Verdicts: []Verdict{}}
		groups := [][]string{files}
		if !*program {
			groups = groups[:0]
			for _, f := range files {
				groups = append(groups, []string{f})
			}
		}
		for _, g := range groups {
			src, err := LoadSource(g)
			if err != nil {
				return fail(err)
			}
			out.Verdicts = append(out.Verdicts, Judge(src, at))
		}
		return emit(out)
	case "run":
		if *query == "" {
			return fail(fmt.Errorf("run needs --query"))
		}
		src, err := LoadSource(files)
		if err != nil {
			return fail(err)
		}
		ev, stage, err := Build(src, Options{At: at, Record: *why != ""})
		if err != nil {
			return emit(map[string]any{"engine": EngineVersion(), "stage": stage, "error": err.Error()})
		}
		res, err := Run(ev, *query, *why)
		if err != nil {
			return fail(err)
		}
		return emit(map[string]any{"engine": EngineVersion(), "stage": stage, "result": res, "strata": strataOf(ev)})
	case "whynot":
		if *goal == "" {
			return fail(fmt.Errorf("whynot needs --goal"))
		}
		src, err := LoadSource(files)
		if err != nil {
			return fail(err)
		}
		res, err := WhyNot(src, *goal, at)
		if err != nil {
			return fail(err)
		}
		return emit(map[string]any{"engine": EngineVersion(), "result": res})
	case "boundary":
		prof, err := SelectProfile(*root, *profile)
		if err != nil {
			return fail(err)
		}
		rep, err := Boundary(*root, prof)
		if err != nil {
			return fail(err)
		}
		return emit(rep)
	default:
		return fail(fmt.Errorf("unknown command %q", args[0]))
	}
}
