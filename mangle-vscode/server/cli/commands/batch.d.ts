/**
 * Batch command - run multiple queries in a single call.
 */
import { CommonOptions } from '../types';
/**
 * Batch query types.
 */
export type BatchQueryType = 'hover' | 'definition' | 'references' | 'completion' | 'symbols' | 'diagnostics' | 'format' | 'fileInfo';
/**
 * A single batch query.
 */
export interface BatchQuery {
    id?: string | number;
    type: BatchQueryType;
    file: string;
    line?: number;
    column?: number;
    includeDeclaration?: boolean;
}
/**
 * Result of a single batch query.
 */
export interface BatchResult {
    id?: string | number;
    type: BatchQueryType;
    file: string;
    result: any;
    error?: string;
}
/**
 * Full batch result.
 */
export interface BatchOutput {
    version: string;
    results: BatchResult[];
    summary: {
        total: number;
        succeeded: number;
        failed: number;
    };
}
/**
 * Run batch queries.
 */
export declare function runBatch(queries: BatchQuery[], _options: CommonOptions): BatchOutput;
/**
 * Parse batch queries from JSON string or file.
 */
export declare function parseBatchInput(input: string): BatchQuery[];
//# sourceMappingURL=batch.d.ts.map