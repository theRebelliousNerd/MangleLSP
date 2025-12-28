/**
 * Symbol table for Mangle LSP.
 *
 * Tracks predicate definitions, variable bindings, and references
 * for providing navigation and hover information.
 */
import { SourceUnit, SourceRange, PredicateSym } from '../parser/ast';
/**
 * Information about a predicate symbol.
 */
export interface PredicateInfo {
    /** The predicate symbol */
    symbol: PredicateSym;
    /** Location of the declaration (if any) */
    declLocation: SourceRange | null;
    /** Locations of all defining clauses (where predicate appears in head) */
    definitions: SourceRange[];
    /** Locations of all references (where predicate is used in body) */
    references: SourceRange[];
    /** Documentation from the declaration (if any) */
    documentation: string | null;
    /** Whether the predicate is declared external */
    isExternal: boolean;
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
 * Symbol table for a Mangle source file.
 */
export declare class SymbolTable {
    /** Map from predicate name to predicate info */
    private predicates;
    /** Map from clause range (serialized) to variable info map */
    private clauseVariables;
    /**
     * Build a symbol table from a parsed source unit.
     */
    static build(unit: SourceUnit): SymbolTable;
    /**
     * Add a declaration to the symbol table.
     */
    private addDeclaration;
    /**
     * Extract documentation string from descr atoms.
     */
    private extractDocumentation;
    /**
     * Detect if a predicate is external from descr atoms.
     * External predicates are typically marked with mode atoms that have '+' (bound) patterns.
     */
    private detectIsExternal;
    /**
     * Add a clause to the symbol table.
     */
    private addClause;
    /**
     * Add a predicate reference (from body).
     */
    private addReference;
    /**
     * Collect variables from an atom.
     */
    private collectVariables;
    /**
     * Add a variable occurrence.
     */
    private addVariableOccurrence;
    /**
     * Check if range a is before range b.
     */
    private isBefore;
    /**
     * Get a unique key for a source range.
     */
    private rangeKey;
    /**
     * Get predicate info by name and arity.
     */
    getPredicate(name: string, arity: number): PredicateInfo | undefined;
    /**
     * Get all predicates.
     */
    getAllPredicates(): PredicateInfo[];
    /**
     * Get predicate names for completion.
     */
    getPredicateNames(): string[];
    /**
     * Find variable info at a given position.
     */
    findVariableAt(line: number, column: number): VariableInfo | undefined;
    /**
     * Find predicate info at a given position.
     */
    findPredicateAt(line: number, column: number): PredicateInfo | undefined;
    /**
     * Check if a position is within a range.
     */
    private isWithinRange;
    /**
     * Get variables for a clause at a given position.
     */
    getClauseVariables(clauseRange: SourceRange): Map<string, VariableInfo>;
}
/**
 * Build a symbol table from a parsed source unit.
 */
export declare function buildSymbolTable(unit: SourceUnit): SymbolTable;
//# sourceMappingURL=symbols.d.ts.map