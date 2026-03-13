import type { Edge } from '../../types/edges.js';
import type { NormalizedCompose } from '../../types/compose.js';

/**
 * Inference Strategy 6: Legacy `links` directive.
 * The `links` directive is deprecated in Compose v3 but still present in
 * many older files. Treated identically to depends_on for edge inference.
 *
 * Supports both forms:
 *   links: [db]            → edge to 'db'
 *   links: ["db:database"] → edge to 'db', alias stored in metadata
 */
export function inferLinks(doc: NormalizedCompose): Edge[] {
  const edges: Edge[] = [];
  const serviceNames = new Set(Object.keys(doc.services));

  for (const [serviceName, service] of Object.entries(doc.services)) {
    for (const link of service.links) {
      // Links can be "service" or "service:alias"
      const colonIdx = link.indexOf(':');
      const targetName = colonIdx === -1 ? link : link.slice(0, colonIdx);
      const alias = colonIdx === -1 ? undefined : link.slice(colonIdx + 1);

      if (!targetName) continue;
      if (!serviceNames.has(targetName)) continue;
      if (targetName === serviceName) continue;

      edges.push({
        from: serviceName,
        to: targetName,
        source: 'links',
        style: 'solid',
        metadata: {
          deprecated: 'true',
          ...(alias !== undefined ? { alias } : {}),
        },
      });
    }
  }

  return edges;
}
