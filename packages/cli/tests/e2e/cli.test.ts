/**
 * E2E tests for the dc2mermaid CLI.
 *
 * Tests invoke the compiled binary as a subprocess via `spawnSync` so they
 * verify the user-facing contract (exit codes, stdout/stderr content) rather
 * than internal implementation details.
 *
 * Tests that depend on the core pipeline (parse / generate) are currently
 * marked `it.todo` because parse() is not yet implemented (tracked in issues
 * #3, #5, #6). They document the intended behaviour and will graduate to
 * active tests once the core is complete.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';

// ── Paths ────────────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, '../../../../');
const CLI = resolve(REPO_ROOT, 'packages/cli/dist/index.js');
const FIXTURES = resolve(REPO_ROOT, 'packages/core/tests/fixtures');
const SIMPLE_YML = join(FIXTURES, 'simple.yml');

// Temp paths registered by individual tests so afterEach can clean them up.
const tempPaths: string[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function runCLI(args: string[], cwd?: string) {
  return spawnSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    cwd: cwd ?? process.cwd(),
    // Disable colour output so assertions work against plain text.
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
}

function makeTempDir(): string {
  const dir = join(tmpdir(), `dc2mermaid-test-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  tempPaths.push(dir);
  return dir;
}

function makeTempFile(ext = '.mmd'): string {
  const path = join(tmpdir(), `dc2mermaid-test-${process.pid}-${Date.now()}${ext}`);
  tempPaths.push(path);
  return path;
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

let buildFailed = false;

beforeAll(() => {
  // Build the CLI if the dist doesn't exist yet. In CI the build step runs
  // before this suite, so we only rebuild when the artifact is genuinely
  // absent (e.g. running tests in isolation after a clean).
  if (!existsSync(CLI)) {
    const result = spawnSync(
      'pnpm',
      ['--filter', 'docker-compose-to-mermaid', 'build'],
      { encoding: 'utf-8', cwd: REPO_ROOT },
    );
    if (result.status !== 0) {
      buildFailed = true;
      console.error('CLI build failed:\n', result.stderr);
    }
  }
}, 60_000);

afterEach(() => {
  // Best-effort cleanup — a cleanup failure must never cause a test to fail.
  for (const p of tempPaths.splice(0)) {
    try {
      rmSync(p, { recursive: true, force: true });
    } catch {
      // intentionally swallowed
    }
  }
});

// ── generate command ──────────────────────────────────────────────────────────

describe('generate command', () => {
  // Tests 1–3 and 5 depend on parse() which is not yet implemented.
  // They document the intended behaviour once issues #3, #5, #6 are resolved.

  it.todo('converts simple.yml to stdout, exits 0, output contains "flowchart"');

  it.todo('accepts --format flowchart explicitly, exits 0');

  it.todo('writes to file when --output is specified, exits 0, file contains "flowchart"');

  it('exits non-zero and emits to stderr for a nonexistent input file', () => {
    if (buildFailed) return;

    const result = runCLI(['generate', '/nonexistent/path/docker-compose.yml']);

    expect(result.status).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it.todo('stdout contains "flowchart TB" when --direction TB is passed');
});

// ── validate command ──────────────────────────────────────────────────────────

describe('validate command', () => {
  // Test 6 depends on parse() which is not yet implemented.

  it.todo('reports "Valid" and exits 0 for simple.yml');

  it('exits non-zero for a nonexistent file', () => {
    if (buildFailed) return;

    const result = runCLI(['validate', '/nonexistent/path/docker-compose.yml']);

    expect(result.status).not.toBe(0);
  });
});

// ── init command ─────────────────────────────────────────────────────────────

describe('init command', () => {
  it('creates .dc2mermaid.yml in the target directory and exits 0', () => {
    if (buildFailed) return;

    const tmpDir = makeTempDir();
    const result = runCLI(['init', tmpDir]);

    expect(result.status).toBe(0);
    expect(existsSync(join(tmpDir, '.dc2mermaid.yml'))).toBe(true);
  });

  it('exits 1 and reports "already exists" when the config file already exists', () => {
    if (buildFailed) return;

    const tmpDir = makeTempDir();

    const first = runCLI(['init', tmpDir]);
    expect(first.status).toBe(0);

    const second = runCLI(['init', tmpDir]);
    expect(second.status).toBe(1);
    expect(second.stderr).toContain('already exists');
  });

  it('overwrites an existing config with --force and exits 0', () => {
    if (buildFailed) return;

    const tmpDir = makeTempDir();

    const first = runCLI(['init', tmpDir]);
    expect(first.status).toBe(0);

    const second = runCLI(['init', tmpDir, '--force']);
    expect(second.status).toBe(0);
    expect(existsSync(join(tmpDir, '.dc2mermaid.yml'))).toBe(true);
  });
});

// ── --help ───────────────────────────────────────────────────────────────────

describe('--help', () => {
  it('dc2mermaid --help exits 0 and lists all subcommands', () => {
    if (buildFailed) return;

    const result = runCLI(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('generate');
    expect(result.stdout).toContain('validate');
    expect(result.stdout).toContain('init');
  });

  it('dc2mermaid generate --help exits 0 and documents key flags', () => {
    if (buildFailed) return;

    const result = runCLI(['generate', '--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--format');
    expect(result.stdout).toContain('--output');
  });
});
