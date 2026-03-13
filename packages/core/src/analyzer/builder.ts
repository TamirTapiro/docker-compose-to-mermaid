import type { NormalizedCompose } from '../types/compose.js';
import type { IRGraph, NetworkGroup } from '../types/graph.js';
import type { ServiceNode, VolumeNode } from '../types/nodes.js';

const TOOL_VERSION = '0.1.0';

/**
 * Transform a NormalizedCompose document into an IR graph.
 * Creates nodes and groups — inference strategies add edges later.
 * Pure function: no I/O, no side effects.
 */
export function buildIRGraph(doc: NormalizedCompose): IRGraph {
  const nodes: ServiceNode[] = Object.entries(doc.services).map(([name, service]) => ({
    id: name,
    name,
    type: 'service' as const, // image heuristics run in inference strategy #11
    ...(service.image !== undefined ? { image: service.image } : {}),
    ports: service.ports.map((p) => ({
      host: p.host,
      container: p.container,
      protocol: p.protocol,
    })),
    ...(service.build !== undefined ? { buildContext: service.build.context } : {}),
    metadata: {},
  }));

  const volumes: VolumeNode[] = Object.entries(doc.volumes).map(([name, vol]) => ({
    id: name,
    name,
    ...(vol.driver !== undefined ? { driver: vol.driver } : {}),
    external: vol.external,
  }));

  // Build NetworkGroups from the networks section
  const networkMemberMap = new Map<string, string[]>();

  // Initialize all defined networks
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
      if (members) members.push(serviceName);
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

  return {
    nodes,
    volumes,
    edges: [], // populated by inference strategies
    groups,
    metadata: {
      sourceFiles: doc.sourceFiles,
      generatedAt: new Date().toISOString(),
      toolVersion: TOOL_VERSION,
    },
  };
}
