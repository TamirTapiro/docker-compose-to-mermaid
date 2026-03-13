import type {
  RawCompose,
  RawService,
  RawNetwork,
  RawVolume,
  NormalizedCompose,
  NormalizedService,
  NormalizedPort,
  NormalizedDependsOn,
  NormalizedNetwork,
  NormalizedVolume,
} from '../types/compose.js';

// ─── Port normalization ───────────────────────────────────────────────────────
// Handles: "3000", "3000:3000", "127.0.0.1:3000:3000", "3000:3000/udp"
// and object form { target, published, protocol }
function normalizePort(
  raw: string | { target: number; published?: number; protocol?: string },
): NormalizedPort {
  if (typeof raw === 'object' && raw !== null) {
    const { target, published, protocol } = raw;
    return {
      host: published !== undefined ? String(published) : String(target),
      container: String(target),
      protocol: protocol === 'udp' ? 'udp' : 'tcp',
    };
  }
  // String form: "[host:]container[/protocol]"
  const str = String(raw);
  const slashIdx = str.indexOf('/');
  const portPart = slashIdx === -1 ? str : str.slice(0, slashIdx);
  const protocolStr = slashIdx === -1 ? '' : str.slice(slashIdx + 1);
  const parts = portPart.split(':');
  // Could be "container", "host:container", or "ip:host:container"
  const lastIdx = parts.length - 1;
  const container = parts[lastIdx] ?? '';
  const host = parts.length >= 2 ? (parts[lastIdx - 1] ?? container) : container;
  return {
    host,
    container,
    protocol: protocolStr === 'udp' ? 'udp' : 'tcp',
  };
}

// ─── Environment normalization ────────────────────────────────────────────────
// Handles array ["KEY=value", "KEY2=value2"] and map {KEY: value}
function normalizeEnvironment(env: RawService['environment']): Record<string, string> {
  if (!env) return {};
  if (Array.isArray(env)) {
    const result: Record<string, string> = {};
    for (const item of env) {
      const eqIdx = item.indexOf('=');
      if (eqIdx === -1) {
        result[item] = '';
      } else {
        result[item.slice(0, eqIdx)] = item.slice(eqIdx + 1);
      }
    }
    return result;
  }
  // Map form: Record<string, string>
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    result[k] = v != null ? String(v) : '';
  }
  return result;
}

// ─── depends_on normalization ─────────────────────────────────────────────────
// Handles: ["db", "redis"] → {db: {condition: "service_started"}, redis: {...}}
// and extended map form already
function normalizeDependsOn(raw: RawService['depends_on']): NormalizedDependsOn {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    return Object.fromEntries(raw.map((name) => [name, { condition: 'service_started' as const }]));
  }
  // Extended map form: Record<string, { condition?: string }>
  const result: NormalizedDependsOn = {};
  for (const [name, opts] of Object.entries(raw)) {
    const condition = opts?.condition;
    result[name] = {
      condition:
        condition === 'service_healthy'
          ? 'service_healthy'
          : condition === 'service_completed_successfully'
            ? 'service_completed_successfully'
            : 'service_started',
    };
  }
  return result;
}

// ─── Networks normalization ───────────────────────────────────────────────────
// Returns array of network names the service is on
function normalizeServiceNetworks(raw: RawService['networks']): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return Object.keys(raw);
}

// ─── Build normalization ──────────────────────────────────────────────────────
function normalizeBuild(raw: RawService['build']): NormalizedService['build'] {
  if (!raw) return undefined;
  if (typeof raw === 'string') return { context: raw };
  // Object form — exactOptionalPropertyTypes: only include optional keys when defined
  return {
    context: raw.context ?? '.',
    ...(raw.dockerfile !== undefined && { dockerfile: raw.dockerfile }),
    ...(raw.args !== undefined && { args: raw.args }),
  };
}

