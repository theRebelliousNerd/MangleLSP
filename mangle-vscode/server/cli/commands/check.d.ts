/**
 * Check command - run diagnostics on Mangle files.
 */
import { CheckResult, CheckOptions } from '../types';
/**
 * Run the check command on files.
 */
export declare function runCheck(files: string[], options: CheckOptions): CheckResult;
/**
 * Determine exit code based on check result and options.
 */
export declare function getExitCode(result: CheckResult, options: CheckOptions): number;
//# sourceMappingURL=check.d.ts.map