import { describe, it, expect } from 'vitest';
import { inferDependsOn } from '../../src/analyzer/inference/depends-on.js';
import { inferEnvUrls } from '../../src/analyzer/inference/env-url.js';
import { inferNodeType, inferNodeTypes } from '../../src/analyzer/inference/image.js';
import { inferNetworkGroups } from '../../src/analyzer/inference/network.js';
import { inferLinks } from '../../src/analyzer/inference/links.js';
import { annotatePortsOnEdges } from '../../src/analyzer/inference/ports.js';
import { runAllInferenceStrategies } from '../../src/analyzer/inference/index.js';
import type { NormalizedCompose, NormalizedService } from '../../src/types/compose.js';
import type { IRGraph } from '../../src/types/graph.js';
import type { ServiceNode } from '../../src/types/nodes.js';
import type { Edge } from '../../src/types/edges.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(overrides: Partial<NormalizedService> = {}): NormalizedService {
  return {
    ports: [],
    dependsOn: {},
    environment: {},
    networks: [],
    volumes: [],
    links: [],
    volumesFrom: [],
    ...overrides,
  };
}

function makeDoc(services: Record<string, Partial<NormalizedService>>): NormalizedCompose {
  const normalized: Record<string, NormalizedService> = {};
  for (const [name, partial] of Object.entries(services)) {
    normalized[name] = makeService(partial);
  }
  return {
    services: normalized,
    networks: {},
    volumes: {},
    sourceFiles: [],
  };
}

function makeGraph(serviceNames: string[], opts: { ports?: Record<string, string[]> } = {}): IRGraph {
  const nodes: ServiceNode[] = serviceNames.map((name) => ({
    id: name,
    name,
    type: 'service' as const,
    ports: (opts.ports?.[name] ?? []).map((container) => ({
      host: container,
      container,
      protocol: 'tcp' as const,
    })),
    metadata: {},
  }));

  return {
    nodes,
    volumes: [],
    edges: [],
    groups: [],
    metadata: {
      sourceFiles: [],
      generatedAt: new Date().toISOString(),
      toolVersion: '0.0.0',
    },
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

// ---------------------------------------------------------------------------
// inferDependsOn
// ---------------------------------------------------------------------------

describe('inferDependsOn', () => {
  it('emits solid edges for simple array depends_on', () => {
    const doc = makeDoc({
      api: {
        dependsOn: { db: { condition: 'service_started' } },
      },
      db: {},
    });

    const edges = inferDependsOn(doc);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      from: 'api',
      to: 'db',
      source: 'depends_on',
      style: 'solid',
    });
  });

  it('emits solid edge with condition metadata for service_healthy', () => {
    const doc = makeDoc({
      api: {
        dependsOn: { db: { condition: 'service_healthy' } },
      },
      db: {},
    });

    const edges = inferDependsOn(doc);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      from: 'api',
      to: 'db',
      source: 'depends_on',
      style: 'solid',
      metadata: { condition: 'service_healthy' },
    });
  });

  it('does not include condition in metadata when condition is service_started', () => {
    const doc = makeDoc({
      api: {
        dependsOn: { db: { condition: 'service_started' } },
      },
      db: {},
    });

    const edges = inferDependsOn(doc);

    expect(edges[0]?.metadata).not.toHaveProperty('condition');
  });

  it('emits no edges when depends_on is empty', () => {
    const doc = makeDoc({ api: {}, db: {} });

    expect(inferDependsOn(doc)).toHaveLength(0);
  });

  it('silently skips depends_on referencing an undefined service', () => {
    const doc = makeDoc({
      api: {
        dependsOn: { ghost: { condition: 'service_started' } },
      },
    });

    expect(inferDependsOn(doc)).toHaveLength(0);
  });

  it('emits multiple edges when a service depends on several others', () => {
    const doc = makeDoc({
      api: {
        dependsOn: {
          db: { condition: 'service_started' },
          cache: { condition: 'service_started' },
        },
      },
      db: {},
      cache: {},
    });

    const edges = inferDependsOn(doc);

    expect(edges).toHaveLength(2);
    expect(edges.map((e) => e.to).sort()).toEqual(['cache', 'db']);
  });
});

