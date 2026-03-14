import { resolve, dirname } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  generate,
  loadConfig,
  mergeOptions,
  formatDiagnostics,
  getExitCode,
  EXIT_SUCCESS,
} from 'dc2mermaid-core';
import type { DiagramType, DiagramDirection } from 'dc2mermaid-core';
import { writeOutput } from '../output.js';

interface GenerateCliOptions {
  readonly output?: string;
  readonly format: string;
  readonly direction: string;
  readonly includeVolumes: boolean;
  readonly includeNetworkBoundaries: boolean;
  readonly strict: boolean;
  readonly config?: string;
}

const VALID_FORMATS = new Set<string>(['flowchart', 'c4', 'architecture']);
const VALID_DIRECTIONS = new Set<string>(['LR', 'TB', 'BT', 'RL']);

/**
 * Build and return the `generate` subcommand without registering it.
 * Kept as a factory so it can be unit-tested in isolation.
 */
export function buildGenerateCommand(): Command {
  const cmd = new Command('generate');

  cmd
    .description('Convert a docker-compose file to a Mermaid diagram')
    .argument('[file]', 'Path to docker-compose.yml (auto-discovered if omitted)')
    .option('-o, --output <file>', 'Write output to file (default: stdout)')
    .option('-f, --format <type>', 'Diagram format: flowchart|c4', 'flowchart')
    .option('-d, --direction <dir>', 'Direction: LR|TB|BT|RL', 'LR')
    .option('--include-volumes', 'Include volume nodes', false)
    .option('--include-network-boundaries', 'Include network subgraphs', false)
    .option('--strict', 'Exit 2 on warnings (treat warnings as errors)', false)
    .option('--config <path>', 'Path to .dc2mermaid.yml config file')
    .action(async (file: string | undefined, opts: GenerateCliOptions) => {
      await runGenerate(file, opts);
    });

  return cmd;
}

async function runGenerate(file: string | undefined, opts: GenerateCliOptions): Promise<void> {
  // ── Input validation ──────────────────────────────────────────────────────

  if (!VALID_FORMATS.has(opts.format)) {
    process.stderr.write(
      chalk.red(`error: unknown format '${opts.format}'. Valid values: flowchart, c4\n`),
    );
    process.exit(1);
  }

  if (!VALID_DIRECTIONS.has(opts.direction)) {
    process.stderr.write(
      chalk.red(`error: unknown direction '${opts.direction}'. Valid values: LR, TB, BT, RL\n`),
    );
    process.exit(1);
  }

  // ── Resolve the config dir for auto-discovery ─────────────────────────────
  // When a file is given, search for config beside it; otherwise use cwd.
  const configSearchDir = file ? dirname(resolve(file)) : process.cwd();

  // ── Load .dc2mermaid.yml config (may be absent — that's fine) ────────────
  const configResult = await loadConfig(configSearchDir, opts.config);

  if (!configResult.ok) {
    process.stderr.write(chalk.red(formatDiagnostics([configResult.error])) + '\n');
    process.exit(1);
  }

  // ── Merge config file + CLI flags into final RenderOptions ────────────────
  const renderOptions = mergeOptions(configResult.value, {
    type: opts.format as DiagramType,
    direction: opts.direction as DiagramDirection,
    ...(opts.includeVolumes ? { includeVolumes: true } : {}),
    ...(opts.includeNetworkBoundaries ? { includeNetworkBoundaries: true } : {}),
  });

  // ── Resolve the files array passed to generate() ─────────────────────────
  // When no file is provided we pass an empty array; the core pipeline
  // performs auto-discovery (docker-compose.yml / docker-compose.yaml).
  const files = file !== undefined ? [resolve(file)] : [];

  // ── Run the pipeline ──────────────────────────────────────────────────────
  let diagram: string;
  try {
    diagram = await generate({
      files,
      render: renderOptions,
      ...(opts.config !== undefined ? { configPath: opts.config } : {}),
      strict: opts.strict,
      verbose: false,
    });
  } catch (thrown: unknown) {
    // The pipeline stages currently throw for unimplemented features.
    // Normalise any thrown value into a diagnostic so we always exit cleanly.
    const message = thrown instanceof Error ? thrown.message : String(thrown);

    const diagnostic = {
      code: 'E001' as const,
      message,
    };

    process.stderr.write(chalk.red(formatDiagnostics([diagnostic])) + '\n');
    process.exit(getExitCode([diagnostic], opts.strict));
  }

  // ── Write output ──────────────────────────────────────────────────────────
  const writeResult = writeOutput(diagram, opts.output);
  if (!writeResult.ok) {
    process.stderr.write(chalk.red(formatDiagnostics([writeResult.error])) + '\n');
    process.exit(1);
  }

  process.exit(EXIT_SUCCESS);
}
