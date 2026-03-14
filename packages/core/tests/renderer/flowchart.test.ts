import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { flowchartRenderer } from '../../src/renderer/flowchart.js';
import { normalizeCompose } from '../../src/parser/normalizer.js';
import { buildIRGraph } from '../../src/analyzer/builder.js';
import { runAllInferenceStrategies } from '../../src/analyzer/inference/index.js';
import type { IRGraph } from '../../src/types/graph.js';
import type { ServiceNode, VolumeNode } from '../../src/types/nodes.js';
import type { Edge } from '../../src/types/edges.js';
import type { RenderOptions } from '../../src/types/renderer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXTURES = join(__dirname, '../fixtures');

function makeServiceNode(id: string, overrides: Partial<ServiceNode> = {}): ServiceNode {
  return {
    id,
    name: id,
    type: 'service',
    ports: [],
    metadata: {},
    ...overrides,
  };
}

function makeVolumeNode(id: string, overrides: Partial<VolumeNode> = {}): VolumeNode {
  return {
    id,
    name: id,
    external: false,
    ...overrides,
  };
}

function makeEdge(from: string, to: string, overrides: Partial<Edge> = {}): Edge {
  return {
    from,
    to,
    source: 'depends_on',
    style: 'solid',
    metadata: {},
    ...overrides,
  };
}

function makeGraph(overrides: Partial<IRGraph> = {}): IRGraph {
  return {
    nodes: [],
    volumes: [],
    edges: [],
    groups: [],
    metadata: {
      sourceFiles: [],
      generatedAt: new Date().toISOString(),
      toolVersion: '0.0.0',
    },
    ...overrides,
  };
}

const defaultOptions: RenderOptions = {
  type: 'flowchart',
  direction: 'LR',
  includeVolumes: false,
  includePorts: false,
  includeNetworkBoundaries: false,
  theme: {},
};

/**
 * Load a fixture YAML file through the full parse → normalize → build → infer pipeline
 * and render it with the flowchart renderer using the given options.
 */
function renderFixture(fixtureName: string, options: Partial<RenderOptions> = {}): string {
  const filePath = join(FIXTURES, `${fixtureName}.yml`);
  const raw = parseYaml(readFileSync(filePath, 'utf-8'));
  const normalized = normalizeCompose(raw, filePath);
  const baseGraph = buildIRGraph(normalized);
  const graph = runAllInferenceStrategies(baseGraph, normalized);
  return flowchartRenderer.render(graph, { ...defaultOptions, ...options });
}

// ---------------------------------------------------------------------------
// Unit tests — inline graphs
// ---------------------------------------------------------------------------

