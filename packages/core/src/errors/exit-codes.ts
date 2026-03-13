import type { Diagnostic } from '../types/result.js';

export const EXIT_SUCCESS = 0;
export const EXIT_ERROR = 1;
export const EXIT_WARNINGS = 2;

/**
 * Determine the appropriate exit code given a list of diagnostics.
 * - Any error code (E*) → EXIT_ERROR (1)
 * - Only warnings (W*) → EXIT_WARNINGS (2) unless strict mode
 * - No diagnostics → EXIT_SUCCESS (0)
 */
export function getExitCode(diagnostics: Diagnostic[], strict: boolean): number {
  if (diagnostics.length === 0) return EXIT_SUCCESS;
  const hasErrors = diagnostics.some((d) => d.code.startsWith('E'));
  if (hasErrors) return EXIT_ERROR;
  // In strict mode, warnings are fatal
  if (strict) return EXIT_ERROR;
  return EXIT_WARNINGS;
}
