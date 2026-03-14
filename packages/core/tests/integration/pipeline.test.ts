/**
 * Integration tests for the full parser → normalizer → IR builder → inference → renderer pipeline.
 *
 * These tests exercise the complete data flow from a file on disk to a rendered Mermaid
 * string, verifying that all pipeline stages wire together correctly. They complement the
 * unit tests in tests/renderer/flowchart.test.ts (which test the renderer in isolation with
 * manually constructed graphs) and tests/parser/* (which test each parser stage in isolation).
 *
 * Note: The public API stubs in src/index.ts (generate, parse, analyze, render) are not yet
 * implemented and throw. These tests use the internal modules directly — the same pattern used
 * throughout the existing test suite.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { loadFile } from '../../src/parser/loader.js';
import { normalizeCompose } from '../../src/parser/normalizer.js';
import { buildIRGraph } from '../../src/analyzer/builder.js';
import { runAllInferenceStrategies } from '../../src/analyzer/inference/index.js';
import { flowchartRenderer } from '../../src/renderer/flowchart.js';
import type { RenderOptions } from '../../src/types/renderer.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXTURES = join(__dirname, '../fixtures');

/**
 * RenderOptions that match what the snapshot tests in flowchart.test.ts use,
 * ensuring integration tests produce output consistent with the expected .mmd files.
 */
const FULL_OPTIONS: RenderOptions = {
  type: 'flowchart',
  direction: 'LR',
  includeVolumes: true,
  includePorts: false,
  includeNetworkBoundaries: true,
  theme: {},
};

// ---------------------------------------------------------------------------
// Temp-file helpers
// ---------------------------------------------------------------------------

const tempFiles: string[] = [];

function writeTempFile(content: string, suffix = '.yml'): string {
  const path = join(tmpdir(), `dc2mermaid-test-${Date.now()}${suffix}`);
  writeFileSync(path, content, 'utf-8');
  tempFiles.push(path);
  return path;
}

afterEach(() => {
  tempFiles.forEach((p) => {
    try {
      rmSync(p);
    } catch {
      // ignore — file may already be gone
    }
  });
  tempFiles.length = 0;
});

// ---------------------------------------------------------------------------
// Pipeline helper — mirrors renderFixture() in flowchart.test.ts but goes
// through loadFile() so we exercise the I/O layer as well.
// ---------------------------------------------------------------------------

async function renderFromDisk(filePath: string, options: Partial<RenderOptions> = {}): Promise<string> {
  const result = await loadFile(filePath);
  if (!result.ok) {
    throw new Error(`loadFile failed: ${result.error.message}`);
  }
  const normalized = normalizeCompose(result.value, filePath);
  const baseGraph = buildIRGraph(normalized);
  const graph = runAllInferenceStrategies(baseGraph, normalized);
  return flowchartRenderer.render(graph, { ...FULL_OPTIONS, ...options });
}

function readExpected(fixtureName: string): string {
  return readFileSync(join(FIXTURES, `${fixtureName}.expected.mmd`), 'utf-8').trim();
}

// ---------------------------------------------------------------------------
// Full pipeline via loadFile → normalizeCompose → buildIRGraph → inference → render
// ---------------------------------------------------------------------------

describe('full pipeline: disk → Mermaid string', () => {
  it('simple fixture: output matches simple.expected.mmd', async () => {
    const actual = (await renderFromDisk(join(FIXTURES, 'simple.yml'))).trim();
    expect(actual).toBe(readExpected('simple'));
  });

  it('full fixture: output matches full.expected.mmd', async () => {
    const actual = (await renderFromDisk(join(FIXTURES, 'full.yml'))).trim();
    expect(actual).toBe(readExpected('full'));
  });

  it('multi-network fixture: output matches multi-network.expected.mmd', async () => {
    const actual = (await renderFromDisk(join(FIXTURES, 'multi-network.yml'))).trim();
    expect(actual).toBe(readExpected('multi-network'));
  });

  it('env-urls fixture: output matches env-urls.expected.mmd', async () => {
    const actual = (await renderFromDisk(join(FIXTURES, 'env-urls.yml'))).trim();
    expect(actual).toBe(readExpected('env-urls'));
  });

  it('multi-network fixture: output is valid Mermaid (starts with flowchart)', async () => {
    const actual = await renderFromDisk(join(FIXTURES, 'multi-network.yml'));
    expect(actual).toMatch(/^flowchart\s+(LR|TB|RL|BT)/);
  });

  it('env-urls fixture: output contains dashed edges (-.->)', async () => {
    const actual = await renderFromDisk(join(FIXTURES, 'env-urls.yml'));
    expect(actual).toContain('-.->');;
  });
});

