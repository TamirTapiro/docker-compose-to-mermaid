import type { Edge } from '../../types/edges.js';
import type { IRGraph } from '../../types/graph.js';
import type { NormalizedCompose } from '../../types/compose.js';
import { inferDependsOn } from './depends-on.js';
import { inferEnvUrls } from './env-url.js';
import { inferNodeTypes } from './image.js';
import { inferNetworkGroups } from './network.js';
import { inferLinks } from './links.js';
import { annotatePortsOnEdges } from './ports.js';

// Confidence ranking for deduplication (lower index = higher confidence)
const SOURCE_PRIORITY = [
  'depends_on',
  'links',
  'environment_url',
  'shared_network',
  'volumes_from',
] as const;

function sourcePriority(source: Edge['source']): number {
  const idx = SOURCE_PRIORITY.indexOf(source as (typeof SOURCE_PRIORITY)[number]);
  return idx === -1 ? SOURCE_PRIORITY.length : idx;
}

/**
 * Deduplicate edges by (from, to) pair.
 * When multiple strategies produce the same edge:
 * - Highest-confidence source wins
 * - Labels are merged (prefer existing label)
 * - style is 'solid' if ANY contributing strategy is explicit (depends_on, links)
 */
function deduplicateEdges(edges: Edge[]): Edge[] {
  const map = new Map<string, Edge>();

  for (const edge of edges) {
    const key = `${edge.from}→${edge.to}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, edge);
      continue;
    }

    // Merge: highest confidence source wins
    const useNew = sourcePriority(edge.source) < sourcePriority(existing.source);
    const winningSource = useNew ? edge.source : existing.source;
    // solid wins over dashed
    const style = existing.style === 'solid' || edge.style === 'solid' ? 'solid' : 'dashed';
    // label: prefer the one that already exists (from higher-confidence run)
    const label = existing.label ?? edge.label;
    // metadata: merge both
    const metadata = { ...existing.metadata, ...edge.metadata };

    map.set(key, {
      from: existing.from,
      to: existing.to,
      source: winningSource,
      style,
      ...(label !== undefined ? { label } : {}),
      metadata,
    });
  }

  return Array.from(map.values());
}

/**
 * Run all inference strategies and return an updated IRGraph.
 *
 * Strategy execution order:
 * 1. Image heuristics — updates node types (no edges)
 * 2. depends_on — explicit solid edges
 * 3. links — deprecated explicit solid edges
 * 4. env-URL — inferred dashed edges
 * 5. network grouping — updates groups (no edges)
 * 6. Deduplication — merges edges from steps 2-4
 * 7. Port annotation — annotates deduplicated edges with port labels
 */
export function runAllInferenceStrategies(graph: IRGraph, doc: NormalizedCompose): IRGraph {
  // 1. Update node types from image heuristics
  const updatedNodes = inferNodeTypes(graph.nodes);

  // 2-4. Collect all edges from explicit + inferred strategies
  const allEdges: Edge[] = [...inferDependsOn(doc), ...inferLinks(doc), ...inferEnvUrls(doc)];

  // 5. Deduplicate
  const deduplicated = deduplicateEdges(allEdges);

  // 6. Update network groups from network inference
  const { groups } = inferNetworkGroups(doc);

  // 7. Port annotation on deduplicated edges
  const graphForAnnotation: IRGraph = {
    ...graph,
    nodes: updatedNodes,
    edges: deduplicated,
    groups,
  };
  const annotatedEdges = annotatePortsOnEdges(deduplicated, graphForAnnotation);

  return {
    ...graph,
    nodes: updatedNodes,
    edges: annotatedEdges,
    groups,
  };
}
