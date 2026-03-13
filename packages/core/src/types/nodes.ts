export type NodeType =
  | 'service'
  | 'database'
  | 'cache'
  | 'queue'
  | 'proxy'
  | 'storage'
  | 'volume'
  | 'external';

export interface PortMapping {
  readonly host: string;
  readonly container: string;
  readonly protocol: 'tcp' | 'udp';
}

export interface ServiceNode {
  readonly id: string; // Compose service name (used as Mermaid node ID)
  readonly name: string; // Display name (defaults to id)
  readonly type: NodeType;
  readonly image?: string; // e.g. "postgres:15"
  readonly ports: readonly PortMapping[];
  readonly buildContext?: string; // e.g. "./api"
  readonly metadata: Readonly<Record<string, string>>;
}

export interface VolumeNode {
  readonly id: string;
  readonly name: string;
  readonly driver?: string;
  readonly external: boolean;
}
