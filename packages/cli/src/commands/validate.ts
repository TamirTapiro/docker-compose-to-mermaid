import { resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { parse, formatDiagnostic, getExitCode, EXIT_SUCCESS } from '@dc2mermaid/core';
import type { Diagnostic } from '@dc2mermaid/core';

interface ValidateCliOptions {
  readonly strict: boolean;
}

/**
 * Build and return the `validate` subcommand without registering it.
 * Kept as a factory so it can be unit-tested in isolation.
 */
export function buildValidateCommand(): Command {
  const cmd = new Command('validate');

  cmd
    .description('Validate a docker-compose.yml file against the Compose spec')
    .argument('[file]', 'Path to docker-compose.yml (auto-discovered if omitted)')
    .option('--strict', 'Exit 2 on warnings (treat warnings as errors)', false)
    .action(async (file: string | undefined, opts: ValidateCliOptions) => {
      await runValidate(file, opts);
    });

  return cmd;
}

async function runValidate(file: string | undefined, opts: ValidateCliOptions): Promise<void> {
  const files = file !== undefined ? [resolve(file)] : [];

  let diagnostics: Diagnostic[] = [];

  try {
    await parse(files);
    // parse() succeeded with no diagnostics
  } catch (thrown: unknown) {
    // Normalise any thrown value into a Diagnostic so we always exit cleanly.
    // Once parse() is fully implemented it will return a Result; until then
    // unimplemented-feature errors surface as thrown exceptions.
    const message = thrown instanceof Error ? thrown.message : String(thrown);

    diagnostics = [
      {
        code: 'E001' as const,
        message,
      },
    ];
  }

  if (diagnostics.length === 0) {
    process.stdout.write(chalk.green('Valid') + '\n');
    process.exit(EXIT_SUCCESS);
  }

  for (const d of diagnostics) {
    const formatted = formatDiagnostic(d);
    const isError = d.code.startsWith('E');
    process.stderr.write((isError ? chalk.red(formatted) : chalk.yellow(formatted)) + '\n\n');
  }

  process.exit(getExitCode(diagnostics, opts.strict));
}
