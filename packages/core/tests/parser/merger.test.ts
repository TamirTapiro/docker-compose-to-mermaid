import { describe, it, expect } from 'vitest';
import { mergeComposeFiles } from '../../src/parser/merger.js';
import type { NormalizedCompose, NormalizedService } from '../../src/types/compose.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService(overrides: Partial<NormalizedService> = {}): NormalizedService {
  return {
    ports: [],
    dependsOn: {},
    environment: {},
    networks: ['default'],
    volumes: [],
    links: [],
    volumesFrom: [],
    ...overrides,
  };
}

function makeDoc(overrides: Partial<NormalizedCompose> = {}): NormalizedCompose {
  return {
    services: {},
    networks: {},
    volumes: {},
    sourceFiles: [],
    ...overrides,
  };
}

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('mergeComposeFiles — edge cases', () => {
  it('returns empty document for an empty array', () => {
    const result = mergeComposeFiles([]);
    expect(result).toEqual({ services: {}, networks: {}, volumes: {}, sourceFiles: [] });
  });

  it('returns the single document unchanged for a one-element array', () => {
    const doc = makeDoc({
      services: { web: makeService({ image: 'nginx' }) },
      sourceFiles: ['docker-compose.yml'],
    });
    const result = mergeComposeFiles([doc]);
    expect(result).toEqual(doc);
  });
});

// ─── Non-overlapping services ─────────────────────────────────────────────────

describe('mergeComposeFiles — non-overlapping services', () => {
  it('merges two docs with entirely different services', () => {
    const base = makeDoc({
      services: { api: makeService({ image: 'node:20' }) },
      sourceFiles: ['docker-compose.yml'],
    });
    const override = makeDoc({
      services: { db: makeService({ image: 'postgres:15' }) },
      sourceFiles: ['docker-compose.override.yml'],
    });

    const result = mergeComposeFiles([base, override]);

    expect(Object.keys(result.services)).toHaveLength(2);
    expect(result.services['api']?.image).toBe('node:20');
    expect(result.services['db']?.image).toBe('postgres:15');
  });

  it('accumulates sourceFiles from all documents', () => {
    const a = makeDoc({ sourceFiles: ['a.yml'] });
    const b = makeDoc({ sourceFiles: ['b.yml'] });
    const c = makeDoc({ sourceFiles: ['c.yml'] });

    const result = mergeComposeFiles([a, b, c]);
    expect(result.sourceFiles).toEqual(['a.yml', 'b.yml', 'c.yml']);
  });
});

// ─── Overlapping services — scalar fields ─────────────────────────────────────

describe('mergeComposeFiles — overlapping service scalar fields', () => {
  it('override file wins for the image field', () => {
    const base = makeDoc({
      services: { db: makeService({ image: 'postgres:14' }) },
    });
    const override = makeDoc({
      services: { db: makeService({ image: 'postgres:15' }) },
    });

    const result = mergeComposeFiles([base, override]);
    expect(result.services['db']?.image).toBe('postgres:15');
  });

  it('override file wins for the build field', () => {
    const base = makeDoc({
      services: { api: makeService({ build: { context: './api' } }) },
    });
    const override = makeDoc({
      services: {
        api: makeService({ build: { context: './api', dockerfile: 'Dockerfile.prod' } }),
      },
    });

    const result = mergeComposeFiles([base, override]);
    expect(result.services['api']?.build?.dockerfile).toBe('Dockerfile.prod');
  });

  it('base image is preserved when override has no image', () => {
    const base = makeDoc({
      services: { db: makeService({ image: 'postgres:15' }) },
    });
    // Override service has no image — base should be kept
    const override = makeDoc({
      services: { db: makeService() },
    });

    const result = mergeComposeFiles([base, override]);
    expect(result.services['db']?.image).toBe('postgres:15');
  });

  it('omits image key when neither base nor override has one', () => {
    const base = makeDoc({ services: { api: makeService({ build: { context: '.' } }) } });
    const override = makeDoc({ services: { api: makeService() } });

    const result = mergeComposeFiles([base, override]);
    expect('image' in (result.services['api'] ?? {})).toBe(false);
  });
});

// ─── Overlapping services — array fields ─────────────────────────────────────

describe('mergeComposeFiles — overlapping service array fields', () => {
  it('appends override ports after base ports', () => {
    const base = makeDoc({
      services: {
        api: makeService({
          ports: [{ host: '3000', container: '3000', protocol: 'tcp' }],
        }),
      },
    });
    const override = makeDoc({
      services: {
        api: makeService({
          ports: [{ host: '9229', container: '9229', protocol: 'tcp' }],
        }),
      },
    });

    const result = mergeComposeFiles([base, override]);
    expect(result.services['api']?.ports).toHaveLength(2);
    expect(result.services['api']?.ports[0]?.host).toBe('3000');
    expect(result.services['api']?.ports[1]?.host).toBe('9229');
  });

  it('appends override volumes after base volumes', () => {
    const base = makeDoc({
      services: {
        api: makeService({
          volumes: [{ source: 'data', target: '/data', type: 'volume' }],
        }),
      },
    });
    const override = makeDoc({
      services: {
        api: makeService({
          volumes: [{ target: '/tmp', type: 'tmpfs' }],
        }),
      },
    });

    const result = mergeComposeFiles([base, override]);
    expect(result.services['api']?.volumes).toHaveLength(2);
    expect(result.services['api']?.volumes[0]?.source).toBe('data');
    expect(result.services['api']?.volumes[1]?.type).toBe('tmpfs');
  });

  it('appends override links after base links', () => {
    const base = makeDoc({ services: { web: makeService({ links: ['db:database'] }) } });
    const override = makeDoc({ services: { web: makeService({ links: ['cache:redis'] }) } });

    const result = mergeComposeFiles([base, override]);
    expect(result.services['web']?.links).toEqual(['db:database', 'cache:redis']);
  });

  it('appends override volumesFrom after base volumesFrom', () => {
    const base = makeDoc({ services: { sidecar: makeService({ volumesFrom: ['app'] }) } });
    const override = makeDoc({
      services: { sidecar: makeService({ volumesFrom: ['app:ro'] }) },
    });

    const result = mergeComposeFiles([base, override]);
    expect(result.services['sidecar']?.volumesFrom).toEqual(['app', 'app:ro']);
  });
});

