import { writeFileSync } from 'node:fs';
import { ok, err } from '@dc2mermaid/core';
import type { Result, Diagnostic } from '@dc2mermaid/core';

/**
 * Write diagram output to stdout or a file.
 *
 * When no outputPath is given the content is written to stdout (with a
 * trailing newline appended if the content doesn't already have one).
 *
 * Returns ok(undefined) on success, or err(Diagnostic) when the file write
 * fails so the caller can surface a structured error rather than an
 * unhandled exception.
 */
export function writeOutput(content: string, outputPath?: string): Result<void, Diagnostic> {
  const withNewline = content.endsWith('\n') ? content : content + '\n';

  if (outputPath === undefined) {
    process.stdout.write(withNewline);
    return ok(undefined);
  }

  try {
    writeFileSync(outputPath, withNewline, 'utf-8');
    return ok(undefined);
  } catch (e) {
    return err({
      code: 'E001',
      message: `Failed to write output file '${outputPath}': ${e instanceof Error ? e.message : String(e)}`,
    } satisfies Diagnostic);
  }
}
