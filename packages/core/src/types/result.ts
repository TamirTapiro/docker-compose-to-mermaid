export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

// Error types
export type ErrorCode =
  | 'E001' // File not found
  | 'E002' // YAML syntax error
  | 'E003' // Schema validation error
  | 'E004'; // Renderer error

export type WarningCode =
  | 'W001' // Unknown image
  | 'W002' // Unsupported feature
  | 'W003' // Inference ambiguity
  | 'W004'; // Cross-network reference

export interface Diagnostic {
  readonly code: ErrorCode | WarningCode;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly help?: string;
}
