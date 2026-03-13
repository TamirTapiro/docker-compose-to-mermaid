export type EdgeSource =
  | 'depends_on'
  | 'environment_url'
  | 'shared_network'
  | 'links'
  | 'volumes_from';

export interface Edge {
  readonly from: string; // Source node ID
  readonly to: string; // Target node ID
  readonly source: EdgeSource;
  readonly label?: string; // e.g. "postgres:5432"
  readonly style: 'solid' | 'dashed';
  readonly metadata: Readonly<Record<string, string>>;
}
