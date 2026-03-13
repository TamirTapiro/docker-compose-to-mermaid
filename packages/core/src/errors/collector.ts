import type { Diagnostic } from '../types/result.js';

/**
 * Collects warnings and errors emitted during the pipeline run.
 * Passed through each stage so they can append their diagnostics.
 */
export class DiagnosticCollector {
  private readonly items: Diagnostic[] = [];

  add(diagnostic: Diagnostic): void {
    this.items.push(diagnostic);
  }

  addAll(diagnostics: Diagnostic[]): void {
    this.items.push(...diagnostics);
  }

  get diagnostics(): readonly Diagnostic[] {
    return this.items;
  }

  get hasErrors(): boolean {
    return this.items.some((d) => d.code.startsWith('E'));
  }

  get hasWarnings(): boolean {
    return this.items.some((d) => d.code.startsWith('W'));
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
