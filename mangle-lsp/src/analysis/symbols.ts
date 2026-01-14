/**
 * Symbol table for Mangle LSP.
 *
 * Tracks predicate definitions, variable bindings, and references
 * for providing navigation and hover information.
 */

import {
    SourceUnit,
    SourceRange,
    Decl,
    Clause,
    Atom,
    Variable,
    PredicateSym,
    isComparisonAtom,
} from '../parser/ast';
import { isWithinSourceRange } from '../utils/position';

/**
 * Information about a predicate symbol.
 */
export interface PredicateInfo {
    /** The predicate symbol */
    symbol: PredicateSym;
    /** Location of the declaration (if any) - full declaration range */
    declLocation: SourceRange | null;
    /** Location of just the predicate name in the declaration (if any) */
    declNameRange: SourceRange | null;
    /** Locations of all defining clauses (where predicate appears in head) - full atom ranges */
    definitions: SourceRange[];
    /** Locations of just the predicate names in definitions (for rename operations) */
    definitionNameRanges: SourceRange[];
    /** Locations of all references (where predicate is used in body) - full atom ranges */
    references: SourceRange[];
    /** Locations of just the predicate names in references (for rename operations) */
    referenceNameRanges: SourceRange[];
    /** Documentation from the declaration (if any) */
    documentation: string | null;
    /** Whether the predicate is declared external */
    isExternal: boolean;
    /** Whether the predicate is declared private */
    isPrivate: boolean;
}

/**
 * Information about a variable within a clause.
 */
export interface VariableInfo {
    /** The variable name */
    name: string;
    /** Location of the first binding (where variable is bound) */
    bindingLocation: SourceRange;
    /** All locations where the variable appears */
    occurrences: SourceRange[];
    /** The clause this variable belongs to */
    clauseRange: SourceRange;
}

/**
 * Calculate the predicate name range from an atom.
 * The name starts at the atom's start position and extends for the length of the predicate name.
 */
function calculatePredicateNameRange(atom: Atom): SourceRange {
    const nameLength = atom.predicate.symbol.length;
    return {
        start: { ...atom.range.start },
        end: {
            line: atom.range.start.line,
            column: atom.range.start.column + nameLength,
            offset: atom.range.start.offset + nameLength,
        },
    };
}

/**
 * Symbol table for a Mangle source file.
 */
export class SymbolTable {
    /** Map from predicate name to predicate info */
    private predicates = new Map<string, PredicateInfo>();

    /** Map from clause range (serialized) to variable info map */
    private clauseVariables = new Map<string, Map<string, VariableInfo>>();

    /**
     * Build a symbol table from a parsed source unit.
     */
    static build(unit: SourceUnit): SymbolTable {
        const table = new SymbolTable();

        // Process declarations
        for (const decl of unit.decls) {
            table.addDeclaration(decl);
        }

        // Process clauses
        for (const clause of unit.clauses) {
            table.addClause(clause);
        }

        return table;
    }

    /**
     * Add a declaration to the symbol table.
     */
    private addDeclaration(decl: Decl): void {
        const name = decl.declaredAtom.predicate.symbol;
        const arity = decl.declaredAtom.predicate.arity;
        const key = `${name}/${arity}`;

        let info = this.predicates.get(key);
        // Extract documentation string from descr atoms if present
        const docString = this.extractDocumentation(decl.descr);
        // Calculate the name range from the declared atom
        const nameRange = calculatePredicateNameRange(decl.declaredAtom);

        if (!info) {
            info = {
                symbol: decl.declaredAtom.predicate,
                declLocation: decl.range,
                declNameRange: nameRange,
                definitions: [],
                definitionNameRanges: [],
                references: [],
                referenceNameRanges: [],
                documentation: docString,
                isExternal: this.detectIsExternal(decl.descr),
                isPrivate: this.detectIsPrivate(decl.descr),
            };
            this.predicates.set(key, info);
        } else {
            // Update with declaration info
            info.declLocation = decl.range;
            info.declNameRange = nameRange;
            info.documentation = docString || info.documentation;
            info.isPrivate = this.detectIsPrivate(decl.descr);
        }
    }

    /**
     * Extract documentation string from descr atoms.
     */
    private extractDocumentation(descr: Atom[] | null): string | null {
        if (!descr || descr.length === 0) {
            return null;
        }
        // Look for doc(...) atoms in the description
        for (const atom of descr) {
            if (atom.predicate.symbol === 'doc' && atom.args.length > 0) {
                const arg = atom.args[0];
                if (arg && arg.type === 'Constant' && (arg as { symbol?: string }).symbol) {
                    return (arg as { symbol: string }).symbol;
                }
            }
        }
        return null;
    }

