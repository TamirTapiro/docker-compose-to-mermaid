# Contributing Guide

We welcome contributions from everyone! This guide explains how to set up your development environment, run tests, and submit pull requests.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Running Tests](#running-tests)
- [Code Standards](#code-standards)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)

## Prerequisites

Before getting started, ensure you have:

- **Node.js 18+** — Check your version with `node --version`
- **pnpm 9+** — Install with `npm install -g pnpm` if needed
- **Git** — For version control
- Basic TypeScript knowledge (not required but helpful)

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/TamirTapiro/docker-compose-to-mermaid.git
cd docker-compose-to-mermaid
```

### 2. Install Dependencies

```bash
pnpm install
```

This installs all dependencies for the monorepo including the core package, CLI, VS Code extension, and GitHub Action.

### 3. Build the Project

```bash
pnpm build
```

This builds all packages in the monorepo using TypeScript and tsup.

### 4. Run Tests

```bash
pnpm test
```

This runs the test suite using Vitest to verify your setup is working correctly.

## Project Structure

The project is organized as a monorepo using pnpm workspaces:

```
docker-compose-to-mermaid/
├── packages/
│   ├── core/                    # Main package - diagram generation logic
│   │   ├── src/
│   │   │   ├── types/           # TypeScript type definitions
│   │   │   ├── parser/          # Docker Compose YAML parsing
│   │   │   ├── graph/           # Dependency graph construction
│   │   │   ├── renderers/       # Mermaid diagram rendering
│   │   │   └── index.ts         # Main entry point
│   │   ├── tests/
│   │   │   ├── fixtures/        # Test docker-compose files
│   │   │   └── *.test.ts        # Test files
│   │   └── package.json
│   ├── cli/                     # Command-line interface
│   │   ├── src/
│   │   │   ├── commands/        # CLI command implementations
│   │   │   └── index.ts         # CLI entry point
│   │   └── package.json
│   ├── vscode/                  # VS Code extension
│   └── action/                  # GitHub Action
├── package.json                 # Monorepo root
├── pnpm-workspace.yaml          # pnpm workspace configuration
└── tsconfig.json                # TypeScript configuration
```

### Key Packages

- **@dc2mermaid/core** — Core diagram generation engine (no external dependencies)
- **@dc2mermaid/cli** — Command-line tool (uses core package)
- **@dc2mermaid/vscode** — VS Code extension
- **@dc2mermaid/action** — GitHub Actions integration

## Running Tests

### Run All Tests

Test all packages in the monorepo:

```bash
pnpm test
```

### Test Specific Package

Test only the core package:

```bash
pnpm --filter @dc2mermaid/core test
```

### Update Snapshots

When diagram output legitimately changes, update test snapshots:

```bash
pnpm --filter @dc2mermaid/core exec vitest --update
```

### Run Tests in Watch Mode

For development, run tests in watch mode:

```bash
pnpm test:watch
```

### Test Coverage

Generate a coverage report:

```bash
pnpm --filter @dc2mermaid/core exec vitest --coverage
```

## Code Standards

### TypeScript

- **Strict mode required** — Enable `"strict": true` in tsconfig.json
- **No `any` types** — Use specific types; add `@ts-ignore` comment if unavoidable
- **Export types explicitly** — Make all public APIs type-safe

Example:

```typescript
// Good
export function parseCompose(yaml: string): ComposeFile {
  // ...
}

// Bad - avoid any
export function parseCompose(yaml: any): any {
  // ...
}
```

### Naming Conventions

- **Classes** — PascalCase: `ComposeParser`
- **Functions** — camelCase: `parseCompose()`
- **Constants** — UPPER_SNAKE_CASE: `DEFAULT_FORMAT`
- **Private methods** — Leading underscore: `_parseService()`

### Linting and Formatting

Check code quality:

```bash
pnpm lint
```

Format code (requires manual review):

```bash
pnpm lint --fix
```

Run Prettier for formatting:

```bash
prettier --write 'packages/*/src/**/*.ts'
```

Note: Linting and formatting are enforced via Husky git hooks on commit.

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are validated by commitlint via Husky pre-commit hooks.

### Commit Message Format

```
type(scope): subject

body

footer
```

### Types

- **feat** — A new feature
- **fix** — A bug fix
- **docs** — Documentation changes
- **style** — Code style changes (formatting, missing semicolons, etc.)
- **refactor** — Code refactoring without feature changes
- **perf** — Performance improvements
- **test** — Test additions or updates
- **chore** — Build process, dependency updates, etc.

### Scope

Optional but recommended. Use the package name:

- `core`
- `cli`
- `vscode`
- `action`

### Examples

```
feat(core): add support for volume dependencies

- Parse volume relationships in compose files
- Include volume nodes in generated diagrams
- Add includeVolumes option to render options

Fixes #123
```

```
fix(cli): handle missing docker-compose files gracefully

Display helpful error message when file is not found.

Fixes #456
```

```
docs: update getting started guide

Add examples for C4 diagram format.
```

## Pull Request Process

### Before Submitting a PR

1. **Create a feature branch**

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** and commit with proper messages

3. **Run all checks locally**

   ```bash
   pnpm build
   pnpm test
   pnpm lint
   ```

4. **Verify the CLI works**

   ```bash
   pnpm --filter @dc2mermaid/cli exec npm link
   dc2mermaid generate --help
   npm unlink
   ```

5. **Rebase against main**

   ```bash
   git fetch origin
   git rebase origin/main
   ```

### Submitting Your PR

1. Push your branch to your fork
2. Create a pull request against the `main` branch
3. Fill in the PR template with:
   - **Description** — What does this change do?
   - **Motivation** — Why is this change needed?
   - **Testing** — How was this tested?
   - **Checklist** — Mark items as complete

### CI Requirements

Your PR must pass:

- **Tests** — `pnpm test` must pass for all packages
- **Linting** — `pnpm lint` must pass
- **TypeScript** — `pnpm typecheck` must pass
- **Build** — `pnpm build` must succeed

GitHub Actions will automatically check these. All checks must pass before merging.

### Code Review

- At least one approval is required from maintainers
- We may request changes or improvements
- Feedback is meant to be helpful, not critical

### After Merge

Once your PR is merged:

- Your changes will be included in the next release
- You'll be credited in the CHANGELOG
- Consider opening a discussion if you want to write a blog post about your contribution

## Running the CLI Locally

During development, test your changes with the CLI:

```bash
# Link the CLI globally for testing
pnpm --filter @dc2mermaid/cli exec npm link

# Test the generate command
dc2mermaid generate /path/to/docker-compose.yml

# Unlink when done
npm unlink docker-compose-to-mermaid -g
```

## Getting Help

- **Questions?** — Open a GitHub Discussion
- **Found a bug?** — Open a GitHub Issue with a minimal example
- **Need guidance?** — Tag a maintainer in your PR

We're here to help!

## Thank You

Thank you for contributing to docker-compose-to-mermaid. Your time and effort help make this project better for everyone.
