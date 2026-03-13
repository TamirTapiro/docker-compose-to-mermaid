import type { IRGraph } from './graph.js';

export type DiagramType = 'flowchart' | 'c4' | 'architecture';
export type DiagramDirection = 'LR' | 'TB' | 'RL' | 'BT';

export interface ThemeConfig {
  database?: string;
  cache?: string;
  queue?: string;
  proxy?: string;
  storage?: string;
  service?: string;
}

export interface RenderOptions {
  readonly type: DiagramType;
  readonly direction: DiagramDirection;
  readonly includeVolumes: boolean;
  readonly includePorts: boolean;
  readonly includeNetworkBoundaries: boolean;
  readonly title?: string;
  readonly theme: ThemeConfig;
}

export interface Renderer {
  readonly id: DiagramType;
  render(graph: IRGraph, options: RenderOptions): string;
}

export interface GenerateOptions {
  readonly files: string[];
  readonly render: RenderOptions;
  readonly configPath?: string;
  readonly strict: boolean;
  readonly verbose: boolean;
}