    /**
     * Detect if a predicate is external from descr atoms.
     * External predicates are typically marked with mode atoms that have '+' (bound) patterns.
     */
    private detectIsExternal(descr: Atom[] | null): boolean {
        if (!descr || descr.length === 0) {
            return false;
        }
        // Look for external() or mode(...) atoms
        for (const atom of descr) {
            if (atom.predicate.symbol === 'external' || atom.predicate.symbol === 'mode') {
                return true;
            }
        }
        return false;
    }

    /**
     * Detect if a predicate is private from descr atoms.
     */
    private detectIsPrivate(descr: Atom[] | null): boolean {
        if (!descr || descr.length === 0) {
            return false;
        }
        // Look for private() atom
        for (const atom of descr) {
            if (atom.predicate.symbol === 'private') {
                return true;
            }
        }
        return false;
    }

    /**
     * Add a clause to the symbol table.
     */
    private addClause(clause: Clause): void {
        // Add head predicate as definition
        const headName = clause.head.predicate.symbol;
        const headArity = clause.head.predicate.arity;
        const headKey = `${headName}/${headArity}`;

        let headInfo = this.predicates.get(headKey);
        if (!headInfo) {
            headInfo = {
                symbol: clause.head.predicate,
                declLocation: null,
                declNameRange: null,
                definitions: [],
                definitionNameRanges: [],
                references: [],
                referenceNameRanges: [],
                documentation: null,
                isExternal: false,
                isPrivate: false,
            };
            this.predicates.set(headKey, headInfo);
        }
        headInfo.definitions.push(clause.head.range);
        headInfo.definitionNameRanges.push(calculatePredicateNameRange(clause.head));

        // Track variables in this clause
        const clauseKey = this.rangeKey(clause.range);
        const variables = new Map<string, VariableInfo>();
        this.clauseVariables.set(clauseKey, variables);

        // Collect variables from head
        this.collectVariables(clause.head, clause.range, variables, true);

        // Collect predicates and variables from premises
        if (clause.premises) {
            for (const premise of clause.premises) {
                if (premise.type === 'Atom') {
                    const atom = premise as Atom;
                    // Check if this is a comparison atom (:lt, :le, :gt, :ge)
                    if (isComparisonAtom(atom)) {
                        // Comparison atoms don't bind variables, they only check bound values
                        for (const arg of atom.args) {
                            if ((arg as Variable)?.type === 'Variable') {
                                this.addVariableOccurrence(arg as Variable, clause.range, variables, false);
                            }
                        }
                    } else {
                        // Regular atom - add reference and collect variables
                        this.addReference(atom);
                        this.collectVariables(atom, clause.range, variables, true);
                    }
                } else if (premise.type === 'NegAtom') {
                    const negAtom = premise as { type: 'NegAtom'; atom: Atom; range: SourceRange };
                    this.addReference(negAtom.atom);
                    this.collectVariables(negAtom.atom, clause.range, variables, false);
                } else if (premise.type === 'Eq' || premise.type === 'Ineq') {
                    // Collect variables from equality/inequality terms
                    const cmp = premise as { left: Variable | unknown; right: Variable | unknown; range: SourceRange };
                    if ((cmp.left as Variable)?.type === 'Variable') {
                        this.addVariableOccurrence(cmp.left as Variable, clause.range, variables, premise.type === 'Eq');
                    }
                    if ((cmp.right as Variable)?.type === 'Variable') {
                        this.addVariableOccurrence(cmp.right as Variable, clause.range, variables, false);
                    }
                }
            }
        }
    }

    /**
     * Add a predicate reference (from body).
     */
    private addReference(atom: Atom): void {
        const name = atom.predicate.symbol;
        const arity = atom.predicate.arity;
        const key = `${name}/${arity}`;

        let info = this.predicates.get(key);
        if (!info) {
            info = {
                symbol: atom.predicate,
                declLocation: null,
                declNameRange: null,
                definitions: [],
                definitionNameRanges: [],
                references: [],
                referenceNameRanges: [],
                documentation: null,
                isExternal: false,
                isPrivate: false,
            };
            this.predicates.set(key, info);
        }
        info.references.push(atom.range);
        info.referenceNameRanges.push(calculatePredicateNameRange(atom));
    }

