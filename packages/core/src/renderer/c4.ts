import type { IRGraph, NetworkGroup } from '../types/graph.js';
import type { ServiceNode, VolumeNode } from '../types/nodes.js';
import type { Edge } from '../types/edges.js';
import type { Renderer, RenderOptions } from '../types/renderer.js';

// ─── ID sanitization ─────────────────────────────────────────────────────────

/**
 * Mermaid C4 element identifiers cannot contain dashes or dots — replace with underscores.
 * The display label keeps the original name unchanged.
 */
function sanitizeId(id: string): string {
  return id.replace(/[-_.]/g, '_');
}

// ─── C4 element type mapping ──────────────────────────────────────────────────

/**
 * Maps a ServiceNode to its C4Context element declaration line.
 *
 * Element type mapping:
 *   service / queue / proxy → System(id, "label", "type")
 *   database / cache / storage → SystemDb(id, "label", "type")
 */
function renderServiceElement(node: ServiceNode, indent: string): string {
  const id = sanitizeId(node.id);
  const label = node.name;

  switch (node.type) {
    case 'database':
    case 'cache':
    case 'storage':
      return `${indent}SystemDb(${id}, "${label}", "${node.type}")`;

    case 'service':
    case 'queue':
    case 'proxy':
    case 'volume':
    case 'external':
    default:
      return `${indent}System(${id}, "${label}", "${node.type}")`;
  }
}

/**
 * Returns the C4Context element declaration line for a volume node.
 * Volumes are represented as SystemDb to convey persistent storage.
 */
function renderVolumeElement(vol: VolumeNode, indent: string): string {
  return `${indent}SystemDb(${sanitizeId(vol.id)}, "${vol.name}", "volume")`;
}

// ─── Edge rendering ───────────────────────────────────────────────────────────

/**
 * Returns the C4Context Rel() line for a single edge.
 * C4Context does not distinguish solid vs dashed — all edges use Rel().
 * Uses edge.label when present; falls back to edge.source as the relationship label.
 */
function renderRelationship(edge: Edge): string {
  const from = sanitizeId(edge.from);
  const to = sanitizeId(edge.to);
  const label = edge.label ?? edge.source;
  return `  Rel(${from}, ${to}, "${label}")`;
}

// ─── Boundary rendering ───────────────────────────────────────────────────────

/**
 * Determines whether C4 Boundary blocks should be rendered.
 * Boundaries are only meaningful when there are 2 or more distinct non-default networks.
 */
function shouldRenderBoundaries(
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
 * Returns the lines for a single Boundary block.
 * Only service nodes that are members of this group are included.
 */
function renderBoundary(group: NetworkGroup, nodes: readonly ServiceNode[]): string[] {
  const memberSet = new Set(group.members);
  const memberNodes = nodes.filter((n) => memberSet.has(n.id));

  if (memberNodes.length === 0) {
    return [];
  }

  const lines: string[] = [`  Boundary(${sanitizeId(group.id)}, "${group.name}") {`];
  for (const node of memberNodes) {
    lines.push(renderServiceElement(node, '    '));
  }
  lines.push('  }');

  return lines;
}

/**
 * Collects service node IDs that are placed inside a Boundary block
 * so they are not duplicated in top-level element declarations.
 */
function getBoundaryMemberIds(groups: readonly NetworkGroup[]): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const memberId of group.members) {
      ids.add(memberId);
    }
  }
  return ids;
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export const c4Renderer: Renderer = {
  id: 'c4',

  render(graph: IRGraph, options: RenderOptions): string {
    const lines: string[] = ['C4Context'];

    // Title
    const title = options.title ?? 'Docker Compose Architecture';
    lines.push(`  title ${title}`);
    lines.push('');

    const renderBoundaries =
      options.includeNetworkBoundaries &&
      shouldRenderBoundaries(graph.groups, options.includeNetworkBoundaries);

    const nonDefaultGroups = graph.groups.filter((g) => g.name !== 'default');

    // ── Boundary blocks (non-default networks) ────────────────────────────────
    if (renderBoundaries) {
      for (const group of nonDefaultGroups) {
        const boundaryLines = renderBoundary(group, graph.nodes);
        if (boundaryLines.length > 0) {
          lines.push(...boundaryLines);
          lines.push('');
        }
      }
    }

    // ── Top-level service elements (not in any boundary) ─────────────────────
    const boundaryMemberIds = renderBoundaries
      ? getBoundaryMemberIds(nonDefaultGroups)
      : new Set<string>();

    const topLevelServices = graph.nodes.filter((n) => !boundaryMemberIds.has(n.id));

    if (topLevelServices.length > 0) {
      for (const node of topLevelServices) {
        lines.push(renderServiceElement(node, '  '));
      }
      lines.push('');
    }

    // ── Volume elements ───────────────────────────────────────────────────────
    if (options.includeVolumes && graph.volumes.length > 0) {
      for (const vol of graph.volumes) {
        lines.push(renderVolumeElement(vol, '  '));
      }
      lines.push('');
    }

    // ── Relationships ─────────────────────────────────────────────────────────
    // Filter out volume edges when volumes are not being rendered.
    const edges: readonly Edge[] = options.includeVolumes
      ? graph.edges
      : graph.edges.filter((e) => e.source !== 'volumes_from');

    if (edges.length > 0) {
      for (const edge of edges) {
        lines.push(renderRelationship(edge));
      }
      lines.push('');
    }

    // Trim trailing blank line(s) produced by the sections above.
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    return lines.join('\n');
  },
};
