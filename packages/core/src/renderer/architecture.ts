import type { IRGraph, NetworkGroup } from '../types/graph.js';
import type { ServiceNode, VolumeNode, NodeType } from '../types/nodes.js';
import type { Edge } from '../types/edges.js';
import type { Renderer, RenderOptions } from '../types/renderer.js';

// ─── ID sanitization ─────────────────────────────────────────────────────────

/**
 * Mermaid node identifiers cannot contain dashes or dots — replace with underscores.
 * The display label keeps the original name unchanged.
 */
function sanitizeId(id: string): string {
  return id.replace(/[-_.]/g, '_');
}

// ─── Icon mapping ─────────────────────────────────────────────────────────────

/**
 * Maps a NodeType to a Mermaid architecture-beta icon token.
 *
 * Icon mapping:
 *   service / cache / queue → server
 *   database                → database
 *   proxy                   → internet
 *   storage / volume        → disk
 *   external                → internet  (external systems are treated as internet-facing)
 */
function iconForNodeType(type: NodeType): string {
  switch (type) {
    case 'database':
      return 'database';
    case 'proxy':
    case 'external':
      return 'internet';
    case 'storage':
    case 'volume':
      return 'disk';
    case 'service':
    case 'cache':
    case 'queue':
    default:
      return 'server';
  }
}

// ─── Node rendering ───────────────────────────────────────────────────────────

/**
 * Returns the architecture-beta service declaration line for a service node.
 *
 * Format (in group):  `service id(icon)[label] in groupId`
 * Format (top-level): `service id(icon)[label]`
 */
function renderServiceNode(node: ServiceNode, groupId?: string): string {
  const id = sanitizeId(node.id);
  const icon = iconForNodeType(node.type);
  const base = `  service ${id}(${icon})[${node.name}]`;

  if (groupId !== undefined) {
    return `${base} in ${groupId}`;
  }

  return base;
}

/**
 * Returns the architecture-beta service declaration line for a volume node.
 * Volumes always render as `disk` icon and are never placed in a network group.
 */
function renderVolumeNode(vol: VolumeNode): string {
  const id = sanitizeId(vol.id);
  return `  service ${id}(disk)[${vol.name}]`;
}

// ─── Edge rendering ───────────────────────────────────────────────────────────

/**
 * Returns the architecture-beta edge declaration for a single service-to-service edge.
 *
 * The architecture-beta format uses directional port syntax: `from:R --> L:to`.
 * Labels are not supported natively in architecture-beta — they are silently dropped.
 * Dashed vs solid distinction is not available without labels in this format — all
 * edges use `-->` for maximum compatibility.
 */
function renderEdge(edge: Edge): string {
  const from = sanitizeId(edge.from);
  const to = sanitizeId(edge.to);
  return `  ${from}:R --> L:${to}`;
}

/**
 * Returns the architecture-beta edge that connects a service to its mounted volume.
 * Uses bottom-to-top port orientation to convey "service writes to storage below".
 */
function renderVolumeEdge(serviceId: string, volumeId: string): string {
  const from = sanitizeId(serviceId);
  const to = sanitizeId(volumeId);
  return `  ${from}:B --> T:${to}`;
}

// ─── Group rendering ──────────────────────────────────────────────────────────

/**
 * Returns the architecture-beta group declaration line for a network.
 *
 * Format: `group groupId[Network: groupName]`
 */
function renderGroup(group: NetworkGroup): string {
  const id = sanitizeId(group.id);
  return `  group ${id}[Network: ${group.name}]`;
}

/**
 * Determines whether network groups should be rendered.
 * Groups are only meaningful when there are 2 or more distinct non-default networks.
 */
function shouldRenderGroups(
  groups: readonly NetworkGroup[],
  includeNetworkBoundaries: boolean,
): boolean {
  if (!includeNetworkBoundaries) {
    return false;
  }
  const nonDefaultGroups = groups.filter((g) => g.name !== 'default');
  return nonDefaultGroups.length >= 2;
}

/**
 * Builds a map from service node ID → sanitized group ID for services
 * that belong to a non-default network group.
 *
 * When a service belongs to multiple non-default groups, the first group wins
 * (architecture-beta's `in` clause accepts only one group per service).
 */
function buildServiceGroupMap(groups: readonly NetworkGroup[]): Map<string, string> {
  const serviceGroup = new Map<string, string>();

  for (const group of groups) {
    const sanitizedGroupId = sanitizeId(group.id);
    for (const memberId of group.members) {
      if (!serviceGroup.has(memberId)) {
        serviceGroup.set(memberId, sanitizedGroupId);
      }
    }
  }

  return serviceGroup;
}

// ─── Volume mount edge extraction ─────────────────────────────────────────────

/**
 * Derives volume-mount edges from the graph's `volumes_from` edges.
 * These edges already encode the service→volume relationships in the IR.
 */
function getVolumeMountEdges(
  edges: readonly Edge[],
): Array<{ serviceId: string; volumeId: string }> {
  return edges
    .filter((e) => e.source === 'volumes_from')
    .map((e) => ({ serviceId: e.from, volumeId: e.to }));
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export const architectureRenderer: Renderer = {
  id: 'architecture',

  render(graph: IRGraph, options: RenderOptions): string {
    const lines: string[] = ['architecture-beta', ''];

    const renderGroups =
      options.includeNetworkBoundaries &&
      shouldRenderGroups(graph.groups, options.includeNetworkBoundaries);

    const nonDefaultGroups = graph.groups.filter((g) => g.name !== 'default');

    // ── Group declarations (non-default networks) ─────────────────────────────
    if (renderGroups) {
      for (const group of nonDefaultGroups) {
        // Only declare groups that have at least one member in the node list.
        const memberSet = new Set(group.members);
        const hasMember = graph.nodes.some((n) => memberSet.has(n.id));
        if (hasMember) {
          lines.push(renderGroup(group));
        }
      }
      lines.push('');
    }

    // ── Service declarations ──────────────────────────────────────────────────
    // Build the service→group mapping only when groups are active.
    const serviceGroupMap: Map<string, string> = renderGroups
      ? buildServiceGroupMap(nonDefaultGroups)
      : new Map<string, string>();

    for (const node of graph.nodes) {
      const groupId = serviceGroupMap.get(node.id);
      lines.push(renderServiceNode(node, groupId));
    }

    if (graph.nodes.length > 0) {
      lines.push('');
    }

    // ── Volume node declarations ───────────────────────────────────────────────
    if (options.includeVolumes && graph.volumes.length > 0) {
      for (const vol of graph.volumes) {
        lines.push(renderVolumeNode(vol));
      }
      lines.push('');
    }

    // ── Service-to-service edges ───────────────────────────────────────────────
    // Exclude volumes_from edges here — volume mount edges are handled separately below.
    const serviceEdges = graph.edges.filter((e) => e.source !== 'volumes_from');

    if (serviceEdges.length > 0) {
      for (const edge of serviceEdges) {
        lines.push(renderEdge(edge));
      }
      lines.push('');
    }

    // ── Volume mount edges ────────────────────────────────────────────────────
    if (options.includeVolumes && graph.volumes.length > 0) {
      const volumeIds = new Set(graph.volumes.map((v) => v.id));
      const mountEdges = getVolumeMountEdges(graph.edges).filter((e) => volumeIds.has(e.volumeId));

      if (mountEdges.length > 0) {
        for (const mount of mountEdges) {
          lines.push(renderVolumeEdge(mount.serviceId, mount.volumeId));
        }
        lines.push('');
      }
    }

    // Trim trailing blank line(s) produced by the sections above.
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    return lines.join('\n');
  },
};
