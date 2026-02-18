/**
 * Format command - format Mangle source files.
 */
import { FormatResult, FormatOptions } from '../types';
/**
 * Run the format command on files.
 */
export declare function runFormat(files: string[], options: FormatOptions): FormatResult[];
/**
 * Determine exit code for format check mode.
 */
export declare function getFormatExitCode(results: FormatResult[], options: FormatOptions): number;
//# sourceMappingURL=format.d.ts.map