import type { IRGraph, NetworkGroup } from '../types/graph.js';
import type { ServiceNode, VolumeNode } from '../types/nodes.js';
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

// ─── Node shape rendering ─────────────────────────────────────────────────────

/**
 * Returns the Mermaid node declaration line for a service node.
 *
 * Shape mapping:
 *   service / storage → [label]          (rectangle)
 *   database / cache  → [(label)]        (cylinder)
 *   queue             → [/label/]        (parallelogram — conveys async/buffered)
 *   proxy             → >label]          (asymmetric — conveys gateway/edge)
 */
function renderServiceNode(node: ServiceNode): string {
  const id = sanitizeId(node.id);
  const label = node.name;

  switch (node.type) {
    case 'database':
    case 'cache':
      return `${id}[(${label})]`;

    case 'queue':
      return `${id}[/${label}/]`;

    case 'proxy':
      return `${id}>${label}]`;

    case 'service':
    case 'storage':
    case 'volume':
    case 'external':
    default:
      return `${id}[${label}]`;
  }
}

/**
 * Returns the Mermaid node declaration line for a volume node.
 * Volumes use cylinder shape to visually distinguish persistent storage.
 */
function renderVolumeNode(vol: VolumeNode): string {
  return `${sanitizeId(vol.id)}[(${vol.name})]`;
}

// ─── Edge rendering ───────────────────────────────────────────────────────────

/**
 * Returns the Mermaid edge declaration line for a single edge.
 *
 * Solid:  -->  or  -->|label|
 * Dashed: -.-> or  -.->|label|
 */
function renderEdge(edge: Edge): string {
  const from = sanitizeId(edge.from);
  const to = sanitizeId(edge.to);

  if (edge.label !== undefined) {
    const dashed = edge.style === 'dashed';
    return dashed ? `${from} -.->|${edge.label}| ${to}` : `${from} -->|${edge.label}| ${to}`;
  }

  if (edge.style === 'dashed') {
    return `${from} -.-> ${to}`;
  }

  return `${from} --> ${to}`;
}

// ─── Subgraph rendering ───────────────────────────────────────────────────────

/**
 * Returns the lines for a single subgraph block.
 * Only service nodes that are members of this group are included.
 */
function renderSubgraph(group: NetworkGroup, nodes: readonly ServiceNode[]): string[] {
  const memberSet = new Set(group.members);
  const memberNodes = nodes.filter((n) => memberSet.has(n.id));

  if (memberNodes.length === 0) {
    return [];
  }

  const lines: string[] = [`  subgraph ${group.name}`];
  for (const node of memberNodes) {
    lines.push(`    ${renderServiceNode(node)}`);
  }
  lines.push('  end');

  return lines;
}

/**
 * Determines whether network subgraphs should be rendered.
 * Subgraphs are only meaningful when there are 2 or more distinct non-default networks.
 */
function shouldRenderSubgraphs(
  groups: readonly NetworkGroup[],
  includeNetworkBoundaries: boolean,
): boolean {
  if (!includeNetworkBoundaries) {
    return false;
  }

  const nonDefaultGroups = groups.filter((g) => g.name !== 'default');
  return nonDefaultGroups.length >= 2;
}

// ─── Main renderer ────────────────────────────────────────────────────────────

/**
 * Collects service node IDs that are already placed inside a subgraph,
 * so they are not duplicated in the top-level node declarations.
 */
function getSubgraphMemberIds(groups: readonly NetworkGroup[]): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const memberId of group.members) {
      ids.add(memberId);
    }
  }
  return ids;
}

export const flowchartRenderer: Renderer = {
  id: 'flowchart',

  render(graph: IRGraph, options: RenderOptions): string {
    const direction = options.direction ?? 'LR';
    const lines: string[] = [`flowchart ${direction}`, ''];

    const renderSubgraphs =
      options.includeNetworkBoundaries &&
      shouldRenderSubgraphs(graph.groups, options.includeNetworkBoundaries);

    const nonDefaultGroups = graph.groups.filter((g) => g.name !== 'default');

    // ── Subgraphs (non-default networks) ──────────────────────────────────────
    if (renderSubgraphs) {
      for (const group of nonDefaultGroups) {
        const subgraphLines = renderSubgraph(group, graph.nodes);
        if (subgraphLines.length > 0) {
          lines.push(...subgraphLines);
          lines.push('');
        }
      }
    }

    // ── Top-level service nodes (not in any subgraph) ─────────────────────────
    const subgraphMemberIds = renderSubgraphs
      ? getSubgraphMemberIds(nonDefaultGroups)
      : new Set<string>();

    const topLevelServices = graph.nodes.filter((n) => !subgraphMemberIds.has(n.id));

    if (topLevelServices.length > 0) {
      for (const node of topLevelServices) {
        lines.push(`  ${renderServiceNode(node)}`);
      }
      lines.push('');
    }

    // ── Volume nodes ──────────────────────────────────────────────────────────
    if (options.includeVolumes && graph.volumes.length > 0) {
      for (const vol of graph.volumes) {
        lines.push(`  ${renderVolumeNode(vol)}`);
      }
      lines.push('');
    }

    // ── Edges ─────────────────────────────────────────────────────────────────
    // Filter out volume edges when volumes are not being rendered.
    const edges = options.includeVolumes
      ? graph.edges
      : graph.edges.filter((e) => e.source !== 'volumes_from');

    if (edges.length > 0) {
      for (const edge of edges) {
        lines.push(`  ${renderEdge(edge)}`);
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
