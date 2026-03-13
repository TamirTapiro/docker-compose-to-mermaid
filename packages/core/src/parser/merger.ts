import type {
  NormalizedCompose,
  NormalizedService,
  NormalizedNetwork,
  NormalizedVolume,
} from '../types/compose.js';

function mergeServices(
  base: Record<string, NormalizedService>,
  override: Record<string, NormalizedService>,
): Record<string, NormalizedService> {
  const result: Record<string, NormalizedService> = { ...base };
  for (const [name, overrideService] of Object.entries(override)) {
    const baseService = result[name];
    if (!baseService) {
      result[name] = overrideService;
      continue;
    }
    result[name] = {
      // Scalars: override wins; use conditional spreads for exactOptionalPropertyTypes
      ...(overrideService.image !== undefined
        ? { image: overrideService.image }
        : baseService.image !== undefined
          ? { image: baseService.image }
          : {}),
      ...(overrideService.build !== undefined
        ? { build: overrideService.build }
        : baseService.build !== undefined
          ? { build: baseService.build }
          : {}),
      // Maps: deep-merge (override keys win)
      environment: { ...baseService.environment, ...overrideService.environment },
      dependsOn: { ...baseService.dependsOn, ...overrideService.dependsOn },
      // Arrays: append (override items added after base)
      ports: [...baseService.ports, ...overrideService.ports],
      volumes: [...baseService.volumes, ...overrideService.volumes],
      links: [...baseService.links, ...overrideService.links],
      volumesFrom: [...baseService.volumesFrom, ...overrideService.volumesFrom],
      // Networks: union (deduplicated)
      networks: [...new Set([...baseService.networks, ...overrideService.networks])],
    };
  }
  return result;
}

function mergeNetworks(
  base: Record<string, NormalizedNetwork>,
  override: Record<string, NormalizedNetwork>,
): Record<string, NormalizedNetwork> {
  return { ...base, ...override };
}

function mergeVolumes(
  base: Record<string, NormalizedVolume>,
  override: Record<string, NormalizedVolume>,
): Record<string, NormalizedVolume> {
  return { ...base, ...override };
}

/**
 * Deep-merge multiple NormalizedCompose documents (base first, overrides after).
 * Follows the Docker Compose merge specification:
 * - Scalars (`image`, `build`): override file wins
 * - Maps (`environment`, `dependsOn`): deep-merged — override keys win
 * - Arrays (`ports`, `volumes`, `links`, `volumesFrom`): appended (override items after base)
 * - Networks: union of all network names (deduplicated)
 */
export function mergeComposeFiles(files: NormalizedCompose[]): NormalizedCompose {
  if (files.length === 0) {
    return { services: {}, networks: {}, volumes: {}, sourceFiles: [] };
  }
  const first = files[0];
  if (!first) return { services: {}, networks: {}, volumes: {}, sourceFiles: [] };

  return files.slice(1).reduce<NormalizedCompose>(
    (acc, current) => ({
      services: mergeServices(acc.services, current.services),
      networks: mergeNetworks(acc.networks, current.networks),
      volumes: mergeVolumes(acc.volumes, current.volumes),
      sourceFiles: [...acc.sourceFiles, ...current.sourceFiles],
    }),
    first,
  );
}