// ─── Overlapping services — map fields ───────────────────────────────────────

describe('mergeComposeFiles — overlapping service map fields', () => {
  it('deep-merges environment maps — override keys win, base-only keys kept', () => {
    const base = makeDoc({
      services: {
        api: makeService({ environment: { NODE_ENV: 'development', LOG_LEVEL: 'info' } }),
      },
    });
    const override = makeDoc({
      services: {
        api: makeService({ environment: { LOG_LEVEL: 'debug', DEBUG: 'true' } }),
      },
    });

    const result = mergeComposeFiles([base, override]);
    expect(result.services['api']?.environment).toEqual({
      NODE_ENV: 'development', // base-only key preserved
      LOG_LEVEL: 'debug', // override wins
      DEBUG: 'true', // override-only key added
    });
  });

  it('deep-merges dependsOn maps — override entries win', () => {
    const base = makeDoc({
      services: {
        api: makeService({
          dependsOn: {
            db: { condition: 'service_healthy' },
            redis: { condition: 'service_started' },
          },
        }),
      },
    });
    const override = makeDoc({
      services: {
        api: makeService({
          dependsOn: { db: { condition: 'service_started' } },
        }),
      },
    });

    const result = mergeComposeFiles([base, override]);
    expect(result.services['api']?.dependsOn['db']?.condition).toBe('service_started');
    expect(result.services['api']?.dependsOn['redis']?.condition).toBe('service_started');
  });
});

// ─── Networks ─────────────────────────────────────────────────────────────────

describe('mergeComposeFiles — networks', () => {
  it('merges non-overlapping network definitions', () => {
    const base = makeDoc({ networks: { frontend: { external: false } } });
    const override = makeDoc({ networks: { backend: { external: false } } });

    const result = mergeComposeFiles([base, override]);
    expect(Object.keys(result.networks)).toEqual(['frontend', 'backend']);
  });

  it('override network definition wins for the same key', () => {
    const base = makeDoc({ networks: { shared: { external: false } } });
    const override = makeDoc({ networks: { shared: { external: true, name: 'global_shared' } } });

    const result = mergeComposeFiles([base, override]);
    expect(result.networks['shared']?.external).toBe(true);
    expect(result.networks['shared']?.name).toBe('global_shared');
  });
});

// ─── Volumes ──────────────────────────────────────────────────────────────────

describe('mergeComposeFiles — volumes', () => {
  it('merges non-overlapping volume definitions', () => {
    const base = makeDoc({ volumes: { db_data: { external: false } } });
    const override = makeDoc({ volumes: { uploads: { external: false } } });

    const result = mergeComposeFiles([base, override]);
    expect(Object.keys(result.volumes)).toHaveLength(2);
    expect(result.volumes['db_data']).toBeDefined();
    expect(result.volumes['uploads']).toBeDefined();
  });

  it('override volume definition wins for the same key', () => {
    const base = makeDoc({ volumes: { shared: { external: false } } });
    const override = makeDoc({
      volumes: { shared: { external: true, name: 'myproject_shared' } },
    });

    const result = mergeComposeFiles([base, override]);
    expect(result.volumes['shared']?.external).toBe(true);
    expect(result.volumes['shared']?.name).toBe('myproject_shared');
  });
});

// ─── Networks: union (deduplicated) ──────────────────────────────────────────

describe('mergeComposeFiles — service networks deduplication', () => {
  it('deduplicates network names when both base and override include the same network', () => {
    const base = makeDoc({
      services: { api: makeService({ networks: ['backend', 'frontend'] }) },
    });
    const override = makeDoc({
      services: { api: makeService({ networks: ['backend', 'monitoring'] }) },
    });

    const result = mergeComposeFiles([base, override]);
    const networks = result.services['api']?.networks ?? [];
    // 'backend' should appear exactly once
    expect(networks.filter((n) => n === 'backend')).toHaveLength(1);
    expect(networks).toContain('frontend');
    expect(networks).toContain('monitoring');
  });
});

// ─── Multi-file (3+ documents) ────────────────────────────────────────────────

describe('mergeComposeFiles — three-way merge', () => {
  it('applies overrides left-to-right across three files', () => {
    const base = makeDoc({
      services: { api: makeService({ image: 'node:18' }) },
      sourceFiles: ['base.yml'],
    });
    const mid = makeDoc({
      services: { api: makeService({ image: 'node:20' }) },
      sourceFiles: ['mid.yml'],
    });
    const final = makeDoc({
      services: {
        api: makeService({
          image: 'node:20',
          ports: [{ host: '3000', container: '3000', protocol: 'tcp' }],
        }),
      },
      sourceFiles: ['final.yml'],
    });

    const result = mergeComposeFiles([base, mid, final]);
    expect(result.services['api']?.image).toBe('node:20');
    expect(result.services['api']?.ports).toHaveLength(1);
    expect(result.sourceFiles).toEqual(['base.yml', 'mid.yml', 'final.yml']);
  });
});
