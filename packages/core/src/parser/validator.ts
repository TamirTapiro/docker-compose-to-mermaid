import { composeSchema } from './schema.js';
import { ok, err } from '../types/result.js';
import type { Result, Diagnostic } from '../types/result.js';
import type { RawCompose } from '../types/compose.js';

export interface ValidationResult {
  document: RawCompose;
  warnings: Diagnostic[];
}

/**
 * Validate a raw parsed YAML object against the Compose schema.
 *
 * - Fatal schema violations → Result.err with code E003
 * - Unknown top-level keys → warnings (code W002), not fatal unless strict mode
 *
 * In strict mode, unknown top-level keys are promoted to fatal errors.
 */
export function validateComposeDocument(
  raw: unknown,
  options: { strict?: boolean; sourceFile?: string } = {},
): Result<ValidationResult, Diagnostic> {
  const parseResult = composeSchema.safeParse(raw);

  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    const diagnostic: Diagnostic = {
      code: 'E003',
      message: `Schema validation failed: ${firstError?.message ?? 'unknown error'}`,
      help: `Path: ${firstError?.path.join('.') ?? 'unknown'}. Check the Docker Compose documentation.`,
      ...(options.sourceFile !== undefined && { file: options.sourceFile }),
    };
    return err(diagnostic);
  }

  // Collect warnings for unknown top-level keys
  const warnings: Diagnostic[] = [];
  if (typeof raw === 'object' && raw !== null) {
    const knownKeys = new Set(['version', 'services', 'networks', 'volumes', 'configs', 'secrets']);
    for (const key of Object.keys(raw as Record<string, unknown>)) {
      if (!knownKeys.has(key)) {
        const warning: Diagnostic = {
          code: 'W002',
          message: `Unknown top-level key '${key}' will be ignored`,
          help: 'This key is not recognized by docker-compose-to-mermaid.',
          ...(options.sourceFile !== undefined && { file: options.sourceFile }),
        };
        warnings.push(warning);
      }
    }
  }

  // In strict mode, unknown top-level keys are fatal
  if (options.strict && warnings.length > 0) {
    const first = warnings[0]!;
    return err({
      ...first,
      code: 'E003',
      message: first.message.replace('will be ignored', 'is not allowed in strict mode'),
    });
  }

  return ok({
    document: parseResult.data as RawCompose,
    warnings,
  });
}
