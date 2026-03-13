import type { Edge } from '../../types/edges.js';
import type { NormalizedCompose } from '../../types/compose.js';

/**
 * Inference Strategy 1: depends_on
 * Highest confidence — these are explicit declarations.
 * Emits solid edges from dependent service → dependency.
 */
export function inferDependsOn(doc: NormalizedCompose): Edge[] {
  const edges: Edge[] = [];
  const serviceNames = new Set(Object.keys(doc.services));

  for (const [serviceName, service] of Object.entries(doc.services)) {
    for (const [depName, depOpts] of Object.entries(service.dependsOn)) {
      if (!serviceNames.has(depName)) {
        // Reference to undefined service — skip silently (caller handles warnings)
        continue;
      }
      edges.push({
        from: serviceName,
        to: depName,
        source: 'depends_on',
        style: 'solid',
        metadata: {
          ...(depOpts.condition !== 'service_started' ? { condition: depOpts.condition } : {}),
        },
      });
    }
  }

  return edges;
}
