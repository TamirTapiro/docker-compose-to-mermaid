import type { ServiceNode, NodeType } from '../../types/nodes.js';

// Databases take priority over cache (redis appears in both — it's primarily a cache)
const REFINED_MAP: Array<[RegExp, NodeType]> = [
  [
    /^(postgres|postgresql|mysql|mariadb|mongo|mongodb|couchdb|cassandra|cockroachdb|elasticsearch|opensearch|solr|clickhouse|timescaledb)$/,
    'database',
  ],
  [/^(redis|memcached|keydb|dragonflydb)$/, 'cache'],
  [/^(rabbitmq|kafka|nats|activemq|pulsar|redpanda|zookeeper|emqx)$/, 'queue'],
  [/^(nginx|traefik|haproxy|envoy|caddy|apache|httpd)$/, 'proxy'],
  [/^(minio|localstack|azurite)$/, 'storage'],
];

/**
 * Strip registry prefix and tag from an image string.
 * "ghcr.io/org/postgres:15-alpine" → "postgres"
 * "redis:7" → "redis"
 * "myapp" → "myapp"
 */
function extractImageName(image: string): string {
  // Remove tag (everything after last colon that isn't a port)
  let name = image.split(':')[0] ?? image;
  // Remove registry prefix (contains a dot or port, or is "localhost")
  const parts = name.split('/');
  // If first segment looks like a registry (contains dot or colon or is localhost), drop it
  if (parts.length > 1) {
    const firstPart = parts[0] ?? '';
    if (firstPart.includes('.') || firstPart.includes(':') || firstPart === 'localhost') {
      // Drop registry, keep org/name or just name
      parts.shift();
    }
  }
  // Take just the last segment (image name without org)
  name = parts[parts.length - 1] ?? name;
  return name.toLowerCase();
}

/**
 * Infer NodeType from a service's image name.
 * Returns 'service' for unknown images (no crash, no error).
 */
export function inferNodeType(image: string): NodeType {
  const name = extractImageName(image);
  for (const [pattern, type] of REFINED_MAP) {
    if (pattern.test(name)) return type;
  }
  return 'service';
}

/**
 * Inference Strategy 4: Image-based NodeType annotation.
 * Updates ServiceNode.type for all services with a known image.
 * Does NOT produce edges.
 * Returns a new array — pure function, does not mutate input.
 */
export function inferNodeTypes(nodes: readonly ServiceNode[]): ServiceNode[] {
  return nodes.map((node) => {
    if (!node.image) return node;
    const inferredType = inferNodeType(node.image);
    if (inferredType === node.type) return node;
    return { ...node, type: inferredType };
  });
}
