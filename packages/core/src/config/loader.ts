import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { join } from 'node:path';
import { configSchema } from './schema.js';
import { ok, err } from '../types/result.js';
import type { Result, Diagnostic } from '../types/result.js';
import type { Dc2MermaidConfig } from '../types/config.js';

const CONFIG_FILENAMES = ['.dc2mermaid.yml', '.dc2mermaid.yaml'];

export async function loadConfig(
  dir: string,
  explicitPath?: string,
): Promise<Result<Dc2MermaidConfig | null, Diagnostic>> {
  const paths = explicitPath ? [explicitPath] : CONFIG_FILENAMES.map((f) => join(dir, f));

  for (const filePath of paths) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const raw = parseYaml(content);
      const result = configSchema.safeParse(raw);

      if (!result.success) {
        const e = result.error.errors[0];
        return err({
          code: 'E003',
          message: `Config error: ${e?.message ?? 'invalid'}`,
          file: filePath,
          help: `Path: ${e?.path.join('.') ?? 'unknown'}`,
        });
      }

      return ok(result.data as Dc2MermaidConfig);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue;
      return err({ code: 'E001', message: `Cannot read config: ${filePath}`, file: filePath });
    }
  }

  return ok(null);
}