describe('flowchartRenderer unit tests', () => {
  describe('empty graph', () => {
    it('renders the flowchart header with no nodes or edges', () => {
      const graph = makeGraph();
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toBe('flowchart LR');
    });

    it('respects custom direction', () => {
      const graph = makeGraph();
      const result = flowchartRenderer.render(graph, { ...defaultOptions, direction: 'TB' });
      expect(result).toBe('flowchart TB');
    });
  });

  describe('single service, no edges', () => {
    it('renders just the node declaration', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('api')],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toBe('flowchart LR\n\n  api[api]');
    });
  });

  describe('two services with solid edge', () => {
    it('renders --> arrow syntax', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('api'), makeServiceNode('db')],
        edges: [makeEdge('api', 'db', { style: 'solid' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('api --> db');
    });
  });

  describe('two services with dashed edge and label', () => {
    it('renders -.->|label| syntax', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('app'), makeServiceNode('db')],
        edges: [makeEdge('app', 'db', { style: 'dashed', label: 'postgres:5432', source: 'environment_url' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('app -.->|postgres:5432| db');
    });
  });

  describe('dashed edge without label', () => {
    it('renders -.-> syntax', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('app'), makeServiceNode('cache')],
        edges: [makeEdge('app', 'cache', { style: 'dashed', source: 'environment_url' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('app -.-> cache');
    });
  });

  describe('solid edge with label', () => {
    it('renders -->|label| syntax', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('api'), makeServiceNode('db')],
        edges: [makeEdge('api', 'db', { style: 'solid', label: 'postgres:5432' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('api -->|postgres:5432| db');
    });
  });

  describe('node type shapes', () => {
    it('database type uses cylinder shape [(name)]', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('postgres', { type: 'database' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('postgres[(postgres)]');
    });

    it('cache type uses cylinder shape [(name)]', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('redis', { type: 'cache' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('redis[(redis)]');
    });

    it('queue type uses parallelogram shape [/name/]', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('kafka', { type: 'queue' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('kafka[/kafka/]');
    });

    it('proxy type uses asymmetric shape >name]', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('nginx', { type: 'proxy' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('nginx>nginx]');
    });

    it('service type uses rectangle shape [name]', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('api', { type: 'service' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('api[api]');
    });

    it('storage type uses rectangle shape [name]', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('minio', { type: 'storage' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('minio[minio]');
    });
  });

  describe('volume nodes', () => {
    it('volume nodes are omitted when includeVolumes is false', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('db')],
        volumes: [makeVolumeNode('db_data')],
      });
      const result = flowchartRenderer.render(graph, { ...defaultOptions, includeVolumes: false });
      expect(result).not.toContain('db_data');
    });

    it('volume nodes are rendered as cylinders when includeVolumes is true', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('db')],
        volumes: [makeVolumeNode('db_data')],
      });
      const result = flowchartRenderer.render(graph, { ...defaultOptions, includeVolumes: true });
      expect(result).toContain('db_data[(db_data)]');
    });

    it('volume edges (source: volumes_from) are filtered out when includeVolumes is false', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('app'), makeServiceNode('db')],
        volumes: [makeVolumeNode('db_data')],
        edges: [
          makeEdge('app', 'db', { source: 'depends_on', style: 'solid' }),
          makeEdge('db', 'db_data', { source: 'volumes_from', style: 'solid' }),
        ],
      });
      const result = flowchartRenderer.render(graph, { ...defaultOptions, includeVolumes: false });
      expect(result).toContain('app --> db');
      expect(result).not.toContain('db_data');
    });

    it('volume edges are included when includeVolumes is true', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('app'), makeServiceNode('db')],
        volumes: [makeVolumeNode('db_data')],
        edges: [makeEdge('db', 'db_data', { source: 'volumes_from', style: 'solid' })],
      });
      const result = flowchartRenderer.render(graph, { ...defaultOptions, includeVolumes: true });
      expect(result).toContain('db --> db_data');
    });
  });

  describe('network subgraphs', () => {
    it('subgraphs are not rendered when includeNetworkBoundaries is false', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('api'), makeServiceNode('db')],
        groups: [
          { id: 'frontend', name: 'frontend', members: ['api'], external: false },
          { id: 'backend', name: 'backend', members: ['db'], external: false },
        ],
      });
      const result = flowchartRenderer.render(graph, { ...defaultOptions, includeNetworkBoundaries: false });
      expect(result).not.toContain('subgraph');
    });

    it('subgraphs are not rendered when there is only one non-default network', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('api'), makeServiceNode('db')],
        groups: [
          { id: 'backend', name: 'backend', members: ['api', 'db'], external: false },
        ],
      });
      const result = flowchartRenderer.render(graph, { ...defaultOptions, includeNetworkBoundaries: true });
      expect(result).not.toContain('subgraph');
    });

    it('subgraphs are not rendered when only "default" network exists', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('api'), makeServiceNode('db')],
        groups: [
          { id: 'default', name: 'default', members: ['api', 'db'], external: false },
        ],
      });
      const result = flowchartRenderer.render(graph, { ...defaultOptions, includeNetworkBoundaries: true });
      expect(result).not.toContain('subgraph');
    });

    it('subgraphs are rendered when there are 2+ non-default networks', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('frontend'), makeServiceNode('api'), makeServiceNode('db')],
        groups: [
          { id: 'public', name: 'public', members: ['frontend'], external: false },
          { id: 'internal', name: 'internal', members: ['api', 'db'], external: false },
        ],
      });
      const result = flowchartRenderer.render(graph, { ...defaultOptions, includeNetworkBoundaries: true });
      expect(result).toContain('subgraph public');
      expect(result).toContain('subgraph internal');
    });

    it('nodes inside subgraphs are not duplicated at top-level', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('frontend'), makeServiceNode('api'), makeServiceNode('db')],
        groups: [
          { id: 'public', name: 'public', members: ['frontend'], external: false },
          { id: 'internal', name: 'internal', members: ['api', 'db'], external: false },
        ],
      });
      const result = flowchartRenderer.render(graph, { ...defaultOptions, includeNetworkBoundaries: true });
      // Count occurrences of node declarations — each should appear once
      const frontendMatches = result.match(/frontend\[frontend\]/g) ?? [];
      expect(frontendMatches).toHaveLength(1);
    });

    it('subgraph with empty membership (no matching nodes) is skipped', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('api')],
        groups: [
          { id: 'public', name: 'public', members: [], external: false },
          { id: 'internal', name: 'internal', members: ['api'], external: false },
          { id: 'extra', name: 'extra', members: [], external: false },
        ],
      });
      // Only 2 groups with actual nodes (internal + one extra with empty members)
      // But shouldRenderSubgraphs checks non-default count >= 2
      // public + internal + extra are all non-default, count = 3, so renders
      // but public and extra have no members — they produce no lines
      const result = flowchartRenderer.render(graph, { ...defaultOptions, includeNetworkBoundaries: true });
      expect(result).toContain('subgraph internal');
      expect(result).not.toContain('subgraph public');
      expect(result).not.toContain('subgraph extra');
    });
  });

  describe('ID sanitization', () => {
    it('replaces dashes in node IDs with underscores', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('my-service', { name: 'my-service' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      // ID uses underscore, label keeps original name
      expect(result).toContain('my_service[my-service]');
    });

    it('replaces dots in node IDs with underscores', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('service.v2', { name: 'service.v2' })],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('service_v2[service.v2]');
    });

    it('sanitizes edge endpoints consistently', () => {
      const graph = makeGraph({
        nodes: [makeServiceNode('my-api', { name: 'my-api' }), makeServiceNode('my-db', { name: 'my-db' })],
        edges: [makeEdge('my-api', 'my-db')],
      });
      const result = flowchartRenderer.render(graph, defaultOptions);
      expect(result).toContain('my_api --> my_db');
    });
  });
});

