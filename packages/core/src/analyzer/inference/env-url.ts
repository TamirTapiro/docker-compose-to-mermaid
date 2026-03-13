import type { Edge } from '../../types/edges.js';
import type { NormalizedCompose } from '../../types/compose.js';

// URL schemes and their implied edge labels
const SCHEME_LABELS: Record<string, string> = {
  'postgres:': 'postgres',
  'postgresql:': 'postgres',
  'mysql:': 'mysql',
  'mariadb:': 'mysql',
  'mongodb:': 'mongodb',
  'mongodb+srv:': 'mongodb',
  'redis:': 'redis',
  'rediss:': 'redis',
  'amqp:': 'amqp',
  'amqps:': 'amqp',
  'kafka:': 'kafka',
  'nats:': 'nats',
  'http:': 'http',
  'https:': 'https',
};

function extractHostname(value: string): { hostname: string; label: string } | null {
  // Try standard URL parse first
  try {
    const url = new URL(value);
    if (!url.hostname) return null;
    const schemeKey = url.protocol;
    const label = SCHEME_LABELS[schemeKey] ?? url.protocol.replace(':', '');
    const port = url.port ? `${label}:${url.port}` : label;
    return { hostname: url.hostname, label: port };
  } catch {
    // Fallback: match "hostname:port" or "scheme://hostname:port" patterns
    const schemeMatch = /^([a-z][a-z0-9+\-.]*):\/\/([^/:@?#]+)(?::(\d+))?/i.exec(value);
    if (schemeMatch) {
      const scheme = schemeMatch[1] ?? '';
      const hostname = schemeMatch[2] ?? '';
      const port = schemeMatch[3];
      if (!hostname) return null;
      const label = SCHEME_LABELS[`${scheme.toLowerCase()}:`] ?? scheme.toLowerCase();
      return { hostname, label: port ? `${label}:${port}` : label };
    }
    // Plain "hostname:port" (no scheme) — only match if port is numeric
    const plainMatch = /^([a-z][a-z0-9_-]*)(?::(\d+))$/i.exec(value.trim());
    if (plainMatch) {
      const hostname = plainMatch[1] ?? '';
      const port = plainMatch[2];
      return { hostname, label: port ? `tcp:${port}` : 'tcp' };
    }
    return null;
  }
}

/**
 * Inference Strategy 2: Environment variable URL parsing
 * Scans all env vars for URL patterns. If the hostname matches a defined
 * service name, emits a dashed edge.
 * Medium-high confidence — only emits when hostname matches a known service.
 */
export function inferEnvUrls(doc: NormalizedCompose): Edge[] {
  const edges: Edge[] = [];
  const serviceNames = new Set(Object.keys(doc.services));

  for (const [serviceName, service] of Object.entries(doc.services)) {
    for (const [, value] of Object.entries(service.environment)) {
      if (!value || typeof value !== 'string') continue;

      const parsed = extractHostname(value);
      if (!parsed) continue;

      const { hostname, label } = parsed;

      // Only emit edge if hostname matches a defined service (prevents false positives)
      if (!serviceNames.has(hostname)) continue;
      // Skip self-references
      if (hostname === serviceName) continue;

      edges.push({
        from: serviceName,
        to: hostname,
        source: 'environment_url',
        style: 'dashed',
        label,
        metadata: {},
      });
    }
  }

  return edges;
}