// ---------------------------------------------------------------------------
// inferEnvUrls
// ---------------------------------------------------------------------------

describe('inferEnvUrls', () => {
  it('emits a dashed edge for a postgresql:// URL pointing to a known service', () => {
    const doc = makeDoc({
      api: {
        environment: { DATABASE_URL: 'postgresql://db:5432/mydb' },
      },
      db: {},
    });

    const edges = inferEnvUrls(doc);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      from: 'api',
      to: 'db',
      source: 'environment_url',
      style: 'dashed',
    });
  });

  it('emits a dashed edge for a redis:// URL pointing to a known service', () => {
    const doc = makeDoc({
      api: {
        environment: { REDIS_URL: 'redis://cache:6379' },
      },
      cache: {},
    });

    const edges = inferEnvUrls(doc);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      from: 'api',
      to: 'cache',
      source: 'environment_url',
      style: 'dashed',
    });
  });

  it('includes a protocol label on the edge', () => {
    const doc = makeDoc({
      api: {
        environment: { DATABASE_URL: 'postgresql://db:5432/mydb' },
      },
      db: {},
    });

    const edges = inferEnvUrls(doc);

    // Label should reflect the postgres scheme and port
    expect(edges[0]?.label).toBe('postgres:5432');
  });

  it('emits no edges for non-URL env vars', () => {
    const doc = makeDoc({
      api: {
        environment: { APP_ENV: 'production', DEBUG: 'false' },
      },
      db: {},
    });

    expect(inferEnvUrls(doc)).toHaveLength(0);
  });

  it('emits no edge when the URL hostname does not match any service', () => {
    const doc = makeDoc({
      api: {
        environment: { DATABASE_URL: 'postgresql://external-db.example.com:5432/mydb' },
      },
      db: {},
    });

    expect(inferEnvUrls(doc)).toHaveLength(0);
  });

  it('emits no edge for self-referencing hostname', () => {
    const doc = makeDoc({
      api: {
        environment: { SELF_URL: 'http://api:8080/health' },
      },
    });

    expect(inferEnvUrls(doc)).toHaveLength(0);
  });

  it('emits edges for each env var pointing to a different known service', () => {
    const doc = makeDoc({
      api: {
        environment: {
          DATABASE_URL: 'postgresql://db:5432/mydb',
          REDIS_URL: 'redis://cache:6379',
        },
      },
      db: {},
      cache: {},
    });

    const edges = inferEnvUrls(doc);

    expect(edges).toHaveLength(2);
    const targets = edges.map((e) => e.to).sort();
    expect(targets).toEqual(['cache', 'db']);
  });
});

// ---------------------------------------------------------------------------
// inferNodeType / inferNodeTypes
// ---------------------------------------------------------------------------

describe('inferNodeTypes', () => {
  it('classifies postgres image as database', () => {
    expect(inferNodeType('postgres:15')).toBe('database');
  });

  it('classifies redis:alpine as cache', () => {
    expect(inferNodeType('redis:alpine')).toBe('cache');
  });

  it('classifies rabbitmq:management as queue', () => {
    expect(inferNodeType('rabbitmq:management')).toBe('queue');
  });

  it('classifies nginx:latest as proxy', () => {
    expect(inferNodeType('nginx:latest')).toBe('proxy');
  });

  it('classifies an unknown image as service', () => {
    expect(inferNodeType('myapp:latest')).toBe('service');
  });

  it('strips registry prefix before matching', () => {
    expect(inferNodeType('ghcr.io/org/postgres:15-alpine')).toBe('database');
  });

  it('strips org prefix when no registry present', () => {
    expect(inferNodeType('bitnami/redis:7')).toBe('cache');
  });

  it('inferNodeTypes returns a new array with updated node types', () => {
    const nodes: ServiceNode[] = [
      { id: 'db', name: 'db', type: 'service', image: 'postgres:15', ports: [], metadata: {} },
      { id: 'cache', name: 'cache', type: 'service', image: 'redis:7', ports: [], metadata: {} },
      { id: 'api', name: 'api', type: 'service', image: 'myapp:1.0', ports: [], metadata: {} },
    ];

    const result = inferNodeTypes(nodes);

    expect(result.find((n) => n.id === 'db')?.type).toBe('database');
    expect(result.find((n) => n.id === 'cache')?.type).toBe('cache');
    expect(result.find((n) => n.id === 'api')?.type).toBe('service');
  });

  it('inferNodeTypes does not mutate the original nodes', () => {
    const nodes: ServiceNode[] = [
      { id: 'db', name: 'db', type: 'service', image: 'postgres:15', ports: [], metadata: {} },
    ];

    inferNodeTypes(nodes);

    expect(nodes[0]?.type).toBe('service');
  });

  it('inferNodeTypes leaves nodes without an image as service', () => {
    const nodes: ServiceNode[] = [
      { id: 'api', name: 'api', type: 'service', ports: [], metadata: {} },
    ];

    const result = inferNodeTypes(nodes);

    expect(result[0]?.type).toBe('service');
  });
});

