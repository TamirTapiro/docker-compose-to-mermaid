import type { Dc2MermaidConfig } from '../types/config.js';
import type { RenderOptions } from '../types/renderer.js';
import { DEFAULT_RENDER_OPTIONS } from './defaults.js';

export function mergeOptions(
  config: Dc2MermaidConfig | null,
  cli: Partial<RenderOptions> = {},
): RenderOptions {
  const title = cli.title ?? config?.diagram?.title;

  return {
    type: cli.type ?? config?.diagram?.type ?? DEFAULT_RENDER_OPTIONS.type,
    direction: cli.direction ?? config?.diagram?.direction ?? DEFAULT_RENDER_OPTIONS.direction,
    ...(title !== undefined ? { title } : {}),
    includeVolumes:
      cli.includeVolumes ?? config?.display?.volumes ?? DEFAULT_RENDER_OPTIONS.includeVolumes,
    includePorts: cli.includePorts ?? config?.display?.ports ?? DEFAULT_RENDER_OPTIONS.includePorts,
    includeNetworkBoundaries:
      cli.includeNetworkBoundaries ??
      config?.display?.networks ??
      DEFAULT_RENDER_OPTIONS.includeNetworkBoundaries,
    theme: { ...DEFAULT_RENDER_OPTIONS.theme, ...config?.theme, ...cli.theme },
  };
}
