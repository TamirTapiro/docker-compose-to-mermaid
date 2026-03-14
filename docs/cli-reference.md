# CLI Reference

Complete reference for docker-compose-to-mermaid command-line tools.

## Installation

### Using npx (no installation required)

```bash
npx docker-compose-to-mermaid generate
```

### Global installation

Install globally to use the `dc2mermaid` command anywhere:

```bash
npm install -g docker-compose-to-mermaid
dc2mermaid generate
```

### As a project dependency

Add to your project's devDependencies:

```bash
npm install --save-dev docker-compose-to-mermaid
npx dc2mermaid generate
```

Or add to `package.json` scripts:

```json
{
  "scripts": {
    "diagram": "dc2mermaid generate",
    "diagram:validate": "dc2mermaid validate"
  }
}
```

## Global Options

All commands support these global options:

| Option      | Type | Description                  |
| ----------- | ---- | ---------------------------- |
| `--help`    | flag | Display help for the command |
| `--version` | flag | Display version number       |

## Commands

### generate

Convert a docker-compose file into a Mermaid diagram.

**Synopsis:**

```bash
dc2mermaid generate [file] [options]
```

**Arguments:**

| Argument | Type   | Default           | Description                                            |
| -------- | ------ | ----------------- | ------------------------------------------------------ |
| `file`   | string | (auto-discovered) | Path to docker-compose.yml or docker-compose.yaml file |

**Options:**

| Flag                           | Type    | Default           | Description                                                                                   |
| ------------------------------ | ------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `-o, --output <file>`          | string  | stdout            | Write diagram to file instead of printing to console                                          |
| `-f, --format <type>`          | string  | `flowchart`       | Diagram format: `flowchart`, `c4`, or `architecture`                                          |
| `-d, --direction <dir>`        | string  | `LR`              | Diagram direction: `LR` (left-right), `TB` (top-bottom), `BT` (bottom-top), `RL` (right-left) |
| `--include-volumes`            | boolean | false             | Include volume nodes in the diagram                                                           |
| `--include-network-boundaries` | boolean | false             | Include network subgraphs and boundaries                                                      |
| `--strict`                     | boolean | false             | Treat warnings as errors (exit code 2 instead of 0)                                           |
| `--config <path>`              | string  | (auto-discovered) | Path to `.dc2mermaid.yml` configuration file                                                  |

**Examples:**

Generate diagram from the default docker-compose.yml and print to stdout:

```bash
dc2mermaid generate
```

Generate diagram from a specific file and save to a file:

```bash
dc2mermaid generate docker-compose.yml -o architecture.mmd
```

Generate with vertical (top-bottom) layout and include network boundaries:

```bash
dc2mermaid generate --direction TB --include-network-boundaries
```

Generate using C4 diagram format:

```bash
dc2mermaid generate --format c4 --output diagram.mmd
```

Generate in strict mode (exit with code 2 if any warnings are detected):

```bash
dc2mermaid generate --strict
```

**Exit Codes:**

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 0    | Diagram generated successfully                             |
| 1    | Error: invalid input, missing file, or unrecoverable error |
| 2    | Warnings detected and `--strict` flag was enabled          |

**Output Formats:**

- `flowchart` — Standard Mermaid flowchart with services as nodes and dependencies as edges
- `c4` — C4 model diagram suitable for formal architecture documentation
- `architecture` — Specialized architecture diagram with advanced styling (experimental)

---

### validate

Validate a docker-compose file against the Docker Compose specification.

**Synopsis:**

```bash
dc2mermaid validate [file] [options]
```

**Arguments:**

| Argument | Type   | Default           | Description                                            |
| -------- | ------ | ----------------- | ------------------------------------------------------ |
| `file`   | string | (auto-discovered) | Path to docker-compose.yml or docker-compose.yaml file |

**Options:**

| Flag       | Type    | Default | Description                                         |
| ---------- | ------- | ------- | --------------------------------------------------- |
| `--strict` | boolean | false   | Treat warnings as errors (exit code 2 instead of 0) |

**Examples:**

Validate the default docker-compose.yml:

```bash
dc2mermaid validate
```

Validate a specific file:

```bash
dc2mermaid validate docker-compose.production.yml
```

Validate with strict mode (fail on any warnings):

```bash
dc2mermaid validate --strict
```

**Exit Codes:**

| Code | Meaning                                                                   |
| ---- | ------------------------------------------------------------------------- |
| 0    | File is valid                                                             |
| 1    | Validation error: file contains invalid syntax or missing required fields |
| 2    | Warnings detected and `--strict` flag was enabled                         |

**Output:**

- On success: `Valid` (printed to stdout)
- On failure: Diagnostic messages with error codes and descriptions (printed to stderr)

---

### init

Create a `.dc2mermaid.yml` configuration file with sensible defaults.

**Synopsis:**

```bash
dc2mermaid init [dir] [options]
```

**Arguments:**

| Argument | Type   | Default           | Description                                              |
| -------- | ------ | ----------------- | -------------------------------------------------------- |
| `dir`    | string | current directory | Target directory where `.dc2mermaid.yml` will be created |

**Options:**

| Flag      | Type    | Default | Description                               |
| --------- | ------- | ------- | ----------------------------------------- |
| `--force` | boolean | false   | Overwrite existing `.dc2mermaid.yml` file |

**Examples:**

Create a config file in the current directory:

```bash
dc2mermaid init
```

Create a config file in a specific directory:

```bash
dc2mermaid init ./my-project
```

Overwrite an existing config file:

```bash
dc2mermaid init --force
```

**Exit Codes:**

