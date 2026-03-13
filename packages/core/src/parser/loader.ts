import { readFile } from 'node:fs/promises';
import { parse as parseYaml, YAMLParseError } from 'yaml';
import { ok, err } from '../types/result.js';
import type { Result, Diagnostic } from '../types/result.js';
import type { RawCompose } from '../types/compose.js';

/**
 * Read a file from disk and parse it as YAML, returning a typed RawCompose on success
 * or a structured Diagnostic on failure.
 *
 * Error codes:
 *   E001 — file not found (ENOENT)
 *   E002 — YAML syntax error
 *   E003 — parsed value is not an object (e.g. bare string or array at root)
 */
export async function loadFile(filePath: string): Promise<Result<RawCompose, Diagnostic>> {
  // Step 1: Read the file from disk.
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (e) {
    const nodeError = e as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return err({
        code: 'E001',
        message: `File not found: ${filePath}`,
        file: filePath,
        help: 'Ensure the file exists or remove it from the --files argument.',
      } satisfies Diagnostic);
    }
    // Re-throw unexpected I/O errors (permission denied, etc.) — not our responsibility to swallow.
    throw e;
  }

  // Step 2: Parse the YAML content.
  let parsed: unknown;
  try {
    parsed = parseYaml(content, { prettyErrors: true });
  } catch (e) {
    if (e instanceof YAMLParseError) {
      const pos = e.linePos?.[0];
      return err({
        code: 'E002',
        message: `YAML syntax error in ${filePath}: ${e.message}`,
        file: filePath,
        ...(pos?.line !== undefined && { line: pos.line }),
        ...(pos?.col !== undefined && { column: pos.col }),
        help: 'Check for tabs (use spaces), missing colons, or incorrect indentation.',
      } satisfies Diagnostic);
    }
    throw e;
  }

  // Step 3: Ensure the root value is a plain object.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return err({
      code: 'E003',
      message: `Invalid Compose file: ${filePath} — root value must be a YAML mapping (object), got ${Array.isArray(parsed) ? 'array' : typeof parsed}.`,
      file: filePath,
    } satisfies Diagnostic);
  }

  return ok(parsed as RawCompose);
}
