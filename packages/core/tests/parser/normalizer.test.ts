import { describe, it, expect } from 'vitest';
import { normalizeCompose } from '../../src/parser/normalizer.js';
import type { RawCompose } from '../../src/types/compose.js';

// ─── Port normalization ───────────────────────────────────────────────────────

describe('normalizeCompose — port normalization', () => {
  it('normalizes a bare container port string ("3000")', () => {
    const raw: RawCompose = { services: { web: { ports: ['3000'] } } };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.ports).toEqual([
      { host: '3000', container: '3000', protocol: 'tcp' },
    ]);
  });

  it('normalizes "host:container" port string', () => {
    const raw: RawCompose = { services: { web: { ports: ['8080:3000'] } } };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.ports).toEqual([
      { host: '8080', container: '3000', protocol: 'tcp' },
    ]);
  });

  it('normalizes "ip:host:container/protocol" port string', () => {
    const raw: RawCompose = {
      services: { web: { ports: ['127.0.0.1:3000:3000/udp'] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.ports).toEqual([
      { host: '3000', container: '3000', protocol: 'udp' },
    ]);
  });

  it('normalizes object form port with published', () => {
    const raw: RawCompose = {
      services: { web: { ports: [{ target: 3000, published: 8080, protocol: 'tcp' }] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.ports).toEqual([
      { host: '8080', container: '3000', protocol: 'tcp' },
    ]);
  });

  it('normalizes object form port without published — host falls back to target', () => {
    const raw: RawCompose = {
      services: { web: { ports: [{ target: 3000 }] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.ports).toEqual([
      { host: '3000', container: '3000', protocol: 'tcp' },
    ]);
  });

  it('normalizes object form port with udp protocol', () => {
    const raw: RawCompose = {
      services: { web: { ports: [{ target: 5000, protocol: 'udp' }] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.ports[0]?.protocol).toBe('udp');
  });

  it('defaults to empty ports array when no ports defined', () => {
    const raw: RawCompose = { services: { web: { image: 'nginx' } } };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.ports).toEqual([]);
  });
});

// ─── Environment normalization ────────────────────────────────────────────────

describe('normalizeCompose — environment normalization', () => {
  it('normalizes array form ["KEY=val"]', () => {
    const raw: RawCompose = {
      services: { web: { environment: ['KEY=value', 'DEBUG=true'] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.environment).toEqual({ KEY: 'value', DEBUG: 'true' });
  });

  it('normalizes array form entry without "=" — value becomes empty string', () => {
    const raw: RawCompose = {
      services: { web: { environment: ['NO_VALUE'] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.environment).toEqual({ NO_VALUE: '' });
  });

  it('normalizes map form {KEY: val}', () => {
    const raw: RawCompose = {
      services: { web: { environment: { DATABASE_URL: 'postgres://localhost/db', PORT: '5432' } } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.environment).toEqual({
      DATABASE_URL: 'postgres://localhost/db',
      PORT: '5432',
    });
  });

  it('normalizes map form with null value — converts to empty string', () => {
    // RawService['environment'] accepts Record<string, string> but the normalizer
    // handles null via the `v != null` guard; we cast to test the branch.
    const raw: RawCompose = {
      services: { web: { environment: { OPTIONAL: null as unknown as string } } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.environment['OPTIONAL']).toBe('');
  });

  it('returns empty object when environment is undefined', () => {
    const raw: RawCompose = { services: { web: { image: 'redis' } } };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.environment).toEqual({});
  });

  it('preserves value that contains "=" characters in array form', () => {
    const raw: RawCompose = {
      services: { web: { environment: ['JDBC=jdbc:mysql://host/db?user=root'] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.environment['JDBC']).toBe('jdbc:mysql://host/db?user=root');
  });
});

// ─── depends_on normalization ─────────────────────────────────────────────────

describe('normalizeCompose — depends_on normalization', () => {
  it('normalizes array form — condition defaults to service_started', () => {
    const raw: RawCompose = {
      services: { api: { depends_on: ['db', 'redis'] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['api']?.dependsOn).toEqual({
      db: { condition: 'service_started' },
      redis: { condition: 'service_started' },
    });
  });

  it('normalizes extended map form with service_healthy', () => {
    const raw: RawCompose = {
      services: { api: { depends_on: { db: { condition: 'service_healthy' } } } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['api']?.dependsOn).toEqual({
      db: { condition: 'service_healthy' },
    });
  });

  it('normalizes extended map form with service_completed_successfully', () => {
    const raw: RawCompose = {
      services: {
        worker: {
          depends_on: { migrator: { condition: 'service_completed_successfully' } },
        },
      },
    };
    const result = normalizeCompose(raw);
    expect(result.services['worker']?.dependsOn['migrator']?.condition).toBe(
      'service_completed_successfully',
    );
  });

  it('normalizes extended map form with unknown condition — falls back to service_started', () => {
    const raw: RawCompose = {
      services: {
        api: { depends_on: { db: { condition: 'service_unknown' as 'service_started' } } },
      },
    };
    const result = normalizeCompose(raw);
    expect(result.services['api']?.dependsOn['db']?.condition).toBe('service_started');
  });

  it('returns empty object when depends_on is undefined', () => {
    const raw: RawCompose = { services: { web: { image: 'nginx' } } };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.dependsOn).toEqual({});
  });
});

// ─── Network normalization ────────────────────────────────────────────────────

describe('normalizeCompose — network normalization', () => {
  it('normalizes service networks as array form', () => {
    const raw: RawCompose = {
      services: { api: { networks: ['frontend', 'backend'] } },
      networks: { frontend: null, backend: null },
    };
    const result = normalizeCompose(raw);
    expect(result.services['api']?.networks).toEqual(['frontend', 'backend']);
  });

  it('normalizes service networks as map form', () => {
    const raw: RawCompose = {
      services: { api: { networks: { backend: null, monitoring: null } } },
      networks: { backend: null, monitoring: null },
    };
    const result = normalizeCompose(raw);
    expect(result.services['api']?.networks).toEqual(['backend', 'monitoring']);
  });

  it('falls back to ["default"] when service has no networks and no top-level networks', () => {
    const raw: RawCompose = { services: { web: { image: 'nginx' } } };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.networks).toEqual(['default']);
  });

  it('falls back to empty array when top-level networks are defined but service specifies none', () => {
    // When top-level networks exist, defaultNetworks is [] — service explicitly not on any network
    const raw: RawCompose = {
      services: { web: { image: 'nginx' } },
      networks: { custom: null },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.networks).toEqual([]);
  });

  it('normalizes external network definition', () => {
    const raw: RawCompose = {
      services: {},
      networks: { ext_net: { external: true, name: 'my-external-net' } },
    };
    const result = normalizeCompose(raw);
    expect(result.networks['ext_net']).toEqual({ external: true, name: 'my-external-net' });
  });

  it('normalizes null network definition to { external: false }', () => {
    const raw: RawCompose = { services: {}, networks: { backend: null } };
    const result = normalizeCompose(raw);
    expect(result.networks['backend']).toEqual({ external: false });
  });

  it('normalizes network definition with driver', () => {
    const raw: RawCompose = {
      services: {},
      networks: { overlay_net: { driver: 'overlay' } },
    };
    const result = normalizeCompose(raw);
    expect(result.networks['overlay_net']).toEqual({ driver: 'overlay', external: false });
  });
});

// ─── Default network injection ────────────────────────────────────────────────

describe('normalizeCompose — default network injection', () => {
  it('injects normalizedNetworks["default"] when a service uses it', () => {
    // No top-level networks → services fall back to ['default']
    const raw: RawCompose = { services: { web: { image: 'nginx' } } };
    const result = normalizeCompose(raw);
    expect('default' in result.networks).toBe(true);
    expect(result.networks['default']).toEqual({ external: false });
  });

  it('does not inject "default" network when no service uses it', () => {
    const raw: RawCompose = {
      services: { api: { networks: ['backend'] } },
      networks: { backend: null },
    };
    const result = normalizeCompose(raw);
    expect('default' in result.networks).toBe(false);
  });

  it('does not double-inject "default" if it is already defined', () => {
    // User explicitly defines a "default" network; no second entry should appear
    const raw: RawCompose = {
      services: { web: { networks: ['default'] } },
      networks: { default: { driver: 'bridge' } },
    };
    const result = normalizeCompose(raw);
    // Should keep the explicitly defined driver
    expect(result.networks['default']?.driver).toBe('bridge');
    // And only appear once (object keys are unique by definition)
    expect(Object.keys(result.networks).filter((k) => k === 'default')).toHaveLength(1);
  });
});

// ─── Volume mount normalization ───────────────────────────────────────────────

describe('normalizeCompose — volume mount normalization', () => {
  it('normalizes named volume string "named:/path"', () => {
    const raw: RawCompose = {
      services: { db: { volumes: ['db_data:/var/lib/postgresql/data'] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['db']?.volumes).toEqual([
      { source: 'db_data', target: '/var/lib/postgresql/data', type: 'volume' },
    ]);
  });

  it('normalizes bind mount string "./bind:/path"', () => {
    const raw: RawCompose = {
      services: { web: { volumes: ['./src:/app/src'] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.volumes).toEqual([
      { source: './src', target: '/app/src', type: 'bind' },
    ]);
  });

  it('normalizes absolute bind mount string "/host/path:/container/path"', () => {
    const raw: RawCompose = {
      services: { web: { volumes: ['/etc/config:/app/config'] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.volumes).toEqual([
      { source: '/etc/config', target: '/app/config', type: 'bind' },
    ]);
  });

  it('normalizes anonymous volume string "/path" — no source', () => {
    const raw: RawCompose = { services: { db: { volumes: ['/var/lib/data'] } } };
    const result = normalizeCompose(raw);
    const vol = result.services['db']?.volumes[0];
    expect(vol?.target).toBe('/var/lib/data');
    expect('source' in (vol ?? {})).toBe(false);
  });

  it('normalizes object form volume with explicit type "volume"', () => {
    const raw: RawCompose = {
      services: { db: { volumes: [{ type: 'volume', source: 'mydata', target: '/data' }] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['db']?.volumes).toEqual([
      { source: 'mydata', target: '/data', type: 'volume' },
    ]);
  });

  it('normalizes object form volume with type "tmpfs"', () => {
    const raw: RawCompose = {
      services: { app: { volumes: [{ type: 'tmpfs', target: '/tmp/cache' }] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['app']?.volumes[0]?.type).toBe('tmpfs');
  });

  it('normalizes object form without source — source key absent', () => {
    const raw: RawCompose = {
      services: { app: { volumes: [{ type: 'bind', target: '/app' }] } },
    };
    const result = normalizeCompose(raw);
    const vol = result.services['app']?.volumes[0];
    expect(vol?.target).toBe('/app');
    expect('source' in (vol ?? {})).toBe(false);
  });

  it('returns empty array when volumes is undefined', () => {
    const raw: RawCompose = { services: { web: { image: 'nginx' } } };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.volumes).toEqual([]);
  });
});

// ─── Build normalization ──────────────────────────────────────────────────────

describe('normalizeCompose — build normalization', () => {
  it('normalizes string build context', () => {
    const raw: RawCompose = { services: { api: { build: './api' } } };
    const result = normalizeCompose(raw);
    expect(result.services['api']?.build).toEqual({ context: './api' });
  });

  it('normalizes object form build with all fields', () => {
    const raw: RawCompose = {
      services: {
        api: {
          build: {
            context: './api',
            dockerfile: 'Dockerfile.prod',
            args: { NODE_ENV: 'production' },
          },
        },
      },
    };
    const result = normalizeCompose(raw);
    expect(result.services['api']?.build).toEqual({
      context: './api',
      dockerfile: 'Dockerfile.prod',
      args: { NODE_ENV: 'production' },
    });
  });

  it('normalizes object form build without context — defaults to "."', () => {
    const raw: RawCompose = {
      services: { api: { build: { dockerfile: 'Dockerfile.prod' } } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['api']?.build?.context).toBe('.');
  });

  it('omits build key when build is undefined', () => {
    const raw: RawCompose = { services: { db: { image: 'postgres:15' } } };
    const result = normalizeCompose(raw);
    expect('build' in (result.services['db'] ?? {})).toBe(false);
  });
});

// ─── Volume definition normalization ─────────────────────────────────────────

describe('normalizeCompose — volume definition normalization', () => {
  it('normalizes null volume definition to { external: false }', () => {
    const raw: RawCompose = { services: {}, volumes: { db_data: null } };
    const result = normalizeCompose(raw);
    expect(result.volumes['db_data']).toEqual({ external: false });
  });

  it('normalizes external volume definition', () => {
    const raw: RawCompose = {
      services: {},
      volumes: { shared_data: { external: true, name: 'myproject_shared' } },
    };
    const result = normalizeCompose(raw);
    expect(result.volumes['shared_data']).toEqual({ external: true, name: 'myproject_shared' });
  });

  it('normalizes volume definition with driver', () => {
    const raw: RawCompose = {
      services: {},
      volumes: { nfs_vol: { driver: 'local' } },
    };
    const result = normalizeCompose(raw);
    expect(result.volumes['nfs_vol']).toEqual({ driver: 'local', external: false });
  });
});

// ─── sourceFiles ──────────────────────────────────────────────────────────────

describe('normalizeCompose — sourceFiles', () => {
  it('records the sourceFile when provided', () => {
    const raw: RawCompose = { services: {} };
    const result = normalizeCompose(raw, '/project/docker-compose.yml');
    expect(result.sourceFiles).toEqual(['/project/docker-compose.yml']);
  });

  it('returns empty sourceFiles when no sourceFile argument', () => {
    const raw: RawCompose = { services: {} };
    const result = normalizeCompose(raw);
    expect(result.sourceFiles).toEqual([]);
  });
});

// ─── misc service fields ──────────────────────────────────────────────────────

describe('normalizeCompose — links and volumesFrom', () => {
  it('normalizes links array', () => {
    const raw: RawCompose = { services: { web: { links: ['db:database', 'redis'] } } };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.links).toEqual(['db:database', 'redis']);
  });

  it('normalizes volumes_from array', () => {
    const raw: RawCompose = {
      services: { sidecar: { volumes_from: ['app:ro'] } },
    };
    const result = normalizeCompose(raw);
    expect(result.services['sidecar']?.volumesFrom).toEqual(['app:ro']);
  });

  it('returns empty arrays when links and volumes_from are absent', () => {
    const raw: RawCompose = { services: { web: { image: 'nginx' } } };
    const result = normalizeCompose(raw);
    expect(result.services['web']?.links).toEqual([]);
    expect(result.services['web']?.volumesFrom).toEqual([]);
  });
});
