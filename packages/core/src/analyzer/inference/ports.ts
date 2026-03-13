import type { Edge } from '../../types/edges.js';
import type { IRGraph } from '../../types/graph.js';

// Well-known container ports → protocol labels
const PORT_LABELS: Record<string, string> = {
  '5432': 'postgres',
  '3306': 'mysql',
  '27017': 'mongodb',
  '6379': 'redis',
  '11211': 'memcached',
  '5672': 'amqp',
  '15672': 'rabbitmq-mgmt',
  '9092': 'kafka',
  '4222': 'nats',
  '9200': 'elasticsearch',
  '9300': 'elasticsearch-transport',
  '8080': 'http-alt',
  '8443': 'https-alt',
  '80': 'http',
  '443': 'https',
};

function getPortLabel(containerPort: string): string {
  return PORT_LABELS[containerPort] ?? `port:${containerPort}`;
}

/**
 * Inference Strategy 5: Port annotations.
 * Annotates EXISTING edges with port information from the target service's
 * exposed ports. Does NOT create new edges.
 *
 * If an edge already has a label (from env-URL inference), the port label
 * is only added if no label exists yet.
 */
export function annotatePortsOnEdges(edges: readonly Edge[], graph: IRGraph): Edge[] {
  // Build a map from node ID → its container ports
  const nodePorts = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const ports = node.ports.map((p) => p.container);
    if (ports.length > 0) {
      nodePorts.set(node.id, ports);
    }
  }

  return edges.map((edge) => {
    // Only annotate if edge has no label yet
    if (edge.label) return edge;

    const targetPorts = nodePorts.get(edge.to);
    if (!targetPorts || targetPorts.length === 0) return edge;

    // Use the first well-known port, or the first port if none are well-known
    const knownPort = targetPorts.find((p) => PORT_LABELS[p] !== undefined);
    const port = knownPort ?? targetPorts[0];
    if (!port) return edge;

    return { ...edge, label: getPortLabel(port) };
  });
}
