import type { RenderOptions } from '../types/renderer.js';

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  type: 'flowchart',
  direction: 'LR',
  includeVolumes: true,
  includePorts: true,
  includeNetworkBoundaries: true,
  theme: {
    database: '#336791',
    cache: '#DC382D',
    queue: '#FF6600',
    proxy: '#009639',
    storage: '#569A31',
    service: '#0078D4',
  },
};
