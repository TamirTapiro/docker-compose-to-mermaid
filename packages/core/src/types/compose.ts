// Raw service as it comes from YAML (permissive, all optional)
export interface RawService {
  image?: string;
  build?: string | { context?: string; dockerfile?: string; args?: Record<string, string> };
  ports?: Array<string | { target: number; published?: number; protocol?: string }>;
  depends_on?: string[] | Record<string, { condition?: string }>;
  environment?: Record<string, string> | string[];
  networks?: string[] | Record<string, null | { aliases?: string[] }>;
  volumes?: Array<string | { source?: string; target?: string; type?: string }>;
  links?: string[];
  volumes_from?: string[];
}

export interface RawNetwork {
  driver?: string;
  external?: boolean | { name?: string };
  name?: string;
}

export interface RawVolume {
  driver?: string;
  external?: boolean | { name?: string };
  name?: string;
}

export interface RawCompose {
  version?: string;
  services?: Record<string, RawService>;
  networks?: Record<string, RawNetwork | null>;
  volumes?: Record<string, RawVolume | null>;
}

// Normalized (canonical) forms — all required after normalization
export interface NormalizedPort {
  host: string;
  container: string;
  protocol: 'tcp' | 'udp';
}

export interface NormalizedDependsOn {
  [service: string]: {
    condition: 'service_started' | 'service_healthy' | 'service_completed_successfully';
  };
}

export interface NormalizedService {
  image?: string;
  build?: { context: string; dockerfile?: string; args?: Record<string, string> };
  ports: NormalizedPort[];
  dependsOn: NormalizedDependsOn;
  environment: Record<string, string>;
  networks: string[];
  volumes: Array<{ source?: string; target: string; type: 'volume' | 'bind' | 'tmpfs' }>;
  links: string[];
  volumesFrom: string[];
}

export interface NormalizedNetwork {
  driver?: string;
  external: boolean;
  name?: string;
}

export interface NormalizedVolume {
  driver?: string;
  external: boolean;
  name?: string;
}

export interface NormalizedCompose {
  services: Record<string, NormalizedService>;
  networks: Record<string, NormalizedNetwork>;
  volumes: Record<string, NormalizedVolume>;
  sourceFiles: string[];
}
