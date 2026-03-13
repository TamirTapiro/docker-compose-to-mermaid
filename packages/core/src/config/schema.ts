import { z } from 'zod';

const nodeTypeSchema = z.enum([
  'service',
  'database',
  'cache',
  'queue',
  'proxy',
  'storage',
  'volume',
  'external',
]);

export const configSchema = z
  .object({
    diagram: z
      .object({
        type: z.enum(['flowchart', 'c4', 'architecture']).optional(),
        direction: z.enum(['LR', 'TB', 'RL', 'BT']).optional(),
        title: z.string().optional(),
      })
      .optional(),
    display: z
      .object({
        volumes: z.boolean().optional(),
        ports: z.boolean().optional(),
        networks: z.boolean().optional(),
      })
      .optional(),
    services: z
      .record(
        z.string(),
        z.object({
          type: nodeTypeSchema.optional(),
          label: z.string().optional(),
        }),
      )
      .optional(),
    edges: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          label: z.string().optional(),
          style: z.enum(['solid', 'dashed']).optional(),
        }),
      )
      .optional(),
    exclude: z.array(z.string()).optional(),
    theme: z
      .object({
        database: z.string().optional(),
        cache: z.string().optional(),
        queue: z.string().optional(),
        proxy: z.string().optional(),
        storage: z.string().optional(),
        service: z.string().optional(),
      })
      .optional(),
  })
  .strict();
