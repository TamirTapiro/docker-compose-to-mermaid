import type { ServiceNode, VolumeNode } from './nodes.js';
import type { Edge } from './edges.js';

export interface NetworkGroup {
  readonly id: string;
  readonly name: string;
  readonly members: readonly string[]; // ServiceNode IDs
  readonly external: boolean;
}

export interface IRGraph {
  readonly nodes: readonly ServiceNode[];
  readonly volumes: readonly VolumeNode[];
  readonly edges: readonly Edge[];
  readonly groups: readonly NetworkGroup[];
  readonly metadata: {
    readonly sourceFiles: readonly string[];
    readonly generatedAt: string;
    readonly toolVersion: string;
  };
}
