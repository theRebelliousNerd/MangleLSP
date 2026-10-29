package main

import (
	"runtime/debug"
	"time"
)

// Step is the outcome of one engine stage.
type Step struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

// Verdict is the engine's judgment of one program.
type Verdict struct {
	Files []string `json:"files"`
	// Stage is the first stage that rejected the program, or "ok".
	Stage  string `json:"stage"`
	Error  string `json:"error,omitempty"`
	Parse  Step   `json:"parse"`
	Loose  *Step  `json:"loose,omitempty"`
	Strict *Step  `json:"strict,omitempty"`
	Eval   *Step  `json:"eval,omitempty"`
}

func step(err error) *Step {
	if err != nil {
		return &Step{Error: err.Error()}
	}
	return &Step{OK: true}
}

// Judge runs every stage the program reaches. Evaluation uses the loosely
// analyzed program, as hosts that analyze with AnalyzeOneUnit do; strict
// bounds checking is reported beside it.
func Judge(src Source, at time.Time) Verdict {
	v := Verdict{Files: src.Files, Stage: StageOK}
	fail := func(stage string, err error) {
		if v.Stage == StageOK {
			v.Stage, v.Error = stage, err.Error()
		}
	}
	unit, err := parseUnit(src.Text)
	if err != nil {
		v.Parse = Step{Error: err.Error()}
		fail(StageParse, err)
		return v
	}
	v.Parse = Step{OK: true}
	info, err := analyze(unit, false)
	v.Loose = step(err)
	if err != nil {
		fail(StageAnalyze, err)
		return v
	}
	_, strictErr := analyze(unit, true)
	v.Strict = step(strictErr)
	if strictErr != nil {
		fail(StageBounds, strictErr)
	}
	_, evalErr := Evaluate(info, Options{At: at})
	v.Eval = step(evalErr)
	if evalErr != nil {
		fail(StageEval, evalErr)
	}
	return v
}

// EngineVersion names the engine module this binary was built with.
func EngineVersion() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "codeberg.org/TauCeti/mangle-go (unknown version)"
	}
	for _, dep := range info.Deps {
		if dep.Path == "codeberg.org/TauCeti/mangle-go" {
			return dep.Path + " " + dep.Version
		}
	}
	return "codeberg.org/TauCeti/mangle-go (unknown version)"
}
