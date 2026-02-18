/**
 * References command - find all references.
 */
import { ReferencesResult, PositionOptions } from '../types';
export interface ReferencesOptions extends PositionOptions {
    includeDeclaration: boolean;
}
/**
 * Run the references command.
 */
export declare function runReferences(file: string, options: ReferencesOptions): ReferencesResult;
//# sourceMappingURL=references.d.ts.map