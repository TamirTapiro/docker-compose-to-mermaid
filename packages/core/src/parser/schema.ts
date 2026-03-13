import { z } from 'zod';

// --- Port schema: accepts "3000:3000", "3000", "127.0.0.1:3000:3000", or object form ---
const portSchema = z.union([
  z.string(),
  z.object({
    target: z.number(),
    published: z.union([z.number(), z.string()]).optional(),
    protocol: z.enum(['tcp', 'udp']).optional(),
  }),
]);

// --- Environment: array form ["KEY=value"] or map form {KEY: value} ---
const environmentSchema = z.union([
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  z.array(z.string()),
]);

// --- depends_on: simple list or extended map with condition ---
const dependsOnSimple = z.array(z.string());
const dependsOnExtended = z.record(
  z.string(),
  z.object({
    condition: z
      .enum(['service_started', 'service_healthy', 'service_completed_successfully'])
      .optional(),
    restart: z.boolean().optional(),
    required: z.boolean().optional(),
  }),
);
const dependsOnSchema = z.union([dependsOnSimple, dependsOnExtended]);

// --- Build: string (context only) or object ---
const buildSchema = z.union([
  z.string(),
  z.object({
    context: z.string().optional(),
    dockerfile: z.string().optional(),
    args: z.record(z.string(), z.string()).optional(),
    target: z.string().optional(),
  }),
]);

// --- Volume mount: string or object form ---
const volumeMountSchema = z.union([
  z.string(),
  z.object({
    type: z.enum(['volume', 'bind', 'tmpfs', 'npipe']).optional(),
    source: z.string().optional(),
    // target is required by the Compose spec for object form, but we match the
    // permissive RawService type (target?: string) so validation stays non-fatal
    target: z.string().optional(),
    read_only: z.boolean().optional(),
  }),
]);

// --- Network attachment: string (in array) or null/object (in map) ---
const networkAttachmentSchema = z
  .object({
    aliases: z.array(z.string()).optional(),
    ipv4_address: z.string().optional(),
    ipv6_address: z.string().optional(),
  })
  .nullable();

// --- Service schema ---
export const serviceSchema = z
  .object({
    image: z.string().optional(),
    build: buildSchema.optional(),
    ports: z.array(portSchema).optional(),
    depends_on: dependsOnSchema.optional(),
    environment: environmentSchema.optional(),
    networks: z
      .union([z.array(z.string()), z.record(z.string(), networkAttachmentSchema)])
      .optional(),
    volumes: z.array(volumeMountSchema).optional(),
    links: z.array(z.string()).optional(),
    volumes_from: z.array(z.string()).optional(),
    container_name: z.string().optional(),
    restart: z.string().optional(),
    command: z.union([z.string(), z.array(z.string())]).optional(),
    entrypoint: z.union([z.string(), z.array(z.string())]).optional(),
    expose: z.array(z.union([z.string(), z.number()])).optional(),
    hostname: z.string().optional(),
    labels: z.union([z.record(z.string(), z.string()), z.array(z.string())]).optional(),
    healthcheck: z
      .object({
        test: z.union([z.string(), z.array(z.string())]).optional(),
        interval: z.string().optional(),
        timeout: z.string().optional(),
        retries: z.number().optional(),
      })
      .optional(),
  })
  .passthrough(); // allow unknown service keys without error (emit warnings separately)

// --- Network definition ---
export const networkSchema = z
  .object({
    driver: z.string().optional(),
    external: z.union([z.boolean(), z.object({ name: z.string().optional() })]).optional(),
    name: z.string().optional(),
    attachable: z.boolean().optional(),
    ipam: z.object({}).passthrough().optional(),
  })
  .nullable()
  .optional();

// --- Volume definition ---
export const volumeDefinitionSchema = z
  .object({
    driver: z.string().optional(),
    external: z.union([z.boolean(), z.object({ name: z.string().optional() })]).optional(),
    name: z.string().optional(),
    driver_opts: z.record(z.string(), z.string()).optional(),
  })
  .nullable()
  .optional();

// --- Root Compose schema ---
export const composeSchema = z
  .object({
    version: z.string().optional(), // deprecated but still common
    services: z.record(z.string(), serviceSchema).optional(),
    networks: z.record(z.string(), networkSchema).optional(),
    volumes: z.record(z.string(), volumeDefinitionSchema).optional(),
    configs: z.record(z.string(), z.object({}).passthrough()).optional(),
    secrets: z.record(z.string(), z.object({}).passthrough()).optional(),
  })
  .passthrough(); // top-level unknown keys → emit warnings

export type ComposeSchemaInput = z.input<typeof composeSchema>;
export type ComposeSchemaOutput = z.output<typeof composeSchema>;
