# docker-compose-to-mermaid — Backend Design Document

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [package.json — Dependencies](#2-packagejson--dependencies)
3. [TypeScript Interfaces & Types](#3-typescript-interfaces--types)
4. [Parsing Pipeline](#4-parsing-pipeline)
5. [Relationship Inference Engine](#5-relationship-inference-engine)
6. [Mermaid Generation Strategies](#6-mermaid-generation-strategies)
7. [CLI Interface Design](#7-cli-interface-design)
8. [Configuration File Support](#8-configuration-file-support)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Unit Test Structure](#10-unit-test-structure)
11. [Build & Bundle Strategy](#11-build--bundle-strategy)
12. [Edge Cases](#12-edge-cases)

---

## 1. Project Structure

```
docker-compose-to-mermaid/
├── src/
│   ├── cli/
│   │   ├── index.ts                  # Entry point — wires commander to pipeline
│   │   ├── options.ts                # CLI flag definitions and defaults
│   │   └── run.ts                    # Orchestrator: load → parse → infer → generate → write
│   │
│   ├── parser/
│   │   ├── index.ts                  # Public API: parseComposeFiles(paths[]) → ParsedCompose
│   │   ├── loader.ts                 # Read + YAML-parse files from disk
│   │   ├── validator.ts              # Schema validation via zod
│   │   ├── normalizer.ts             # Normalize shorthand forms to canonical shape
│   │   └── merger.ts                 # Deep-merge multiple compose files (base + overrides)
│   │
│   ├── inference/
│   │   ├── index.ts                  # Public API: inferRelationships(parsed) → Relationship[]
│   │   ├── depends-on.ts             # Extract explicit depends_on edges
│   │   ├── env-url.ts                # Scan environment vars for service URL references
│   │   ├── shared-network.ts         # Derive implicit links from shared network membership
│   │   └── volume-mount.ts           # Identify services that share named volumes
│   │
│   ├── generators/
│   │   ├── index.ts                  # Public API: generateDiagram(ir, options) → string
│   │   ├── flowchart.ts              # flowchart TD generator
│   │   ├── c4-context.ts             # C4Context diagram generator
│   │   ├── architecture.ts           # architecture-beta diagram generator
│   │   └── shared/
│   │       ├── id-sanitizer.ts       # Sanitize service names to valid Mermaid node IDs
│   │       └── label-builder.ts      # Build human-readable node labels from metadata
│   │
│   ├── config/
│   │   ├── index.ts                  # Resolve config: file → env → CLI flags (precedence)
│   │   ├── schema.ts                 # Zod schema for .compose2mermaid.json
│   │   └── defaults.ts               # Compile-time defaults
│   │
│   ├── types/
│   │   ├── compose.ts                # Raw Docker Compose YAML shape (pre-normalization)
│   │   ├── parsed.ts                 # Normalized, validated internal model
│   │   ├── inference.ts              # Relationship and edge types
│   │   ├── diagram.ts                # Diagram IR (intermediate representation)
│   │   └── config.ts                 # Config file schema types
│   │
│   └── utils/
│       ├── fs.ts                     # Filesystem helpers (resolve path, glob)
│       ├── logger.ts                 # Stderr logger with verbosity levels
│       └── result.ts                 # Result<T, E> monad for error propagation
│
├── tests/
│   ├── fixtures/
│   │   ├── simple.yml                # Minimal valid compose file
│   │   ├── full-stack.yml            # Complex compose with all features
│   │   ├── override-base.yml
│   │   ├── override-dev.yml
│   │   └── invalid-missing-image.yml
│   │
│   ├── parser/
│   │   ├── loader.test.ts
│   │   ├── validator.test.ts
│   │   ├── normalizer.test.ts
│   │   └── merger.test.ts
│   │
│   ├── inference/
│   │   ├── depends-on.test.ts
│   │   ├── env-url.test.ts
│   │   ├── shared-network.test.ts
│   │   └── volume-mount.test.ts
│   │
│   ├── generators/
│   │   ├── flowchart.test.ts
│   │   ├── c4-context.test.ts
│   │   └── architecture.test.ts
│   │
│   └── cli/
│       └── run.test.ts               # Integration test: file in → Mermaid string out
│
├── docs/
│   ├── seed.md
│   └── backend.md                    # This file
│
├── .compose2mermaid.json             # Example config file (committed as documentation)
├── package.json
├── tsconfig.json
├── tsconfig.build.json               # Excludes tests from build
├── .eslintrc.json
├── vitest.config.ts
├── build.ts                          # tsup build script
└── .gitignore
```

**Design rationale:** Each top-level `src/` directory maps to a single responsibility. The `cli/` layer owns nothing except orchestration. Business logic lives in `parser/`, `inference/`, and `generators/` — each independently testable with zero CLI coupling. This makes the core pipeline usable as a library if a VSCode extension or GitHub Action wrapper is built on top.

---

## 2. package.json — Dependencies

```json
{
  "name": "docker-compose-to-mermaid",
  "version": "0.1.0",
  "description": "Convert Docker Compose files into Mermaid architecture diagrams",
  "bin": {
    "compose2mermaid": "./dist/cli/index.js"
  },
  "type": "module",
  "engines": {
    "node": ">=18.0.0"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/cli/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src tests --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "js-yaml": "^4.1.0",
    "zod": "^3.23.8",
    "deep-merge-ts": "^5.1.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.14.0",
    "@vitest/coverage-v8": "^1.6.0",
    "tsup": "^8.1.0",
    "tsx": "^4.15.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

**Dependency rationale:**
- `commander` — battle-tested, type-safe CLI parsing; lighter than yargs for this scope
- `js-yaml` — fastest, most spec-compliant YAML parser for Node.js
- `zod` — runtime validation with automatic TypeScript inference; replaces hand-rolled validators
- `deep-merge-ts` — handles Docker Compose's array-append and object-merge semantics correctly
- `tsx` — zero-config TypeScript execution for development without a build step
- `tsup` — wraps esbuild; produces a single CJS/ESM bundle with declaration files

---

## 3. TypeScript Interfaces & Types

### 3.1 Raw Compose YAML Shape (`src/types/compose.ts`)

These types mirror the Docker Compose specification exactly — they represent what `js-yaml` produces before any normalization. All fields are optional because Docker Compose has extensive shorthand syntax.

```typescript
/**
 * Raw service definition as parsed from YAML.
 * All fields are optional — normalization enforces required fields.
 */
export interface RawService {
  image?: string;
  build?: string | RawBuild;
  command?: string | string[];
  entrypoint?: string | string[];
  environment?: string[] | Record<string, string | number | boolean | null>;
  env_file?: string | string[];
  ports?: Array<string | RawPortMapping>;
  volumes?: Array<string | RawVolumeMount>;
  networks?: string[] | Record<string, RawNetworkConfig | null>;
  depends_on?: string[] | Record<string, RawDependsOnCondition>;
  links?: string[];
  labels?: string[] | Record<string, string>;
  healthcheck?: RawHealthcheck;
  deploy?: RawDeploy;
  restart?: string;
  profiles?: string[];
}

export interface RawBuild {
  context?: string;
  dockerfile?: string;
  args?: string[] | Record<string, string>;
  target?: string;
}

export interface RawPortMapping {
  target: number;
  published?: string | number;
  protocol?: 'tcp' | 'udp';
  mode?: 'host' | 'ingress';
}

export interface RawVolumeMount {
  type?: 'volume' | 'bind' | 'tmpfs' | 'npipe';
  source?: string;
  target?: string;
  read_only?: boolean;
}

export interface RawDependsOnCondition {
  condition: 'service_started' | 'service_healthy' | 'service_completed_successfully';
  restart?: boolean;
}

export interface RawNetworkConfig {
  aliases?: string[];
  ipv4_address?: string;
  ipv6_address?: string;
}

export interface RawHealthcheck {
  test: string | string[];
  interval?: string;
  timeout?: string;
  retries?: number;
  start_period?: string;
  disable?: boolean;
}

export interface RawDeploy {
  replicas?: number;
  resources?: {
    limits?: { cpus?: string; memory?: string };
    reservations?: { cpus?: string; memory?: string };
  };
}

export interface RawNetwork {
  driver?: string;
  driver_opts?: Record<string, string>;
  external?: boolean | { name?: string };
  internal?: boolean;
  attachable?: boolean;
  labels?: string[] | Record<string, string>;
  ipam?: Record<string, unknown>;
}

export interface RawVolume {
  driver?: string;
  driver_opts?: Record<string, string>;
  external?: boolean | { name?: string };
  labels?: string[] | Record<string, string>;
}

/** Top-level raw compose file as parsed from YAML */
export interface RawComposeFile {
  version?: string;
  name?: string;
  services?: Record<string, RawService | null>;
  networks?: Record<string, RawNetwork | null>;
  volumes?: Record<string, RawVolume | null>;
  configs?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
}
```

### 3.2 Normalized Internal Model (`src/types/parsed.ts`)

After normalization, all shorthand forms are expanded and all fields that the rest of the pipeline depends on are guaranteed non-null.

```typescript
/** A fully normalized, validated service definition */
export interface Service {
  readonly name: string;
  readonly image: string | null;           // null when build-only
  readonly build: BuildConfig | null;
  readonly command: string[] | null;
  readonly environment: Record<string, string>;  // always a Record after normalization
  readonly ports: PortMapping[];
  readonly volumes: VolumeMount[];
  readonly networks: string[];             // list of network names this service belongs to
  readonly dependsOn: DependsOnEntry[];
  readonly labels: Record<string, string>;
  readonly healthcheck: Healthcheck | null;
  readonly restart: string | null;
  readonly profiles: string[];
  readonly deploy: DeployConfig | null;
}

export interface BuildConfig {
  readonly context: string;
  readonly dockerfile: string | null;
  readonly args: Record<string, string>;
  readonly target: string | null;
}

export interface PortMapping {
  readonly host: string | null;          // null for expose-only
  readonly container: number;
  readonly protocol: 'tcp' | 'udp';
}

export interface VolumeMount {
  readonly type: 'volume' | 'bind' | 'tmpfs' | 'npipe';
  readonly source: string | null;        // null for anonymous volumes
  readonly target: string;
  readonly readOnly: boolean;
}

export interface DependsOnEntry {
  readonly service: string;
  readonly condition: 'service_started' | 'service_healthy' | 'service_completed_successfully';
}

export interface Healthcheck {
  readonly test: string[];
  readonly interval: string | null;
  readonly timeout: string | null;
  readonly retries: number | null;
  readonly disabled: boolean;
}

export interface DeployConfig {
  readonly replicas: number;
}

export interface Network {
  readonly name: string;
  readonly driver: string;               // defaults to 'bridge'
  readonly external: boolean;
  readonly externalName: string | null;  // e.g. external: { name: 'my-network' }
  readonly internal: boolean;
}

export interface Volume {
  readonly name: string;
  readonly driver: string;               // defaults to 'local'
  readonly external: boolean;
  readonly externalName: string | null;
}

/** The fully normalized, merged, and validated compose configuration */
export interface ParsedCompose {
  readonly version: string | null;
  readonly projectName: string | null;
  readonly services: ReadonlyMap<string, Service>;
  readonly networks: ReadonlyMap<string, Network>;
  readonly volumes: ReadonlyMap<string, Volume>;
  /** Source file paths that were merged to produce this result */
  readonly sourceFiles: readonly string[];
}
```

### 3.3 Relationship & Inference Types (`src/types/inference.ts`)

```typescript
export type RelationshipKind =
  | 'depends_on'         // explicit depends_on directive
  | 'env_url'            // service name found in a URL-shaped env var value
  | 'shared_network'     // two services share a network (implicit reachability)
  | 'shared_volume';     // two services mount the same named volume

export type RelationshipStrength = 'strong' | 'weak';
// strong: depends_on, env_url (direct reference)
// weak: shared_network, shared_volume (implicit, may be coincidental)

export interface Relationship {
  readonly from: string;              // source service name
  readonly to: string;                // target service name (or volume/network name for non-service)
  readonly kind: RelationshipKind;
  readonly strength: RelationshipStrength;
  readonly label: string | null;      // e.g. "DATABASE_URL" for env_url relationships
  readonly condition: string | null;  // e.g. "service_healthy" for depends_on
}

/** Annotated service node enriched for diagram generation */
export interface ServiceNode {
  readonly name: string;
  readonly id: string;                // sanitized Mermaid-safe ID
  readonly label: string;             // human-readable label
  readonly image: string | null;
  readonly ports: PortMapping[];
  readonly isExternal: boolean;       // uses an external image (no build config)
  readonly isDatastore: boolean;      // heuristic: image matches postgres/redis/mysql/mongo etc.
  readonly networkMemberships: string[];
}

export interface InferenceResult {
  readonly nodes: ReadonlyMap<string, ServiceNode>;
  readonly relationships: readonly Relationship[];
  readonly networks: ReadonlyMap<string, Network>;
  readonly volumes: ReadonlyMap<string, Volume>;
}
```

### 3.4 Diagram IR (`src/types/diagram.ts`)

```typescript
export type DiagramType = 'flowchart' | 'c4-context' | 'architecture';
export type FlowchartDirection = 'TD' | 'LR' | 'BT' | 'RL';

export interface DiagramOptions {
  readonly type: DiagramType;
  readonly direction: FlowchartDirection;   // only relevant for flowchart
  readonly includeVolumes: boolean;
  readonly includeNetworks: boolean;
  readonly includeEnvLinks: boolean;
  readonly includeWeakLinks: boolean;       // whether to render shared_network edges
  readonly title: string | null;
}

/** Final output: ready-to-embed Mermaid syntax */
export interface GeneratedDiagram {
  readonly syntax: string;
  readonly type: DiagramType;
  readonly nodeCount: number;
  readonly edgeCount: number;
}
```

### 3.5 Config Types (`src/types/config.ts`)

```typescript
export interface UserConfig {
  readonly defaultDiagramType?: DiagramType;
  readonly defaultDirection?: FlowchartDirection;
  readonly includeVolumes?: boolean;
  readonly includeNetworks?: boolean;
  readonly includeEnvLinks?: boolean;
  readonly includeWeakLinks?: boolean;
  readonly outputFile?: string;
  readonly theme?: 'default' | 'dark' | 'forest' | 'neutral';
}

export interface ResolvedConfig extends Required<UserConfig> {
  // All fields guaranteed present after merging defaults
}
```

---

## 4. Parsing Pipeline

The pipeline is a pure functional chain: each stage takes data and returns a new immutable structure. No stage mutates its input. This makes every stage independently testable and the full pipeline trivially composable.

```
disk files
    │
    ▼
[Loader]       — read files from disk, call js-yaml, return RawComposeFile[]
    │
    ▼
[Validator]    — run Zod schema against each RawComposeFile, collect errors
    │
    ▼
[Normalizer]   — expand shorthand syntax, fill defaults, return ParsedCompose[]
    │
    ▼
[Merger]       — deep-merge ParsedCompose[] left-to-right (base → overrides)
    │
    ▼
         ParsedCompose  (single, authoritative model)
```

### 4.1 Loader (`src/parser/loader.ts`)

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import type { RawComposeFile } from '../types/compose.js';
import { Result } from '../utils/result.js';

/**
 * Read and YAML-parse a compose file from disk.
 * Returns a Result to allow the caller to accumulate errors rather than throw.
 */
export function loadComposeFile(filePath: string): Result<RawComposeFile, LoadError> {
  const absolutePath = resolve(filePath);

  let raw: string;
  try {
    raw = readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    return Result.err({ kind: 'file_not_found', path: absolutePath, cause: err });
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    return Result.err({ kind: 'yaml_parse_error', path: absolutePath, cause: err });
  }

  if (parsed === null || parsed === undefined) {
    return Result.err({ kind: 'empty_file', path: absolutePath, cause: null });
  }

  return Result.ok(parsed as RawComposeFile);
}

export type LoadErrorKind = 'file_not_found' | 'yaml_parse_error' | 'empty_file';

export interface LoadError {
  readonly kind: LoadErrorKind;
  readonly path: string;
  readonly cause: unknown;
}
```

**Key decisions:**
- `readFileSync` is intentional here — this is a CLI tool processing a handful of small config files. Synchronous I/O keeps the pipeline simple and errors predictable. If this evolves into a library used inside a long-running process, swap to `readFile` + `Promise.all`.
- The YAML parser is called with default options. Docker Compose files do not use YAML tags or custom types, so no custom schema is needed.
- An empty file (valid YAML `null`) is treated as an error, not an empty config, because it almost certainly means the user pointed at the wrong path.

### 4.2 Validator (`src/parser/validator.ts`)

Validation uses a Zod schema that mirrors `RawComposeFile`. The schema is intentionally permissive — it catches structural violations (wrong types, impossible combinations) but does not enforce business rules like "a `depends_on` target must be a defined service". Cross-reference validation happens in the normalizer where the full picture is available.

```typescript
import { z } from 'zod';

// Ports can be "3000:3000", "127.0.0.1:3000:3000", or an object
const portSchema = z.union([
  z.string(),
  z.object({
    target: z.number().int().positive(),
    published: z.union([z.string(), z.number()]).optional(),
    protocol: z.enum(['tcp', 'udp']).optional(),
  }),
]);

const volumeMountSchema = z.union([
  z.string(),
  z.object({
    type: z.enum(['volume', 'bind', 'tmpfs', 'npipe']).optional(),
    source: z.string().optional(),
    target: z.string().optional(),
    read_only: z.boolean().optional(),
  }),
]);

const dependsOnSchema = z.union([
  z.array(z.string()),
  z.record(
    z.object({
      condition: z.enum([
        'service_started',
        'service_healthy',
        'service_completed_successfully',
      ]),
      restart: z.boolean().optional(),
    })
  ),
]);

const serviceSchema = z.object({
  image: z.string().optional(),
  build: z.union([z.string(), z.object({ context: z.string().optional() }).passthrough()]).optional(),
  command: z.union([z.string(), z.array(z.string())]).optional(),
  environment: z.union([z.array(z.string()), z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))]).optional(),
  ports: z.array(portSchema).optional(),
  volumes: z.array(volumeMountSchema).optional(),
  networks: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
  depends_on: dependsOnSchema.optional(),
  labels: z.union([z.array(z.string()), z.record(z.string())]).optional(),
  restart: z.string().optional(),
  profiles: z.array(z.string()).optional(),
}).passthrough(); // passthrough: don't strip unknown keys during validation

export const composeFileSchema = z.object({
  version: z.string().optional(),
  name: z.string().optional(),
  services: z.record(serviceSchema.nullable()).optional(),
  networks: z.record(z.unknown().nullable()).optional(),
  volumes: z.record(z.unknown().nullable()).optional(),
}).passthrough();

export type ValidationError = {
  readonly kind: 'validation_error';
  readonly path: string;
  readonly issues: z.ZodIssue[];
};

export function validateComposeFile(
  raw: unknown,
  filePath: string
): Result<RawComposeFile, ValidationError> {
  const result = composeFileSchema.safeParse(raw);
  if (!result.success) {
    return Result.err({ kind: 'validation_error', path: filePath, issues: result.error.issues });
  }
  return Result.ok(result.data as RawComposeFile);
}
```

### 4.3 Normalizer (`src/parser/normalizer.ts`)

The normalizer is the most complex stage. Its job is to convert every Docker Compose shorthand form into the canonical internal `Service` / `Network` / `Volume` shapes. After normalization, no downstream code needs to branch on "is this an array or an object?".

**Normalization rules:**

| Field | Shorthand | Canonical |
|---|---|---|
| `environment` | `["KEY=val"]` array | `{ KEY: "val" }` record |
| `environment` | `{ KEY: null }` | `{ KEY: "" }` (null = inherit from host, treated as empty for diagram purposes) |
| `depends_on` | `["db", "redis"]` array | `[{ service: "db", condition: "service_started" }, ...]` |
| `networks` | `["backend"]` array | `["backend"]` (already canonical) |
| `networks` | `{ backend: null }` | `["backend"]` |
| `ports` | `"3000:3000"` string | `{ host: "3000", container: 3000, protocol: "tcp" }` |
| `ports` | `"127.0.0.1:3000:3000"` | `{ host: "127.0.0.1:3000", container: 3000, protocol: "tcp" }` |
| `volumes` | `"db_data:/var/lib/postgresql/data"` | `{ type: "volume", source: "db_data", target: "/var/lib/postgresql/data", readOnly: false }` |
| `volumes` | `"./app:/app:ro"` | `{ type: "bind", source: "./app", target: "/app", readOnly: true }` |
| `build` | `"./api"` string | `{ context: "./api", dockerfile: null, args: {}, target: null }` |
| `labels` | `["com.example.env=prod"]` | `{ "com.example.env": "prod" }` |

**Cross-reference validation** (errors collected, not thrown):
- A service listed in `depends_on` must exist in `services`
- A network listed under a service must be defined in the top-level `networks` (or auto-created as a default bridge network)
- A named volume referenced in a `volumes` mount must be defined in the top-level `volumes`

**Default network injection:** If a service defines no `networks`, Docker Compose implicitly places it on the project's default network. The normalizer replicates this — it creates a synthetic `default` network and assigns all services with no explicit network to it.

### 4.4 Merger (`src/parser/merger.ts`)

Docker Compose merge semantics differ from a simple recursive object merge:

| Field type | Merge behavior |
|---|---|
| Scalar (string, number, bool) | Override: later file wins |
| Map / object | Deep merge: keys are unioned, conflicts resolved by last-writer-wins |
| Sequence / array | **Append**: later file's items are appended to base (not replaced) |
| `null` value | Treated as empty / reset |

```typescript
import { deepmerge } from 'deep-merge-ts';
import type { RawComposeFile } from '../types/compose.js';

/**
 * Merge compose files left-to-right.
 * The first element is the base; each subsequent element is an override.
 * Follows Docker Compose v2 merge semantics.
 */
export function mergeComposeFiles(files: RawComposeFile[]): RawComposeFile {
  if (files.length === 0) {
    throw new ComposeParseError('At least one compose file is required');
  }
  if (files.length === 1) {
    return files[0];
  }

  return files.reduce((base, override) =>
    deepmerge(base, override, {
      // Arrays are appended for ports, volumes, environment array form, and networks array form.
      // Maps (services, networks top-level keys) are deep-merged.
      arrayMerge: appendMerge,
    })
  );
}

function appendMerge<T>(base: T[], override: T[]): T[] {
  // Deduplicate after append for string arrays (networks, profiles)
  const merged = [...base, ...override];
  if (merged.every((item) => typeof item === 'string')) {
    return [...new Set(merged)] as T[];
  }
  return merged;
}
```

**Override file resolution order** (matches Docker Compose CLI behavior):
1. `docker-compose.yml` (or `compose.yaml`)
2. `docker-compose.override.yml` (if present, auto-applied)
3. Any files passed via `--input` in left-to-right order

---

## 5. Relationship Inference Engine

The inference engine examines the normalized `ParsedCompose` and produces a list of `Relationship` objects representing all detected connections between services. It is organized as a set of independent strategies — each strategy is a pure function `(ParsedCompose) => Relationship[]`.

### 5.1 Strategy: `depends-on` (`src/inference/depends-on.ts`)

The simplest and highest-confidence strategy. Reads the normalized `dependsOn` array from each service.

```typescript
export function inferDependsOn(parsed: ParsedCompose): Relationship[] {
  const relationships: Relationship[] = [];

  for (const [serviceName, service] of parsed.services) {
    for (const dep of service.dependsOn) {
      relationships.push({
        from: serviceName,
        to: dep.service,
        kind: 'depends_on',
        strength: 'strong',
        label: null,
        condition: dep.condition !== 'service_started' ? dep.condition : null,
      });
    }
  }

  return relationships;
}
```

### 5.2 Strategy: `env-url` (`src/inference/env-url.ts`)

Scans environment variable values for URL patterns containing a hostname that matches a known service name. This catches common patterns like `DATABASE_URL=postgres://db:5432/app`.

**URL pattern matching:**

```typescript
// Matches: scheme://hostname:port/path or scheme://hostname/path
const URL_PATTERN = /^[a-z][a-z0-9+\-.]*:\/\/([a-zA-Z0-9_-]+)(?::\d+)?(?:\/|$)/;

// Also matches bare hostname:port patterns in env vars
const HOST_PORT_PATTERN = /^([a-zA-Z0-9_-]+):\d+$/;

export function inferEnvUrls(parsed: ParsedCompose): Relationship[] {
  const serviceNames = new Set(parsed.services.keys());
  const relationships: Relationship[] = [];

  for (const [serviceName, service] of parsed.services) {
    for (const [envKey, envValue] of Object.entries(service.environment)) {
      const hostname = extractHostname(envValue);
      if (hostname && serviceNames.has(hostname) && hostname !== serviceName) {
        relationships.push({
          from: serviceName,
          to: hostname,
          kind: 'env_url',
          strength: 'strong',
          label: envKey,
          condition: null,
        });
      }
    }
  }

  // Deduplicate: if depends_on already covers this edge, prefer depends_on
  return deduplicateRelationships(relationships, 'env_url');
}

function extractHostname(value: string): string | null {
  const urlMatch = URL_PATTERN.exec(value);
  if (urlMatch) return urlMatch[1];

  const hostPortMatch = HOST_PORT_PATTERN.exec(value);
  if (hostPortMatch) return hostPortMatch[1];

  return null;
}
```

**Deduplication policy:** If an `env_url` relationship already has a corresponding `depends_on` relationship between the same service pair, the `env_url` is dropped to avoid duplicate edges in the diagram. The `depends_on` is kept because it is authoritative.

### 5.3 Strategy: `shared-network` (`src/inference/shared-network.ts`)

Two services on the same network can reach each other. This is a weaker signal than an explicit reference — they might share a network without communicating.

```typescript
export function inferSharedNetworks(parsed: ParsedCompose): Relationship[] {
  // Build an inverted index: network → [service names]
  const networkToServices = new Map<string, string[]>();

  for (const [serviceName, service] of parsed.services) {
    for (const network of service.networks) {
      if (!networkToServices.has(network)) networkToServices.set(network, []);
      networkToServices.get(network)!.push(serviceName);
    }
  }

  const relationships: Relationship[] = [];

  for (const [networkName, members] of networkToServices) {
    // Only generate edges if this is NOT the default network (too noisy)
    // and if there are multiple members
    if (networkName === 'default' || members.length < 2) continue;

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        relationships.push({
          from: members[i],
          to: members[j],
          kind: 'shared_network',
          strength: 'weak',
          label: networkName,
          condition: null,
        });
      }
    }
  }

  return relationships;
}
```

**Note:** Shared-network edges are bidirectional by nature. The generator renders them as undirected or dashed to distinguish them from directed `depends_on` edges.

### 5.4 Strategy: `volume-mount` (`src/inference/volume-mount.ts`)

Two services mounting the same named volume share data. This is useful for visualizing data flows to/from databases and shared file stores.

```typescript
export function inferSharedVolumes(parsed: ParsedCompose): Relationship[] {
  const volumeToServices = new Map<string, string[]>();

  for (const [serviceName, service] of parsed.services) {
    for (const mount of service.volumes) {
      // Only track named volumes (type: 'volume', source !== null)
      if (mount.type !== 'volume' || mount.source === null) continue;

      if (!volumeToServices.has(mount.source)) volumeToServices.set(mount.source, []);
      volumeToServices.get(mount.source)!.push(serviceName);
    }
  }

  const relationships: Relationship[] = [];

  for (const [volumeName, services] of volumeToServices) {
    for (const svc of services) {
      relationships.push({
        from: svc,
        to: volumeName,         // target is the volume name, not a service
        kind: 'shared_volume',
        strength: 'weak',
        label: volumeName,
        condition: null,
      });
    }
  }

  return relationships;
}
```

### 5.5 Inference Orchestrator (`src/inference/index.ts`)

```typescript
export function inferRelationships(parsed: ParsedCompose): InferenceResult {
  const allRelationships: Relationship[] = [
    ...inferDependsOn(parsed),
    ...inferEnvUrls(parsed),
    ...inferSharedNetworks(parsed),
    ...inferSharedVolumes(parsed),
  ];

  // Global deduplication: same (from, to, kind) triple is collapsed
  const deduplicated = deduplicateByKey(
    allRelationships,
    (r) => `${r.from}::${r.to}::${r.kind}`
  );

  const nodes = buildServiceNodes(parsed.services);

  return {
    nodes,
    relationships: deduplicated,
    networks: parsed.networks,
    volumes: parsed.volumes,
  };
}
```

---

## 6. Mermaid Generation Strategies

Each generator receives an `InferenceResult` and `DiagramOptions` and returns a `GeneratedDiagram`. Generators are pure functions — they do not perform I/O.

### 6.1 ID Sanitizer (`src/generators/shared/id-sanitizer.ts`)

Mermaid node IDs must match `[a-zA-Z_][a-zA-Z0-9_-]*`. Service names like `my-api` or `web.1` contain characters that are valid in Mermaid but must be handled carefully.

```typescript
/**
 * Convert a service/volume/network name to a valid Mermaid node ID.
 * Replaces non-word characters with underscores and ensures the ID
 * starts with a letter or underscore.
 */
export function sanitizeId(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
  // Ensure first character is not a digit
  return /^\d/.test(sanitized) ? `_${sanitized}` : sanitized;
}
```

### 6.2 Flowchart Generator (`src/generators/flowchart.ts`)

```
flowchart TD
    api["api\n(build: ./api)\n:3000"]
    worker["worker\n(build: ./worker)"]
    redis["redis\n(redis:7)\n:6379"]
    db[("db\n(postgres:15)")]

    api -->|depends_on| db
    api -->|depends_on| redis
    api -.->|DATABASE_URL| db
    worker -->|depends_on| redis
    worker -->|depends_on| db

    subgraph net_backend["network: backend"]
        api
        worker
        redis
        db
    end

    db_data[("db_data")]
    db --- db_data
```

**Node shape conventions:**
- Services with `build` config: `["label"]` (rectangle with rounded corners)
- Services with only `image`: `["label"]` for stateless services
- Datastores (postgres, mysql, redis, mongo, elasticsearch, etc.): `[("label")]` (cylinder shape)
- Volumes: `[("label")]` (cylinder)
- Networks: rendered as `subgraph` blocks

**Edge style conventions:**
- `depends_on` (strong): `-->` solid arrow
- `env_url` (strong, inferred): `-.->` dashed arrow with env var key as label
- `shared_network` (weak): not rendered as edges — services are grouped in `subgraph` blocks instead
- `shared_volume` (weak): `---` undirected line

```typescript
export function generateFlowchart(
  ir: InferenceResult,
  options: DiagramOptions
): GeneratedDiagram {
  const lines: string[] = [];
  const direction = options.direction ?? 'TD';

  lines.push(`flowchart ${direction}`);

  if (options.title) {
    lines.push(`    ---`);
    lines.push(`    title: ${options.title}`);
    lines.push(`    ---`);
  }

  // Node declarations
  for (const [, node] of ir.nodes) {
    lines.push(`    ${node.id}${buildNodeLabel(node)}`);
  }

  if (options.includeVolumes) {
    for (const [, volume] of ir.volumes) {
      const vid = sanitizeId(volume.name);
      lines.push(`    ${vid}[("${volume.name}")]`);
    }
  }

  lines.push('');

  // Edge declarations
  let edgeCount = 0;
  for (const rel of ir.relationships) {
    if (rel.kind === 'shared_network') continue; // handled by subgraph
    if (rel.kind === 'shared_volume' && !options.includeVolumes) continue;
    if (rel.kind === 'env_url' && !options.includeEnvLinks) continue;
    if (rel.strength === 'weak' && !options.includeWeakLinks) continue;

    const fromId = sanitizeId(rel.from);
    const toId = sanitizeId(rel.to);
    const edgeStr = buildEdge(rel);
    lines.push(`    ${fromId} ${edgeStr} ${toId}`);
    edgeCount++;
  }

  // Network subgraphs
  if (options.includeNetworks) {
    lines.push('');
    for (const [networkName, services] of groupServicesByNetwork(ir)) {
      const netId = sanitizeId(`net_${networkName}`);
      lines.push(`    subgraph ${netId}["network: ${networkName}"]`);
      for (const svcId of services) {
        lines.push(`        ${svcId}`);
      }
      lines.push('    end');
    }
  }

  return {
    syntax: lines.join('\n'),
    type: 'flowchart',
    nodeCount: ir.nodes.size,
    edgeCount,
  };
}
```

### 6.3 C4 Context Generator (`src/generators/c4-context.ts`)

The C4 Context diagram treats each service as a "System" and uses `Rel()` for dependencies. This is best for high-level architecture documentation.

```
C4Context
    title Docker Compose Architecture

    System(api, "api", "build: ./api | port 3000")
    System(worker, "worker", "build: ./worker")
    SystemDb(redis, "redis", "redis:7 | port 6379")
    SystemDb(db, "db", "postgres:15")

    Rel(api, db, "depends_on", "service_healthy")
    Rel(api, redis, "depends_on")
    Rel(api, db, "DATABASE_URL")
    Rel(worker, redis, "depends_on")
    Rel(worker, db, "depends_on")
```

**C4 element type mapping:**
- `System` — stateless services (api, worker, web)
- `SystemDb` — datastore services (identified by image heuristic)
- `SystemQueue` — message broker services (rabbitmq, kafka, nats)
- `SystemExt` — external services (`external: true` on network level, or known external images)

### 6.4 Architecture Diagram Generator (`src/generators/architecture.ts`)

Uses the newer `architecture-beta` Mermaid syntax. Groups services into "groups" by network membership.

```
architecture-beta
    group backend(cloud)[Backend Network]

    service api(server)[api] in backend
    service worker(server)[worker] in backend
    service redis(database)[redis] in backend
    service db(database)[db] in backend

    api:R --> L:db
    api:R --> L:redis
    worker:R --> L:redis
    worker:R --> L:db
```

The architecture diagram is best for documentation-first use cases where the spatial layout matters. The generator attempts a left-to-right topological sort so that upstream services appear to the left of downstream consumers.

### 6.5 Datastore Heuristic

Used across all generators to assign special visual treatment to known data infrastructure:

```typescript
const DATASTORE_IMAGES = new Set([
  'postgres', 'postgresql', 'mysql', 'mariadb', 'mongodb', 'mongo',
  'redis', 'valkey', 'memcached', 'cassandra', 'cockroachdb', 'timescaledb',
  'elasticsearch', 'opensearch', 'meilisearch', 'typesense',
  'influxdb', 'prometheus', 'grafana',
]);

const MESSAGE_BROKER_IMAGES = new Set([
  'rabbitmq', 'kafka', 'zookeeper', 'nats', 'activemq', 'pulsar',
]);

export function classifyService(node: ServiceNode): 'service' | 'datastore' | 'broker' {
  if (!node.image) return 'service';
  const imageName = node.image.split(':')[0].split('/').at(-1)!.toLowerCase();
  if (DATASTORE_IMAGES.has(imageName)) return 'datastore';
  if (MESSAGE_BROKER_IMAGES.has(imageName)) return 'broker';
  return 'service';
}
```

---

## 7. CLI Interface Design

### 7.1 Command Structure

The CLI uses a single default command with optional subcommands for future extensibility.

```
compose2mermaid [options] [input...]

Options:
  -i, --input <files...>         Compose file(s) to parse (default: docker-compose.yml)
  -o, --output <file>            Write diagram to file (default: stdout)
  -t, --diagram-type <type>      Diagram type: flowchart|c4-context|architecture (default: flowchart)
  -d, --direction <dir>          Flowchart direction: TD|LR|BT|RL (default: TD)
      --include-volumes          Include named volumes in diagram (default: false)
      --include-networks         Include network groupings in diagram (default: true)
      --include-env-links        Show env var URL inferred edges (default: true)
      --include-weak-links       Show shared-network/shared-volume edges (default: false)
      --title <title>            Add a title to the diagram
      --config <file>            Path to config file (default: .compose2mermaid.json)
      --merge-override           Auto-merge docker-compose.override.yml if present (default: true)
  -v, --verbose                  Print parsing and inference details to stderr
      --version                  Print version
  -h, --help                     Display help
```

### 7.2 Commander.js Implementation (`src/cli/options.ts`)

```typescript
import { Command, Option } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
);

export function createProgram(): Command {
  const program = new Command();

  program
    .name('compose2mermaid')
    .description('Convert Docker Compose files into Mermaid architecture diagrams')
    .version(packageJson.version)
    .argument('[input...]', 'Compose file(s) to parse')
    .addOption(
      new Option('-i, --input <files...>', 'Compose file(s) to parse')
        .default(['docker-compose.yml'])
    )
    .addOption(
      new Option('-o, --output <file>', 'Output file path (default: stdout)')
    )
    .addOption(
      new Option('-t, --diagram-type <type>', 'Diagram type')
        .choices(['flowchart', 'c4-context', 'architecture'])
        .default('flowchart')
    )
    .addOption(
      new Option('-d, --direction <dir>', 'Flowchart direction')
        .choices(['TD', 'LR', 'BT', 'RL'])
        .default('TD')
    )
    .option('--include-volumes', 'Include named volumes', false)
    .option('--no-include-networks', 'Exclude network groupings')
    .option('--no-include-env-links', 'Exclude env var inferred edges')
    .option('--include-weak-links', 'Include weak (shared-network) edges', false)
    .option('--title <title>', 'Add a title to the diagram')
    .option('--config <file>', 'Path to config file', '.compose2mermaid.json')
    .option('--no-merge-override', 'Do not auto-merge docker-compose.override.yml')
    .option('-v, --verbose', 'Verbose output', false);

  return program;
}
```

### 7.3 Run Orchestrator (`src/cli/run.ts`)

```typescript
export async function run(rawArgs: string[]): Promise<void> {
  const program = createProgram();
  program.parse(rawArgs);

  const cliOptions = program.opts<CliOptions>();
  const positionalArgs = program.args;

  // Resolve config (file → env → CLI precedence)
  const config = resolveConfig(cliOptions);

  // Determine input files
  const inputFiles = resolveInputFiles(positionalArgs, cliOptions, config);

  if (config.verbose) {
    logger.info(`Processing files: ${inputFiles.join(', ')}`);
  }

  // Parse pipeline
  const parseResult = parseComposeFiles(inputFiles);
  if (parseResult.isErr()) {
    logger.error(formatParseError(parseResult.error));
    process.exit(1);
  }

  const parsed = parseResult.value;

  if (config.verbose) {
    logger.info(`Found ${parsed.services.size} services, ${parsed.networks.size} networks, ${parsed.volumes.size} volumes`);
  }

  // Inference
  const ir = inferRelationships(parsed);

  if (config.verbose) {
    logger.info(`Inferred ${ir.relationships.length} relationships`);
  }

  // Generation
  const diagram = generateDiagram(ir, buildDiagramOptions(config));

  // Output
  if (config.outputFile) {
    writeFileSync(resolve(config.outputFile), diagram.syntax, 'utf-8');
    logger.info(`Diagram written to ${config.outputFile}`);
  } else {
    process.stdout.write(diagram.syntax + '\n');
  }
}
```

---

## 8. Configuration File Support

### 8.1 Config File: `.compose2mermaid.json`

```json
{
  "defaultDiagramType": "flowchart",
  "defaultDirection": "LR",
  "includeVolumes": true,
  "includeNetworks": true,
  "includeEnvLinks": true,
  "includeWeakLinks": false,
  "outputFile": "docs/architecture.md",
  "theme": "default"
}
```

### 8.2 Config Resolution Order

Later sources override earlier ones. CLI flags have the highest priority.

```
1. Compiled-in defaults (src/config/defaults.ts)
2. .compose2mermaid.json in the working directory
3. File specified by --config flag (if different from default)
4. CLI flags
```

### 8.3 Config Schema (`src/config/schema.ts`)

```typescript
import { z } from 'zod';

export const userConfigSchema = z.object({
  defaultDiagramType: z.enum(['flowchart', 'c4-context', 'architecture']).optional(),
  defaultDirection: z.enum(['TD', 'LR', 'BT', 'RL']).optional(),
  includeVolumes: z.boolean().optional(),
  includeNetworks: z.boolean().optional(),
  includeEnvLinks: z.boolean().optional(),
  includeWeakLinks: z.boolean().optional(),
  outputFile: z.string().optional(),
  theme: z.enum(['default', 'dark', 'forest', 'neutral']).optional(),
}).strict(); // strict: reject unknown keys to catch typos

export type UserConfig = z.infer<typeof userConfigSchema>;
```

### 8.4 Config Loader (`src/config/index.ts`)

```typescript
export function resolveConfig(cliOptions: CliOptions): ResolvedConfig {
  const defaults = getDefaults();

  // Try to load file config
  const configPath = resolve(cliOptions.config ?? '.compose2mermaid.json');
  const fileConfig = loadFileConfig(configPath);

  // Merge in priority order
  return {
    defaultDiagramType: cliOptions.diagramType ?? fileConfig?.defaultDiagramType ?? defaults.defaultDiagramType,
    defaultDirection: cliOptions.direction ?? fileConfig?.defaultDirection ?? defaults.defaultDirection,
    includeVolumes: cliOptions.includeVolumes ?? fileConfig?.includeVolumes ?? defaults.includeVolumes,
    includeNetworks: cliOptions.includeNetworks ?? fileConfig?.includeNetworks ?? defaults.includeNetworks,
    includeEnvLinks: cliOptions.includeEnvLinks ?? fileConfig?.includeEnvLinks ?? defaults.includeEnvLinks,
    includeWeakLinks: cliOptions.includeWeakLinks ?? fileConfig?.includeWeakLinks ?? defaults.includeWeakLinks,
    outputFile: cliOptions.output ?? fileConfig?.outputFile ?? null,
    theme: fileConfig?.theme ?? defaults.theme,
    verbose: cliOptions.verbose ?? false,
  };
}

function loadFileConfig(configPath: string): UserConfig | null {
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = userConfigSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn(`Invalid config file at ${configPath}: ${result.error.message}`);
      return null;
    }
    return result.data;
  } catch {
    // File not found is normal — config file is optional
    return null;
  }
}
```

---

## 9. Error Handling Patterns

### 9.1 Result Monad (`src/utils/result.ts`)

Errors propagate as values, not exceptions. This forces callers to explicitly handle failure paths and makes the error surface of each function visible in its return type.

```typescript
export type Result<T, E> = Ok<T> | Err<E>;

export class Ok<T> {
  readonly ok = true as const;
  constructor(readonly value: T) {}
  isOk(): this is Ok<T> { return true; }
  isErr(): this is Err<never> { return false; }
  map<U>(fn: (value: T) => U): Ok<U> { return new Ok(fn(this.value)); }
  mapErr<F>(_fn: (err: never) => F): Ok<T> { return this; }
}

export class Err<E> {
  readonly ok = false as const;
  constructor(readonly error: E) {}
  isOk(): this is Ok<never> { return false; }
  isErr(): this is Err<E> { return true; }
  map<U>(_fn: (value: never) => U): Err<E> { return this; }
  mapErr<F>(fn: (err: E) => F): Err<F> { return new Err(fn(this.error)); }
}

export const Result = {
  ok: <T>(value: T): Ok<T> => new Ok(value),
  err: <E>(error: E): Err<E> => new Err(error),
};
```

### 9.2 Error Type Hierarchy

```typescript
// src/utils/errors.ts

export class ComposeParseError extends Error {
  constructor(
    message: string,
    readonly filePath: string | null = null,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ComposeParseError';
  }
}

export class ComposeValidationError extends Error {
  constructor(
    message: string,
    readonly issues: ValidationIssue[],
    readonly filePath: string
  ) {
    super(message);
    this.name = 'ComposeValidationError';
  }
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
```

### 9.3 CLI Error Presentation

Errors surfaced to the user must be actionable. The format is:

```
error: <brief human-readable explanation>
  → file: docker-compose.yml
  → issue: service "worker" depends_on "queue" but "queue" is not defined

Run with --verbose for full details.
```

Internal stack traces never appear in normal output. They are printed to stderr only when `--verbose` is set.

---

## 10. Unit Test Structure

Uses Vitest (fast, native ESM, identical Jest API).

### 10.1 Normalizer Tests (`tests/parser/normalizer.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeComposeFile } from '../../src/parser/normalizer.js';
import type { RawComposeFile } from '../../src/types/compose.js';

describe('normalizeComposeFile', () => {
  describe('environment normalization', () => {
    it('converts array form to record form', () => {
      const raw: RawComposeFile = {
        services: {
          api: {
            image: 'node:20',
            environment: ['DATABASE_URL=postgres://db:5432/app', 'PORT=3000'],
          },
        },
      };

      const result = normalizeComposeFile(raw);

      expect(result.services.get('api')?.environment).toEqual({
        DATABASE_URL: 'postgres://db:5432/app',
        PORT: '3000',
      });
    });

    it('converts null environment values to empty string', () => {
      const raw: RawComposeFile = {
        services: { api: { image: 'node:20', environment: { SECRET: null } } },
      };

      const result = normalizeComposeFile(raw);

      expect(result.services.get('api')?.environment.SECRET).toBe('');
    });
  });

  describe('depends_on normalization', () => {
    it('converts array form to object form with service_started condition', () => {
      const raw: RawComposeFile = {
        services: {
          api: { image: 'node:20', depends_on: ['db', 'redis'] },
          db: { image: 'postgres:15' },
          redis: { image: 'redis:7' },
        },
      };

      const result = normalizeComposeFile(raw);
      const deps = result.services.get('api')?.dependsOn ?? [];

      expect(deps).toHaveLength(2);
      expect(deps).toContainEqual({ service: 'db', condition: 'service_started' });
      expect(deps).toContainEqual({ service: 'redis', condition: 'service_started' });
    });

    it('preserves explicit condition from object form', () => {
      const raw: RawComposeFile = {
        services: {
          api: {
            image: 'node:20',
            depends_on: { db: { condition: 'service_healthy' } },
          },
          db: { image: 'postgres:15' },
        },
      };

      const result = normalizeComposeFile(raw);
      const deps = result.services.get('api')?.dependsOn ?? [];

      expect(deps[0]).toEqual({ service: 'db', condition: 'service_healthy' });
    });
  });

  describe('port normalization', () => {
    it('parses host:container string form', () => {
      const raw: RawComposeFile = {
        services: { api: { image: 'node:20', ports: ['3000:3000'] } },
      };

      const result = normalizeComposeFile(raw);
      const ports = result.services.get('api')?.ports ?? [];

      expect(ports[0]).toEqual({ host: '3000', container: 3000, protocol: 'tcp' });
    });

    it('parses ip:host:container form', () => {
      const raw: RawComposeFile = {
        services: { api: { image: 'node:20', ports: ['127.0.0.1:3000:3000'] } },
      };

      const result = normalizeComposeFile(raw);

      expect(result.services.get('api')?.ports[0].host).toBe('127.0.0.1:3000');
    });

    it('handles container-only port (no host binding)', () => {
      const raw: RawComposeFile = {
        services: { api: { image: 'node:20', ports: ['3000'] } },
      };

      const result = normalizeComposeFile(raw);

      expect(result.services.get('api')?.ports[0].host).toBeNull();
    });
  });

  describe('default network injection', () => {
    it('assigns services with no explicit network to the default network', () => {
      const raw: RawComposeFile = {
        services: {
          api: { image: 'node:20' },
          db: { image: 'postgres:15' },
        },
      };

      const result = normalizeComposeFile(raw);

      expect(result.services.get('api')?.networks).toContain('default');
      expect(result.services.get('db')?.networks).toContain('default');
    });
  });
});
```

### 10.2 Inference Tests (`tests/inference/env-url.test.ts`)

```typescript
describe('inferEnvUrls', () => {
  it('detects service hostname in DATABASE_URL', () => {
    const parsed = buildParsedCompose({
      services: {
        api: {
          environment: { DATABASE_URL: 'postgres://db:5432/app' },
          dependsOn: [],
        },
        db: {},
      },
    });

    const relationships = inferEnvUrls(parsed);

    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      from: 'api',
      to: 'db',
      kind: 'env_url',
      strength: 'strong',
      label: 'DATABASE_URL',
    });
  });

  it('does not create a self-referencing edge', () => {
    const parsed = buildParsedCompose({
      services: {
        api: { environment: { SERVICE_URL: 'http://api:3000/health' } },
      },
    });

    expect(inferEnvUrls(parsed)).toHaveLength(0);
  });

  it('ignores env vars whose hostname does not match any service', () => {
    const parsed = buildParsedCompose({
      services: {
        api: { environment: { EXTERNAL_API: 'https://api.stripe.com/v1' } },
      },
    });

    expect(inferEnvUrls(parsed)).toHaveLength(0);
  });

  it('deduplicates against existing depends_on relationships', () => {
    const parsed = buildParsedCompose({
      services: {
        api: {
          environment: { DATABASE_URL: 'postgres://db:5432/app' },
          dependsOn: [{ service: 'db', condition: 'service_started' }],
        },
        db: {},
      },
    });

    const allRelationships = inferRelationships(parsed);
    const envUrlEdges = allRelationships.relationships.filter((r) => r.kind === 'env_url');

    // env_url should be dropped because depends_on already covers this edge
    expect(envUrlEdges).toHaveLength(0);
  });
});
```

### 10.3 Generator Tests (`tests/generators/flowchart.test.ts`)

```typescript
describe('generateFlowchart', () => {
  it('produces valid flowchart TD syntax for a simple two-service setup', () => {
    const ir = buildInferenceResult({
      nodes: { api: { isDatastore: false }, db: { isDatastore: true } },
      relationships: [
        { from: 'api', to: 'db', kind: 'depends_on', strength: 'strong', label: null, condition: null },
      ],
    });

    const diagram = generateFlowchart(ir, defaultOptions());

    expect(diagram.syntax).toContain('flowchart TD');
    expect(diagram.syntax).toContain('api');
    expect(diagram.syntax).toContain('db');
    expect(diagram.syntax).toMatch(/api\s*-->\s*db/);
  });

  it('renders datastores with cylinder notation', () => {
    const ir = buildInferenceResult({
      nodes: { db: { image: 'postgres:15', isDatastore: true } },
      relationships: [],
    });

    const diagram = generateFlowchart(ir, defaultOptions());

    // Cylinder: [("label")]
    expect(diagram.syntax).toMatch(/db\s*\["/);
  });

  it('wraps services in subgraph blocks when includeNetworks is true', () => {
    const ir = buildInferenceResult({
      nodes: { api: {}, db: {} },
      relationships: [],
      networkMemberships: { api: ['backend'], db: ['backend'] },
    });

    const diagram = generateFlowchart(ir, { ...defaultOptions(), includeNetworks: true });

    expect(diagram.syntax).toContain('subgraph');
    expect(diagram.syntax).toContain('network: backend');
  });

  it('sanitizes service names with hyphens to valid node IDs', () => {
    const ir = buildInferenceResult({
      nodes: { 'my-api': {} },
      relationships: [],
    });

    const diagram = generateFlowchart(ir, defaultOptions());

    expect(diagram.syntax).toContain('my_api');
    expect(diagram.syntax).not.toContain('my-api[');
  });
});
```

### 10.4 Merger Tests (`tests/parser/merger.test.ts`)

```typescript
describe('mergeComposeFiles', () => {
  it('later file overrides scalar values', () => {
    const base: RawComposeFile = { services: { api: { image: 'node:18' } } };
    const override: RawComposeFile = { services: { api: { image: 'node:20' } } };

    const merged = mergeComposeFiles([base, override]);

    expect(merged.services!.api!.image).toBe('node:20');
  });

  it('appends port arrays rather than replacing them', () => {
    const base: RawComposeFile = { services: { api: { image: 'node:20', ports: ['3000:3000'] } } };
    const override: RawComposeFile = { services: { api: { ports: ['9229:9229'] } } };

    const merged = mergeComposeFiles([base, override]);

    expect(merged.services!.api!.ports).toEqual(['3000:3000', '9229:9229']);
  });

  it('adds new services from override', () => {
    const base: RawComposeFile = { services: { api: { image: 'node:20' } } };
    const override: RawComposeFile = { services: { debug: { image: 'busybox' } } };

    const merged = mergeComposeFiles([base, override]);

    expect(Object.keys(merged.services!)).toContain('api');
    expect(Object.keys(merged.services!)).toContain('debug');
  });
});
```

### 10.5 Integration Test (`tests/cli/run.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { run } from '../../src/cli/run.js';

const FIXTURES = resolve(__dirname, '../fixtures');

describe('CLI integration', () => {
  it('generates flowchart output for the full-stack fixture', async () => {
    const output = await captureStdout(() =>
      run(['node', 'compose2mermaid', `${FIXTURES}/full-stack.yml`])
    );

    expect(output).toContain('flowchart TD');
    expect(output).toContain('api');
    expect(output).toContain('db');
  });

  it('exits with code 1 and prints error when input file does not exist', async () => {
    await expect(
      run(['node', 'compose2mermaid', '--input', 'nonexistent.yml'])
    ).rejects.toThrow('file_not_found');
  });
});
```

---

## 11. Build & Bundle Strategy

### 11.1 tsup Configuration (`build.ts` / `tsup.config.ts`)

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],              // Node.js ESM — no CJS needed for a CLI
  target: 'node18',
  outDir: 'dist',
  splitting: false,             // single file for a CLI is simpler to distribute
  sourcemap: true,
  clean: true,
  minify: false,                // readable output eases debugging in the field
  banner: {
    js: '#!/usr/bin/env node', // shebang for direct execution
  },
  esbuildOptions(options) {
    options.platform = 'node';
  },
});
```

### 11.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": false,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 11.3 Distribution Strategy

The built `dist/cli/index.js` has a shebang line and is declared as the `bin` entry in `package.json`. Users install it with:

```bash
npm install -g docker-compose-to-mermaid
# or without global install:
npx docker-compose-to-mermaid --input docker-compose.yml
```

For single-binary distribution (no Node.js required), the project can optionally integrate `@yao-pkg/pkg` or `bun build --compile` as a secondary build target. This is optional and should be evaluated based on user demand.

---

## 12. Edge Cases

These are cases that will cause incorrect output or crashes if not handled explicitly.

### 12.1 YAML Parsing Edge Cases

| Case | Risk | Handling |
|---|---|---|
| Empty file | `js-yaml` returns `null` | Loader returns `LoadError { kind: 'empty_file' }` |
| Non-mapping root | `js-yaml` returns a scalar or array | Validator catches wrong root type via Zod |
| YAML anchors and aliases (`&anchor`, `*alias`) | `js-yaml` resolves them automatically | No special handling needed |
| Duplicate keys in YAML | `js-yaml` uses last value by default | Acceptable — matches Docker Compose CLI behavior |
| `version` field absent | Valid in Compose v2+ spec | Treated as `null`, not an error |
| `null` service definition (`serviceName: ~`) | Service key present with null value | Normalizer skips null services with a warning |

### 12.2 Compose Structure Edge Cases

| Case | Risk | Handling |
|---|---|---|
| `depends_on` references undefined service | Broken reference | Normalizer emits a `ValidationIssue`, service is still rendered but edge is omitted |
| Service references network not defined at top level | Implicit network | Auto-created as a bridge network in the normalized model |
| Named volume mounted but not declared at top level | Same as above | Auto-created as a local volume |
| Service with neither `image` nor `build` | Invalid per spec | Validator emits error; service rendered as `???` in diagram |
| Circular `depends_on` | Docker Compose rejects this at runtime | Detected during edge construction; a warning is emitted and the cycle-closing edge is omitted |
| Service name containing Mermaid reserved words | ID collision or syntax error | `sanitizeId` appends `_svc` suffix to reserved words (`end`, `subgraph`, `style`, etc.) |

### 12.3 Inference Edge Cases

| Case | Risk | Handling |
|---|---|---|
| Env var value that is a service name but unrelated | False positive edge | Accepted tradeoff — URL pattern matching reduces false positives significantly |
| Two services with identical image names | Both classified as datastore | Correct behavior |
| Service with 20+ dependencies | Dense, unreadable diagram | `--diagram-type architecture` or `--no-include-weak-links` flag mitigates this |
| Service on both `frontend` and `backend` networks | Multiple subgraph memberships | In flowchart mode, the service node is listed in both subgraphs (Mermaid supports this) |

### 12.4 Mermaid Generation Edge Cases

| Case | Risk | Handling |
|---|---|---|
| Service name with spaces | Invalid Mermaid ID | `sanitizeId` replaces spaces with underscores |
| Service name starting with a digit | Invalid Mermaid ID | `sanitizeId` prepends underscore |
| Service label containing `"` | Breaks Mermaid string literal | Label builder escapes `"` as `#quot;` in Mermaid syntax |
| Zero services in compose file | Empty diagram | Generator emits a minimal valid diagram with a comment explaining the empty state |
| Single service, no relationships | Isolated node | Valid diagram; rendered as a single node |
| 50+ services | Performance and readability | No hard limit; performance is negligible at this scale. Readability is a user concern — flags exist to reduce noise |

### 12.5 File Resolution Edge Cases

| Case | Risk | Handling |
|---|---|---|
| Relative path input | Resolves to wrong directory | Always `resolve()` relative to `process.cwd()` |
| Same file passed twice | Duplicate merge | Deduplicate input file list by resolved absolute path before parsing |
| Override file not present | Auto-merge fails silently | Log info message at verbose level; proceed without override |
| Input file is a directory | `readFileSync` throws | Loader catches and returns `{ kind: 'file_not_found' }` with a descriptive message |
