import type { DiagramType, DiagramDirection, ThemeConfig } from './renderer.js';
import type { NodeType } from './nodes.js';

export interface ServiceOverride {
  type?: NodeType;
  label?: string;
}

export interface ManualEdge {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed';
}

export interface Dc2MermaidConfig {
  diagram?: {
    type?: DiagramType;
    direction?: DiagramDirection;
    title?: string;
  };
  display?: {
    volumes?: boolean;
    ports?: boolean;
    networks?: boolean;
  };
  services?: Record<string, ServiceOverride>;
  edges?: ManualEdge[];
  exclude?: string[];
  theme?: ThemeConfig;
}