    /**
     * Collect variables from an atom.
     */
    private collectVariables(
        atom: Atom,
        clauseRange: SourceRange,
        variables: Map<string, VariableInfo>,
        binds: boolean
    ): void {
        for (const arg of atom.args) {
            if (arg.type === 'Variable') {
                this.addVariableOccurrence(arg, clauseRange, variables, binds);
            } else if (arg.type === 'ApplyFn') {
                // Recurse into function arguments
                for (const fnArg of (arg as { args: Array<{ type: string; range: SourceRange }> }).args) {
                    if (fnArg.type === 'Variable') {
                        this.addVariableOccurrence(fnArg as unknown as Variable, clauseRange, variables, false);
                    }
                }
            }
        }
    }

    /**
     * Add a variable occurrence.
     */
    private addVariableOccurrence(
        variable: Variable,
        clauseRange: SourceRange,
        variables: Map<string, VariableInfo>,
        binds: boolean
    ): void {
        // Skip anonymous variables
        if (variable.symbol === '_') {
            return;
        }

        let info = variables.get(variable.symbol);
        if (!info) {
            info = {
                name: variable.symbol,
                bindingLocation: variable.range,
                occurrences: [],
                clauseRange,
            };
            variables.set(variable.symbol, info);
        }

        info.occurrences.push(variable.range);

        // Update binding location if this is a binding occurrence and earlier
        if (binds && this.isBefore(variable.range, info.bindingLocation)) {
            info.bindingLocation = variable.range;
        }
    }

    /**
     * Check if range a is before range b.
     */
    private isBefore(a: SourceRange, b: SourceRange): boolean {
        if (a.start.line < b.start.line) return true;
        if (a.start.line > b.start.line) return false;
        return a.start.column < b.start.column;
    }

    /**
     * Get a unique key for a source range.
     */
    private rangeKey(range: SourceRange): string {
        return `${range.start.line}:${range.start.column}-${range.end.line}:${range.end.column}`;
    }

    // Public query methods

    /**
     * Get predicate info by name and arity.
     */
    getPredicate(name: string, arity: number): PredicateInfo | undefined {
        return this.predicates.get(`${name}/${arity}`);
    }

    /**
     * Get all predicates.
     */
    getAllPredicates(): PredicateInfo[] {
        return Array.from(this.predicates.values());
    }

    /**
     * Get predicate names for completion.
     */
    getPredicateNames(): string[] {
        return Array.from(this.predicates.keys());
    }

    /**
     * Get predicate info by full name (name/arity format).
     */
    getPredicateInfo(fullName: string): PredicateInfo | undefined {
        return this.predicates.get(fullName);
    }

    /**
     * Get all arities for a predicate base name.
     */
    getPredicateArities(baseName: string): number[] {
        const arities: number[] = [];
        for (const [key, info] of this.predicates) {
            if (key.startsWith(baseName + '/')) {
                arities.push(info.symbol.arity);
            }
        }
        return arities;
    }

    /**
     * Find variable info at a given position.
     */
    findVariableAt(line: number, column: number): VariableInfo | undefined {
        for (const [, variables] of this.clauseVariables) {
            for (const [, info] of variables) {
                for (const occ of info.occurrences) {
                    if (isWithinSourceRange(line, column, occ)) {
                        return info;
                    }
                }
            }
        }
        return undefined;
    }

    /**
     * Find predicate info at a given position.
     */
    findPredicateAt(line: number, column: number): PredicateInfo | undefined {
        for (const info of this.predicates.values()) {
            // Check declaration
            if (info.declLocation && isWithinSourceRange(line, column, info.declLocation)) {
                return info;
            }
            // Check definitions
            for (const def of info.definitions) {
                if (isWithinSourceRange(line, column, def)) {
                    return info;
                }
            }
            // Check references
            for (const ref of info.references) {
                if (isWithinSourceRange(line, column, ref)) {
                    return info;
                }
            }
        }
        return undefined;
    }

    /**
     * Get variables for a clause at a given position.
     */
    getClauseVariables(clauseRange: SourceRange): Map<string, VariableInfo> {
        return this.clauseVariables.get(this.rangeKey(clauseRange)) || new Map();
    }
}

/**
 * Build a symbol table from a parsed source unit.
 */
export function buildSymbolTable(unit: SourceUnit): SymbolTable {
    return SymbolTable.build(unit);
}