// ---------------------------------------------------------------------------
// Snapshot tests — full pipeline through fixture files
// ---------------------------------------------------------------------------

describe('flowchartRenderer snapshot tests', () => {
  /**
   * Options matching the full feature set so snapshot tests capture realistic output.
   * includeNetworkBoundaries is true so multi-network fixtures render subgraphs.
   */
  const fullOptions: RenderOptions = {
    type: 'flowchart',
    direction: 'LR',
    includeVolumes: true,
    includePorts: false,
    includeNetworkBoundaries: true,
    theme: {},
  };

  function readExpected(fixtureName: string): string {
    return readFileSync(join(FIXTURES, `${fixtureName}.expected.mmd`), 'utf-8').trim();
  }

  it('simple fixture matches expected', () => {
    const actual = renderFixture('simple', fullOptions).trim();
    const expected = readExpected('simple');
    expect(actual).toBe(expected);
  });

  it('full fixture matches expected', () => {
    const actual = renderFixture('full', fullOptions).trim();
    const expected = readExpected('full');
    expect(actual).toBe(expected);
  });

  it('multi-network fixture matches expected', () => {
    const actual = renderFixture('multi-network', fullOptions).trim();
    const expected = readExpected('multi-network');
    expect(actual).toBe(expected);
  });

  it('env-urls fixture matches expected', () => {
    const actual = renderFixture('env-urls', fullOptions).trim();
    const expected = readExpected('env-urls');
    expect(actual).toBe(expected);
  });

  it('legacy-links fixture matches expected', () => {
    const actual = renderFixture('legacy-links', fullOptions).trim();
    const expected = readExpected('legacy-links');
    expect(actual).toBe(expected);
  });

  it('no-version fixture matches expected', () => {
    const actual = renderFixture('no-version', fullOptions).trim();
    const expected = readExpected('no-version');
    expect(actual).toBe(expected);
  });

  it('external-volumes fixture matches expected', () => {
    const actual = renderFixture('external-volumes', fullOptions).trim();
    const expected = readExpected('external-volumes');
    expect(actual).toBe(expected);
  });

  it('custom-images fixture matches expected', () => {
    const actual = renderFixture('custom-images', fullOptions).trim();
    const expected = readExpected('custom-images');
    expect(actual).toBe(expected);
  });
});
