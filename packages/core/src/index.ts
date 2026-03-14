import type { GenerateOptions, RenderOptions } from './types/renderer.js';
import type { IRGraph } from './types/graph.js';
import type { NormalizedCompose } from './types/compose.js';

// Re-export all public types — consumers import types from '@dc2mermaid/core'
export * from './types/index.js';
export * from './errors/index.js';
export * from './analyzer/index.js';

// ─── Step-by-step pipeline API ──────────────────────────────────────────────

/**
 * Stage 1: Load and parse Compose file(s) into a normalized document.
 * Accepts one or more file paths; if multiple, they are merged (base + overrides).
 *
 * @throws never — errors are returned as rejected promises with typed Diagnostic objects
 */
export async function parse(files: string[]): Promise<NormalizedCompose> {
  // TODO: implement in issues #3, #5, #6
  // Will call: loadFiles() → validateComposeDocument() → normalize() → merge()
  throw new Error(
    `parse() not yet implemented. Waiting for issues #3, #5, #6. Files: ${files.join(', ')}`,
  );
}

/**
 * Stage 2: Analyze a normalized Compose document and produce an IR graph.
 * Runs the IR builder + all inference strategies + edge deduplication.
 */
export function analyze(doc: NormalizedCompose): IRGraph {
  // TODO: implement in issues #8–#15
  void doc;
  throw new Error('analyze() not yet implemented. Waiting for issues #8–#15.');
}

/**
 * Stage 3: Render an IR graph to a Mermaid syntax string.
 */
export function render(graph: IRGraph, options: RenderOptions): string {
  // TODO: implement in issues #16, #17, #18
  void graph;
  void options;
  throw new Error('render() not yet implemented. Waiting for issues #16–#18.');
}

/**
 * Export IR graph as JSON (for programmatic consumers).
 */
export function toJSON(graph: IRGraph): string {
  return JSON.stringify(graph, null, 2);
}

// ─── High-level convenience API ─────────────────────────────────────────────

/**
 * All-in-one: file path(s) in, Mermaid string out.
 * Composes parse → analyze → render.
 */
export async function generate(options: GenerateOptions): Promise<string> {
  const doc = await parse(options.files);
  const graph = analyze(doc);
  return render(graph, options.render);
}

// ─── Renderers ───────────────────────────────────────────────────────────────

export { flowchartRenderer, c4Renderer, architectureRenderer } from './renderer/index.js';

// ─── Config loading & merging ────────────────────────────────────────────────

export * from './config/index.js';
