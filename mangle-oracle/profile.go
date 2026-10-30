package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// A Profile says how a host's Go code talks to Mangle: which types are
// facts, which calls write, read and remove them, and how each fact type
// turns a Go string into a constant. The boundary rules are generic; a
// profile carries one host's conventions. Built-in profiles live in
// profiles/; a project overrides them with .mangle/oracle-profile.json.
type Profile struct {
	Name    string   `json:"name"`
	Doc     string   `json:"doc"`
	Modules []string `json:"modules"` // go.mod module paths that select this profile
	// FactTypes are struct types named Fact, by the package that defines them.
	FactTypes []struct {
		ImportSuffix string `json:"importSuffix"`
		Package      string `json:"package"`
		Regime       string `json:"regime"`
	} `json:"factTypes"`
	AssertPrefixes  []string `json:"assertPrefixes"`
	RetractPrefixes []string `json:"retractPrefixes"`
	QueryMethods    []string `json:"queryMethods"`
	VariadicAssert  struct {
		Method string `json:"method"`
		Regime string `json:"regime"`
	} `json:"variadicAssert"`
	ProgramLoadMethods []string `json:"programLoadMethods"`
	AssertHelperVerbs  []string `json:"assertHelperVerbs"`
	// NameTypes and StringTypes are Go types whose values become names or strings.
	NameTypes   []string `json:"nameTypes"`
	StringTypes []string `json:"stringTypes"`
}

// Regimes: how a fact type converts a Go string argument.
const (
	// RegimeNameHeuristic: a string that looks like a name becomes a name.
	RegimeNameHeuristic = "/name_heuristic"
	// RegimeDeclCoerced: a string takes the type its Decl declares.
	RegimeDeclCoerced = "/decl_coerced"
	// RegimeUnknown: the conversion is not known; strings prove nothing.
	RegimeUnknown = "/unknown"
)

//go:embed profiles/*.json
var builtinProfiles embed.FS

func readProfile(data []byte, from string) (*Profile, error) {
	var p Profile
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("profile %s: %w", from, err)
	}
	if p.ProgramLoadMethods == nil {
		p.ProgramLoadMethods = []string{"LoadSchemaString", "LoadProgramString", "LoadProgram", "LoadString"}
	}
	return &p, nil
}

// BuiltinProfile returns a profile shipped with the oracle.
func BuiltinProfile(name string) (*Profile, error) {
	data, err := builtinProfiles.ReadFile("profiles/" + name + ".json")
	if err != nil {
		return nil, fmt.Errorf("no built-in profile %q", name)
	}
	return readProfile(data, name)
}

var moduleLine = regexp.MustCompile(`(?m)^module\s+(\S+)`)

// SelectProfile picks the profile for a module root: an explicit choice (a
// built-in name or a JSON path), else root/.mangle/oracle-profile.json, else
// the built-in profile whose modules list the go.mod module, else generic.
func SelectProfile(root, choice string) (*Profile, error) {
	if choice != "" {
		if strings.HasSuffix(choice, ".json") {
			data, err := os.ReadFile(choice)
			if err != nil {
				return nil, err
			}
			return readProfile(data, choice)
		}
		return BuiltinProfile(choice)
	}
	local := filepath.Join(root, ".mangle", "oracle-profile.json")
	if data, err := os.ReadFile(local); err == nil {
		return readProfile(data, local)
	}
	if gomod, err := os.ReadFile(filepath.Join(root, "go.mod")); err == nil {
		if m := moduleLine.FindSubmatch(gomod); m != nil {
			entries, _ := builtinProfiles.ReadDir("profiles")
			for _, e := range entries {
				p, err := BuiltinProfile(strings.TrimSuffix(e.Name(), ".json"))
				if err != nil {
					continue
				}
				for _, mod := range p.Modules {
					if mod == string(m[1]) {
						return p, nil
					}
				}
			}
		}
	}
	return BuiltinProfile("generic")
}

func (p *Profile) hasPrefix(name string, prefixes []string) bool {
	for _, pre := range prefixes {
		if strings.HasPrefix(name, pre) {
			return true
		}
	}
	return false
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}