// ─── Volume mounts normalization ──────────────────────────────────────────────
function normalizeVolumeMounts(raw: RawService['volumes']): NormalizedService['volumes'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => {
    if (typeof v === 'string') {
      const parts = v.split(':');
      if (parts.length === 1) {
        // Anonymous volume or named path — no source
        return { target: parts[0] ?? v, type: 'bind' as const };
      }
      const source = parts[0] ?? '';
      const target = parts[1] ?? '';
      // Named volume (no leading slash or ./) vs bind mount
      const type =
        source !== '' && !source.startsWith('/') && !source.startsWith('.')
          ? ('volume' as const)
          : ('bind' as const);
      return { source, target, type };
    }
    // Object form — exactOptionalPropertyTypes: only include source when defined
    const rawType = v.type;
    const type: 'volume' | 'bind' | 'tmpfs' =
      rawType === 'volume' || rawType === 'bind' || rawType === 'tmpfs' ? rawType : 'bind';
    return {
      ...(v.source !== undefined && { source: v.source }),
      target: v.target ?? '',
      type,
    };
  });
}

// ─── Single service normalizer ────────────────────────────────────────────────
function normalizeService(raw: RawService, defaultNetworks: string[]): NormalizedService {
  const serviceNetworks = normalizeServiceNetworks(raw.networks);
  const build = raw.build !== undefined ? normalizeBuild(raw.build) : undefined;
  return {
    ...(raw.image !== undefined ? { image: raw.image } : {}),
    ...(build !== undefined ? { build } : {}),
    ports: Array.isArray(raw.ports) ? raw.ports.map(normalizePort) : [],
    dependsOn: normalizeDependsOn(raw.depends_on),
    environment: normalizeEnvironment(raw.environment),
    networks: serviceNetworks.length > 0 ? serviceNetworks : defaultNetworks,
    volumes: normalizeVolumeMounts(raw.volumes),
    links: Array.isArray(raw.links) ? raw.links.map(String) : [],
    volumesFrom: Array.isArray(raw.volumes_from) ? raw.volumes_from.map(String) : [],
  };
}

// ─── Network definition normalizer ───────────────────────────────────────────
function normalizeNetwork(raw: RawNetwork | null | undefined): NormalizedNetwork {
  if (!raw || typeof raw !== 'object') {
    return { external: false };
  }
  return {
    ...(raw.driver !== undefined && { driver: raw.driver }),
    external: !!raw.external,
    ...(raw.name !== undefined && { name: raw.name }),
  };
}

// ─── Volume definition normalizer ────────────────────────────────────────────
function normalizeVolumeDefinition(raw: RawVolume | null | undefined): NormalizedVolume {
  if (!raw || typeof raw !== 'object') {
    return { external: false };
  }
  return {
    ...(raw.driver !== undefined && { driver: raw.driver }),
    external: !!raw.external,
    ...(raw.name !== undefined && { name: raw.name }),
  };
}

// ─── Main normalizer ─────────────────────────────────────────────────────────

/**
 * Normalize a raw parsed Compose document into canonical form.
 * All shorthand forms are expanded; all optional fields are given defaults.
 * This is a pure function — no I/O, no side effects.
 */
export function normalizeCompose(raw: RawCompose, sourceFile: string = ''): NormalizedCompose {
  const services = raw.services ?? {};
  const networks = raw.networks ?? {};
  const volumes = raw.volumes ?? {};

  // Default network is 'default' if no networks defined at the top level
  const defaultNetworks = Object.keys(networks).length > 0 ? [] : ['default'];

  const normalizedServices: Record<string, NormalizedService> = {};
  for (const [name, service] of Object.entries(services)) {
    if (service) {
      normalizedServices[name] = normalizeService(service, defaultNetworks);
    }
  }

  const normalizedNetworks: Record<string, NormalizedNetwork> = {};
  for (const [name, network] of Object.entries(networks)) {
    normalizedNetworks[name] = normalizeNetwork(network);
  }
  // Ensure 'default' network entry exists if any service falls back to it
  const anyUsesDefault = Object.values(normalizedServices).some((s) =>
    s.networks.includes('default'),
  );
  if (anyUsesDefault && !('default' in normalizedNetworks)) {
    normalizedNetworks['default'] = { external: false };
  }

  const normalizedVolumes: Record<string, NormalizedVolume> = {};
  for (const [name, volume] of Object.entries(volumes)) {
    normalizedVolumes[name] = normalizeVolumeDefinition(volume);
  }

  return {
    services: normalizedServices,
    networks: normalizedNetworks,
    volumes: normalizedVolumes,
    sourceFiles: sourceFile ? [sourceFile] : [],
  };
}