// ---------------------------------------------------------------------------
// inferNetworkGroups
// ---------------------------------------------------------------------------

describe('inferNetworkGroups', () => {
  it('groups two services that share a custom network', () => {
    const doc: NormalizedCompose = {
      ...makeDoc({
        api: makeService({ networks: ['backend'] }),
        db: makeService({ networks: ['backend'] }),
      }),
      networks: { backend: { external: false } },
      volumes: {},
      sourceFiles: [],
    };

    const { groups } = inferNetworkGroups(doc);

    const backend = groups.find((g) => g.name === 'backend');
    expect(backend).toBeDefined();
    expect(backend?.members).toContain('api');
    expect(backend?.members).toContain('db');
  });

  it('a service on the default network does not appear in any custom group', () => {
    const doc = makeDoc({ api: {}, db: {} });

    const { groups } = inferNetworkGroups(doc);

    // No custom networks declared → no groups
    expect(groups).toHaveLength(0);
  });

  it('services on multiple networks appear in all their respective groups', () => {
    const doc: NormalizedCompose = {
      ...makeDoc({
        api: makeService({ networks: ['frontend', 'backend'] }),
        db: makeService({ networks: ['backend'] }),
        nginx: makeService({ networks: ['frontend'] }),
      }),
      networks: {
        frontend: { external: false },
        backend: { external: false },
      },
      volumes: {},
      sourceFiles: [],
    };

    const { groups } = inferNetworkGroups(doc);

    expect(groups).toHaveLength(2);
    const fe = groups.find((g) => g.name === 'frontend');
    const be = groups.find((g) => g.name === 'backend');
    expect(fe?.members).toContain('api');
    expect(fe?.members).toContain('nginx');
    expect(be?.members).toContain('api');
    expect(be?.members).toContain('db');
  });

  it('marks external networks correctly', () => {
    const doc: NormalizedCompose = {
      ...makeDoc({ api: makeService({ networks: ['shared'] }) }),
      networks: { shared: { external: true } },
      volumes: {},
      sourceFiles: [],
    };

    const { groups } = inferNetworkGroups(doc);

    expect(groups.find((g) => g.name === 'shared')?.external).toBe(true);
  });

  it('initializes declared networks even when no service joins them', () => {
    const doc: NormalizedCompose = {
      ...makeDoc({ api: {} }),
      networks: { unused: { external: false } },
      volumes: {},
      sourceFiles: [],
    };

    const { groups } = inferNetworkGroups(doc);

    const unused = groups.find((g) => g.name === 'unused');
    expect(unused).toBeDefined();
    expect(unused?.members).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// inferLinks
// ---------------------------------------------------------------------------

describe('inferLinks', () => {
  it('emits a solid edge for a simple link', () => {
    const doc = makeDoc({
      api: { links: ['db'] },
      db: {},
    });

    const edges = inferLinks(doc);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      from: 'api',
      to: 'db',
      source: 'links',
      style: 'solid',
    });
  });

  it('emits a solid edge for a link with alias form "service:alias"', () => {
    const doc = makeDoc({
      api: { links: ['db:database'] },
      db: {},
    });

    const edges = inferLinks(doc);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      from: 'api',
      to: 'db',
      source: 'links',
      style: 'solid',
      metadata: { alias: 'database' },
    });
  });

  it('marks link edges as deprecated', () => {
    const doc = makeDoc({
      api: { links: ['db'] },
      db: {},
    });

    const edges = inferLinks(doc);

    expect(edges[0]?.metadata.deprecated).toBe('true');
  });

  it('emits no edges when links is empty', () => {
    const doc = makeDoc({ api: {}, db: {} });

    expect(inferLinks(doc)).toHaveLength(0);
  });

  it('silently skips links to undefined services', () => {
    const doc = makeDoc({
      api: { links: ['ghost'] },
    });

    expect(inferLinks(doc)).toHaveLength(0);
  });

  it('skips self-links', () => {
    const doc = makeDoc({
      api: { links: ['api'] },
    });

    expect(inferLinks(doc)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// annotatePortsOnEdges
// ---------------------------------------------------------------------------

describe('annotatePortsOnEdges', () => {
  it('annotates an edge with a well-known port label from the target service', () => {
    const graph = makeGraph(['api', 'db'], { ports: { db: ['5432'] } });
    const edges: Edge[] = [makeEdge('api', 'db')];

    const result = annotatePortsOnEdges(edges, graph);

    expect(result[0]?.label).toBe('postgres');
  });

  it('annotates redis port 6379 with redis label', () => {
    const graph = makeGraph(['api', 'cache'], { ports: { cache: ['6379'] } });
    const edges: Edge[] = [makeEdge('api', 'cache')];

    const result = annotatePortsOnEdges(edges, graph);

    expect(result[0]?.label).toBe('redis');
  });

  it('does not overwrite an existing edge label', () => {
    const graph = makeGraph(['api', 'db'], { ports: { db: ['5432'] } });
    const edges: Edge[] = [makeEdge('api', 'db', { label: 'postgres:5432' })];

    const result = annotatePortsOnEdges(edges, graph);

    // Label already present — must not be changed
    expect(result[0]?.label).toBe('postgres:5432');
  });

  it('leaves edge unchanged when target service has no ports', () => {
    const graph = makeGraph(['api', 'worker']);
    const edges: Edge[] = [makeEdge('api', 'worker')];

    const result = annotatePortsOnEdges(edges, graph);

    expect(result[0]?.label).toBeUndefined();
  });

  it('uses a generic port:N label for an unknown port', () => {
    const graph = makeGraph(['api', 'custom'], { ports: { custom: ['9999'] } });
    const edges: Edge[] = [makeEdge('api', 'custom')];

    const result = annotatePortsOnEdges(edges, graph);

    expect(result[0]?.label).toBe('port:9999');
  });

  it('prefers a well-known port over an unknown one when node exposes multiple ports', () => {
    const graph = makeGraph(['api', 'db'], { ports: { db: ['9999', '5432'] } });
    const edges: Edge[] = [makeEdge('api', 'db')];

    const result = annotatePortsOnEdges(edges, graph);

    expect(result[0]?.label).toBe('postgres');
  });

  it('returns a new array without mutating input edges', () => {
    const graph = makeGraph(['api', 'db'], { ports: { db: ['5432'] } });
    const original: Edge[] = [makeEdge('api', 'db')];

    const result = annotatePortsOnEdges(original, graph);

    // Different array reference
    expect(result).not.toBe(original);
    // Original edge object unmodified
    expect(original[0]?.label).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// runAllInferenceStrategies
// ---------------------------------------------------------------------------

describe('runAllInferenceStrategies', () => {
  it('deduplicates edges produced by depends_on and env-url for the same pair, solid wins', () => {
    const doc: NormalizedCompose = {
      services: {
        api: makeService({
          dependsOn: { db: { condition: 'service_started' } },
          environment: { DATABASE_URL: 'postgresql://db:5432/mydb' },
        }),
        db: makeService({ image: 'postgres:15' }),
      },
      networks: {},
      volumes: {},
      sourceFiles: [],
    };

    const graph = makeGraph(['api', 'db']);
    const result = runAllInferenceStrategies(graph, doc);

    // Only one edge between api and db after deduplication
    const apiToDb = result.edges.filter((e) => e.from === 'api' && e.to === 'db');
    expect(apiToDb).toHaveLength(1);
    // depends_on wins → solid
    expect(apiToDb[0]?.style).toBe('solid');
    expect(apiToDb[0]?.source).toBe('depends_on');
  });

  it('updates node types via image heuristics', () => {
    const doc: NormalizedCompose = {
      services: {
        api: makeService({ image: 'myapp:latest' }),
        db: makeService({ image: 'postgres:15' }),
        cache: makeService({ image: 'redis:7' }),
      },
      networks: {},
      volumes: {},
      sourceFiles: [],
    };

    // Nodes must carry their images — inferNodeTypes reads node.image, not the doc
    const graph: IRGraph = {
      nodes: [
        { id: 'api', name: 'api', type: 'service', image: 'myapp:latest', ports: [], metadata: {} },
        { id: 'db', name: 'db', type: 'service', image: 'postgres:15', ports: [], metadata: {} },
        { id: 'cache', name: 'cache', type: 'service', image: 'redis:7', ports: [], metadata: {} },
      ],
      volumes: [],
      edges: [],
      groups: [],
      metadata: { sourceFiles: [], generatedAt: '', toolVersion: '0.0.0' },
    };

    const result = runAllInferenceStrategies(graph, doc);

    expect(result.nodes.find((n) => n.id === 'db')?.type).toBe('database');
    expect(result.nodes.find((n) => n.id === 'cache')?.type).toBe('cache');
    expect(result.nodes.find((n) => n.id === 'api')?.type).toBe('service');
  });

  it('populates network groups in the returned graph', () => {
    const doc: NormalizedCompose = {
      services: {
        api: makeService({ networks: ['backend'] }),
        db: makeService({ networks: ['backend'] }),
      },
      networks: { backend: { external: false } },
      volumes: {},
      sourceFiles: [],
    };

    const graph = makeGraph(['api', 'db']);
    const result = runAllInferenceStrategies(graph, doc);

    const backend = result.groups.find((g) => g.name === 'backend');
    expect(backend).toBeDefined();
    expect(backend?.members).toContain('api');
    expect(backend?.members).toContain('db');
  });

  it('annotates edges with port labels from the target service', () => {
    const doc: NormalizedCompose = {
      services: {
        api: makeService({
          dependsOn: { db: { condition: 'service_started' } },
        }),
        db: makeService({
          image: 'postgres:15',
          ports: [{ host: '5432', container: '5432', protocol: 'tcp' }],
        }),
      },
      networks: {},
      volumes: {},
      sourceFiles: [],
    };

    // Build the graph with ports already on the db node
    const graph: IRGraph = {
      nodes: [
        { id: 'api', name: 'api', type: 'service', ports: [], metadata: {} },
        {
          id: 'db',
          name: 'db',
          type: 'service',
          image: 'postgres:15',
          ports: [{ host: '5432', container: '5432', protocol: 'tcp' }],
          metadata: {},
        },
      ],
      volumes: [],
      edges: [],
      groups: [],
      metadata: { sourceFiles: [], generatedAt: '', toolVersion: '0.0.0' },
    };

    const result = runAllInferenceStrategies(graph, doc);

    const edge = result.edges.find((e) => e.from === 'api' && e.to === 'db');
    expect(edge?.label).toBe('postgres');
  });

  it('returns graph with no edges when services have no relationships', () => {
    const doc = makeDoc({ api: {}, worker: {} });
    const graph = makeGraph(['api', 'worker']);

    const result = runAllInferenceStrategies(graph, doc);

    expect(result.edges).toHaveLength(0);
  });

  it('does not mutate the input graph', () => {
    const doc = makeDoc({
      api: { dependsOn: { db: { condition: 'service_started' } } },
      db: {},
    });
    const graph = makeGraph(['api', 'db']);

    runAllInferenceStrategies(graph, doc);

    expect(graph.edges).toHaveLength(0);
  });
});