// ---------------------------------------------------------------------------
// loadFile error handling
// ---------------------------------------------------------------------------

describe('loadFile error handling', () => {
  it('nonexistent file returns err with code E001', async () => {
    const result = await loadFile('/nonexistent/path/docker-compose.yml');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('E001');
      expect(result.error.message).toContain('/nonexistent/path/docker-compose.yml');
    }
  });

  it('invalid YAML content returns err with code E002', async () => {
    const path = writeTempFile('services:\n  api:\n    image: [unclosed bracket\n');
    const result = await loadFile(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('E002');
    }
  });

  it('YAML with non-object root (bare string) returns err with code E003', async () => {
    const path = writeTempFile('just a string\n');
    const result = await loadFile(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('E003');
    }
  });

  it('YAML with array at root returns err with code E003', async () => {
    const path = writeTempFile('- item1\n- item2\n');
    const result = await loadFile(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('E003');
    }
  });

  it('valid file returns ok with the parsed content', async () => {
    const path = writeTempFile('services:\n  api:\n    image: nginx:latest\n');
    const result = await loadFile(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveProperty('services');
    }
  });
});

// ---------------------------------------------------------------------------
// Pipeline stage: normalizeCompose
// ---------------------------------------------------------------------------

describe('normalizeCompose stage', () => {
  it('produces a normalized document with expected service names from simple.yml', async () => {
    const filePath = join(FIXTURES, 'simple.yml');
    const result = await loadFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, filePath);

    expect(Object.keys(normalized.services)).toContain('api');
    expect(Object.keys(normalized.services)).toContain('db');
    expect(normalized.sourceFiles).toEqual([filePath]);
  });

  it('records sourceFiles on the normalized document', async () => {
    const filePath = join(FIXTURES, 'full.yml');
    const result = await loadFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, filePath);
    expect(normalized.sourceFiles).toEqual([filePath]);
  });

  it('normalizes empty services gracefully', () => {
    const raw = parseYaml('services: {}\n') as Record<string, unknown>;
    const normalized = normalizeCompose(raw, 'inline');
    expect(normalized.services).toEqual({});
    expect(normalized.volumes).toEqual({});
    expect(normalized.networks).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Pipeline stage: buildIRGraph
// ---------------------------------------------------------------------------

describe('buildIRGraph stage', () => {
  it('creates a node for each service in the normalized document', async () => {
    const filePath = join(FIXTURES, 'simple.yml');
    const result = await loadFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, filePath);
    const graph = buildIRGraph(normalized);

    const nodeIds = graph.nodes.map((n) => n.id);
    expect(nodeIds).toContain('api');
    expect(nodeIds).toContain('db');
  });

  it('creates a volume node for each top-level volume', async () => {
    const filePath = join(FIXTURES, 'simple.yml');
    const result = await loadFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, filePath);
    const graph = buildIRGraph(normalized);

    expect(graph.volumes.map((v) => v.id)).toContain('db_data');
  });

  it('starts with an empty edges array before inference', async () => {
    const filePath = join(FIXTURES, 'simple.yml');
    const result = await loadFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, filePath);
    const graph = buildIRGraph(normalized);

    // Edges are populated by inference strategies, not the builder.
    expect(graph.edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Pipeline stage: runAllInferenceStrategies
// ---------------------------------------------------------------------------

describe('runAllInferenceStrategies stage', () => {
  it('adds edges from depends_on after inference (simple.yml: api → db)', async () => {
    const filePath = join(FIXTURES, 'simple.yml');
    const result = await loadFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, filePath);
    const baseGraph = buildIRGraph(normalized);
    const graph = runAllInferenceStrategies(baseGraph, normalized);

    const edge = graph.edges.find((e) => e.from === 'api' && e.to === 'db');
    expect(edge).toBeDefined();
    expect(edge?.style).toBe('solid');
    expect(edge?.source).toBe('depends_on');
  });

  it('infers dashed environment-url edges (env-urls.yml: app → db)', async () => {
    const filePath = join(FIXTURES, 'env-urls.yml');
    const result = await loadFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, filePath);
    const baseGraph = buildIRGraph(normalized);
    const graph = runAllInferenceStrategies(baseGraph, normalized);

    const dashedEdges = graph.edges.filter((e) => e.style === 'dashed');
    expect(dashedEdges.length).toBeGreaterThan(0);
  });

  it('classifies postgres image as database node type', async () => {
    const filePath = join(FIXTURES, 'simple.yml');
    const result = await loadFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, filePath);
    const baseGraph = buildIRGraph(normalized);
    const graph = runAllInferenceStrategies(baseGraph, normalized);

    const dbNode = graph.nodes.find((n) => n.id === 'db');
    expect(dbNode?.type).toBe('database');
  });

  it('metadata includes sourceFiles from the input document', async () => {
    const filePath = join(FIXTURES, 'simple.yml');
    const result = await loadFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, filePath);
    const baseGraph = buildIRGraph(normalized);
    const graph = runAllInferenceStrategies(baseGraph, normalized);

    expect(graph.metadata.sourceFiles).toEqual([filePath]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: minimal and synthetic inputs
// ---------------------------------------------------------------------------

describe('pipeline edge cases', () => {
  it('single service with no edges produces valid Mermaid output', async () => {
    // Use an unrecognised image so the node type stays 'service' → rectangle shape [label]
    const content = 'services:\n  web:\n    image: mycompany/custom-app:1.0\n';
    const path = writeTempFile(content);

    const actual = await renderFromDisk(path);
    expect(actual).toMatch(/^flowchart\s+LR/);
    expect(actual).toContain('web[web]');
  });

  it('empty services object produces a valid minimal flowchart', () => {
    const raw = parseYaml('services: {}\n') as Record<string, unknown>;
    const normalized = normalizeCompose(raw, 'inline');
    const baseGraph = buildIRGraph(normalized);
    const graph = runAllInferenceStrategies(baseGraph, normalized);
    const output = flowchartRenderer.render(graph, FULL_OPTIONS);

    expect(output).toMatch(/^flowchart\s+LR/);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it('service names with dashes are sanitized in the rendered output', () => {
    // Use an unrecognised image for my-api so inference keeps it as 'service' → [label]
    // postgres:15 is recognised as 'database' → [(label)]
    const raw = parseYaml(
      'services:\n  my-api:\n    image: mycompany/my-api:1.0\n  my-db:\n    image: postgres:15\n    depends_on:\n      - my-api\n',
    ) as Record<string, unknown>;
    const normalized = normalizeCompose(raw, 'inline');
    const baseGraph = buildIRGraph(normalized);
    const graph = runAllInferenceStrategies(baseGraph, normalized);
    const output = flowchartRenderer.render(graph, FULL_OPTIONS);

    // IDs must use underscores; labels retain the original name
    expect(output).toContain('my_api[my-api]');
    expect(output).toContain('my_db[(my-db)]');
  });

  it('multi-service with only environment-url edges has no solid edges', async () => {
    const filePath = join(FIXTURES, 'env-urls.yml');
    const result = await loadFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, filePath);
    const baseGraph = buildIRGraph(normalized);
    const graph = runAllInferenceStrategies(baseGraph, normalized);

    const solidEdges = graph.edges.filter((e) => e.style === 'solid');
    // env-urls.yml has no depends_on or links, so no solid edges expected
    expect(solidEdges).toHaveLength(0);
  });

  it('render direction TB produces output starting with "flowchart TB"', async () => {
    const path = writeTempFile('services:\n  app:\n    image: nginx:latest\n');
    const result = await loadFile(path);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = normalizeCompose(result.value, path);
    const baseGraph = buildIRGraph(normalized);
    const graph = runAllInferenceStrategies(baseGraph, normalized);
    const output = flowchartRenderer.render(graph, { ...FULL_OPTIONS, direction: 'TB' });

    expect(output).toMatch(/^flowchart TB/);
  });

  it('volumes are omitted from output when includeVolumes is false', async () => {
    const filePath = join(FIXTURES, 'simple.yml');
    const actual = await renderFromDisk(filePath, { includeVolumes: false });

    expect(actual).not.toContain('db_data');
  });

  it('volumes are present in output when includeVolumes is true', async () => {
    const filePath = join(FIXTURES, 'simple.yml');
    const actual = await renderFromDisk(filePath, { includeVolumes: true });

    expect(actual).toContain('db_data');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: result type shape
// ---------------------------------------------------------------------------

describe('Result type shape', () => {
  it('ok result has ok: true and a value property', async () => {
    const path = writeTempFile('services:\n  api:\n    image: nginx:latest\n');
    const result = await loadFile(path);

    expect(result.ok).toBe(true);
    // TypeScript discriminated union: ok: true → value exists
    if (result.ok) {
      expect(result).toHaveProperty('value');
      expect(result).not.toHaveProperty('error');
    }
  });

  it('err result has ok: false and an error property', async () => {
    const result = await loadFile('/does/not/exist.yml');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result).toHaveProperty('error');
      expect(result).not.toHaveProperty('value');
    }
  });
});
