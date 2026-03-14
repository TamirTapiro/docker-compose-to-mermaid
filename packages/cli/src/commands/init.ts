import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { EXIT_SUCCESS, EXIT_ERROR } from '@dc2mermaid/core';

const CONFIG_FILENAME = '.dc2mermaid.yml';

const STARTER_CONFIG = `# dc2mermaid configuration
# See: https://github.com/TamirTapiro/docker-compose-to-mermaid

format: flowchart        # flowchart | c4 | architecture
direction: LR            # LR | TB | BT | RL
includeVolumes: false
includeNetworkBoundaries: false
strict: false

# Service display overrides
# overrides:
#   myservice:
#     label: "My Service"
#     shape: database

# Manual edges (supplement inferred relationships)
# edges:
#   - from: serviceA
#     to: serviceB
#     label: "custom relationship"
`;

interface InitCliOptions {
  readonly force: boolean;
}

/**
 * Build and return the `init` subcommand without registering it.
 * Kept as a factory so it can be unit-tested in isolation.
 */
export function buildInitCommand(): Command {
  const cmd = new Command('init');

  cmd
    .description('Create a .dc2mermaid.yml config file in the target directory')
    .argument('[dir]', 'Target directory (defaults to current directory)')
    .option('--force', 'Overwrite an existing config file', false)
    .action(async (dir: string | undefined, opts: InitCliOptions) => {
      await runInit(dir, opts);
    });

  return cmd;
}

async function runInit(dir: string | undefined, opts: InitCliOptions): Promise<void> {
  const targetDir = dir ?? process.cwd();
  const configPath = join(targetDir, CONFIG_FILENAME);

  // Check whether the file already exists
  const exists = await fileExists(configPath);

  if (exists && !opts.force) {
    process.stderr.write(
      chalk.red(
        `error: ${CONFIG_FILENAME} already exists in ${targetDir}\n` +
          `  Use --force to overwrite.\n`,
      ),
    );
    process.exit(EXIT_ERROR);
  }

  try {
    await writeFile(configPath, STARTER_CONFIG, 'utf-8');
  } catch (thrown: unknown) {
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    process.stderr.write(chalk.red(`error: could not write ${CONFIG_FILENAME}: ${message}\n`));
    process.exit(EXIT_ERROR);
  }

  process.stdout.write(chalk.green(`Created ${CONFIG_FILENAME} in ${targetDir}`) + '\n');
  process.exit(EXIT_SUCCESS);
}

/**
 * Returns true if the path exists (regardless of type), false otherwise.
 * Never throws — access() errors are treated as "not found".
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
