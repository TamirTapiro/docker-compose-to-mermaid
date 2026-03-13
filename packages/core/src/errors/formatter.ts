import type { Diagnostic } from '../types/result.js';

/**
 * Format a diagnostic as a Rust-style compiler message:
 *
 * error[E001]: File not found
 *   --> docker-compose.yml
 *   = help: Ensure the file exists...
 */
export function formatDiagnostic(d: Diagnostic): string {
  const isError = d.code.startsWith('E');
  const kind = isError ? 'error' : 'warning';
  const lines: string[] = [];

  lines.push(`${kind}[${d.code}]: ${d.message}`);

  if (d.file) {
    const location =
      d.line !== undefined
        ? `${d.file}:${d.line}${d.column !== undefined ? `:${d.column}` : ''}`
        : d.file;
    lines.push(`  --> ${location}`);
  }

  if (d.help) {
    lines.push(`  = help: ${d.help}`);
  }

  return lines.join('\n');
}

export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics.map(formatDiagnostic).join('\n\n');
}