| Code | Meaning                                                                 |
| ---- | ----------------------------------------------------------------------- |
| 0    | Configuration file created successfully                                 |
| 1    | Error: file already exists (use `--force` to overwrite) or write failed |

**Generated Template:**

The command creates a `.dc2mermaid.yml` file with the following structure:

```yaml
# dc2mermaid configuration
# See: https://github.com/TamirTapiro/docker-compose-to-mermaid

format: flowchart # flowchart | c4 | architecture
direction: LR # LR | TB | BT | RL
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
```

---

## Configuration File (.dc2mermaid.yml)

Configure default behavior for diagram generation without repeating command-line flags.

### Schema Reference

```yaml
# Diagram rendering settings
diagram:
  type: flowchart # flowchart | c4 | architecture
  direction: LR # LR | TB | BT | RL
  title: Optional diagram title

# Display options
display:
  volumes: boolean # Include volume nodes
  ports: boolean # Include port mappings
  networks: boolean # Include network boundaries

# Service customization
services:
  <service-name>:
    type: service # service | database | cache | queue | proxy | storage | volume | external
    label: Custom display name

# Manual relationship definitions
edges:
  - from: serviceA
    to: serviceB
    label: Optional edge label
    style: solid # solid | dashed

# Service exclusion
exclude:
  - service1
  - service2

# Color theme customization
theme:
  database: '#336791'
  cache: '#DC382D'
  queue: '#FF6600'
  proxy: '#009639'
  storage: '#569A31'
  service: '#0078D4'
```

### Configuration Precedence

Settings are applied in this order (later values override earlier):

1. **Defaults** — Built-in defaults (all volumes/ports/networks true, format flowchart, direction LR)
2. **Configuration file** (`.dc2mermaid.yml`) — Settings saved in your project
3. **CLI flags** — Command-line arguments take highest precedence

Example with precedence:

```bash
# Defaults: format=flowchart, direction=LR
# Config file: format=c4, direction=TB
# CLI flag: --direction RL

# Result: format=c4 (from config), direction=RL (from CLI)
dc2mermaid generate --direction RL
```

### Example Configuration File

```yaml
# Production-grade architecture documentation

diagram:
  type: c4
  direction: TB
  title: 'Our Microservices Architecture'

display:
  volumes: true
  ports: false
  networks: true

services:
  api:
    type: service
    label: 'API Gateway'

  postgres:
    type: database
    label: 'PostgreSQL'

  redis:
    type: cache
    label: 'Redis Cache'

  workers:
    type: service
    label: 'Background Workers'

edges:
  - from: api
    to: postgres
    label: 'queries'
  - from: workers
    to: postgres
    label: 'updates'

exclude:
  - test-db
  - mock-services

theme:
  database: '#0F1419'
  service: '#1E90FF'
  cache: '#FF6347'
```

### Auto-discovery

The CLI automatically discovers `.dc2mermaid.yml` files in this order:

1. Path specified via `--config` flag
2. Directory containing the docker-compose file
3. Current working directory
4. Parent directories (if not found)

If no config file exists, the CLI uses built-in defaults.

---

## Exit Codes

Standard exit codes used by all commands:

| Code | Meaning                 | Typical Scenario                                                                      |
| ---- | ----------------------- | ------------------------------------------------------------------------------------- |
| 0    | Success                 | Command completed without errors or warnings (or warnings ignored in non-strict mode) |
| 1    | Error                   | File not found, invalid syntax, permission denied, or unrecoverable error             |
| 2    | Warnings in strict mode | Warnings detected and `--strict` flag was enabled                                     |

---

## Environment Variables

Currently, the CLI does not use environment variables for configuration. All settings are provided via:

- Command-line flags
- `.dc2mermaid.yml` configuration file
- Built-in defaults

Future versions may support environment variables for CI/CD pipelines.

---

## File Resolution

### Docker-compose File Auto-discovery

When no `file` argument is provided, the CLI searches in this order:

1. `docker-compose.yml` in current directory
2. `docker-compose.yaml` in current directory
3. `docker-compose.production.yml` in current directory (if exists)

### Configuration File Auto-discovery

When no `--config` flag is provided, the CLI searches in this order:

1. `.dc2mermaid.yml` beside the docker-compose file
2. `.dc2mermaid.yml` in current working directory
3. `.dc2mermaid.yml` in parent directories (up to project root)

---

## Troubleshooting

### "docker-compose.yml not found"

Ensure a docker-compose file exists in your current directory or provide an explicit path:

```bash
dc2mermaid generate ./path/to/docker-compose.yml
```

### "Unknown format" or "Unknown direction"

Check your spelling and ensure you're using valid values:

```bash
# Valid formats: flowchart, c4, architecture
dc2mermaid generate --format flowchart

# Valid directions: LR, TB, BT, RL
dc2mermaid generate --direction TB
```

### Permission denied when writing output

Ensure the output directory exists and is writable:

```bash
mkdir -p docs
dc2mermaid generate -o docs/architecture.mmd
```

### Config file not being loaded

Verify the config file is in the correct location or explicitly specify the path:

```bash
dc2mermaid generate --config ./config/.dc2mermaid.yml
```

---

## See Also

- [Getting Started Guide](getting-started.md) — Quick tutorial for first-time users
- [Configuration Reference](configuration.md) — Detailed config file documentation
- [GitHub Action Documentation](https://github.com/TamirTapiro/docker-compose-to-mermaid#github-action) — Automate diagram generation in CI/CD
- [Node.js API](https://github.com/TamirTapiro/docker-compose-to-mermaid#nodejs-api) — Use as a library in your own tools
