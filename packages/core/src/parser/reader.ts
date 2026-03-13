import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { ok } from '../types/result.js';
import { loadFile } from './loader.js';
import type { Result, Diagnostic } from '../types/result.js';
import type { RawCompose } from '../types/compose.js';

/**
 * Priority order for auto-discovery — mirrors Docker Compose's own resolution order.
 * The first file found in the given directory wins.
 */
const COMPOSE_FILE_PRIORITY = [
  'compose.yaml',
  'compose.yml',
  'docker-compose.yaml',
  'docker-compose.yml',
] as const;

/**
 * Auto-discover the first Compose file in `dir` using the canonical priority order.
 * Returns the resolved absolute path, or null if no Compose file is present.
 */
export async function discoverComposeFile(dir: string): Promise<string | null> {
  for (const filename of COMPOSE_FILE_PRIORITY) {
    const fullPath = join(dir, filename);
    try {
      await access(fullPath);
      return fullPath;
    } catch {
      // File not accessible — try the next candidate.
    }
  }
  return null;
}

/**
 * Load and parse multiple Compose files in parallel.
 *
 * Each element in the returned array corresponds 1-to-1 with the input `filePaths` array.
 * On success the value is the parsed RawCompose augmented with `_sourceFile` so downstream
 * consumers can always trace data back to its origin file.
 * On failure the element carries a Diagnostic describing exactly what went wrong.
 *
 * Callers own the decision of whether to abort on first error or collect all errors.
 */
export async function loadFiles(
  filePaths: string[],
): Promise<Array<Result<RawCompose & { _sourceFile: string }, Diagnostic>>> {
  return Promise.all(
    filePaths.map(async (filePath) => {
      const result = await loadFile(filePath);
      if (!result.ok) return result;
      return ok({ ...result.value, _sourceFile: filePath });
    }),
  );
}
