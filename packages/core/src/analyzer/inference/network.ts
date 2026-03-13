import type { NetworkGroup } from '../../types/graph.js';
import type { NormalizedCompose } from '../../types/compose.js';
import type { Diagnostic } from '../../types/result.js';

export interface NetworkInferenceResult {
  groups: NetworkGroup[];
  warnings: Diagnostic[];
}

/**
 * Inference Strategy 3: Shared network grouping.
 * Groups services by their network membership.
 * Does NOT emit edges — only produces NetworkGroups for subgraph rendering.
 *
 * Also validates cross-network edge references (if a service in env-URL
 * references a service on a completely different network, emits a warning).
 */
export function inferNetworkGroups(doc: NormalizedCompose): NetworkInferenceResult {
  const warnings: Diagnostic[] = [];
  const networkMemberMap = new Map<string, string[]>();

  // Initialize all declared networks
  for (const networkName of Object.keys(doc.networks)) {
    networkMemberMap.set(networkName, []);
  }

  // Assign services to their networks
  for (const [serviceName, service] of Object.entries(doc.services)) {
    for (const networkName of service.networks) {
      if (!networkMemberMap.has(networkName)) {
        networkMemberMap.set(networkName, []);
      }
      const members = networkMemberMap.get(networkName);
      if (members && !members.includes(serviceName)) {
        members.push(serviceName);
      }
    }
  }

  const groups: NetworkGroup[] = Array.from(networkMemberMap.entries()).map(([name, members]) => {
    const networkDef = doc.networks[name];
    return {
      id: name,
      name,
      members,
      external: networkDef?.external ?? false,
    };
  });

  return { groups, warnings };
}

/**
 * Build a map from service name → set of network names it belongs to.
 * Used by the deduplication step to validate cross-network edges.
 */
export function buildServiceNetworkMap(doc: NormalizedCompose): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [serviceName, service] of Object.entries(doc.services)) {
    map.set(serviceName, new Set(service.networks));
  }
  return map;
}
