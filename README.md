# USQL MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`usql-mcp` is a **full-featured MCP server** that bridges the [Model Context Protocol](https://modelcontextprotocol.io/) with the [usql](https://github.com/xo/usql) universal SQL CLI. It enables AI assistants and other MCP clients to query **any database** that usql supports, with enterprise-ready features like background execution, progress tracking, query safety validation, and intelligent caching.

## ✨ Key Features

- **🔌 Universal Database Access**: Query PostgreSQL, MySQL, Oracle, SQLite, SQL Server, and [100+ other databases](https://github.com/xo/usql#database-support) through a single interface
- **⚡ Background Execution**: Long-running queries automatically move to background with job tracking and polling
- **📊 Progress Reporting**: Real-time progress updates for long operations using MCP progress notifications
- **🛡️ Query Safety**: Automatic risk analysis detects dangerous operations (DROP, DELETE without WHERE, etc.)
- **📚 SQL Workflow Templates**: Built-in prompts for common tasks (query optimization, data profiling, migrations)
- **🗂️ Schema Resources**: Browse database schemas through MCP resources (databases, tables, columns)
- **⚡ Performance**: Schema caching and rate limiting for production deployments
- **🔒 Security**: Credential sanitization, configurable operation blocking, audit-ready error messages

## MCP Capabilities

This server implements **all 4 MCP capabilities**:

1. **Tools** (8 tools): Execute queries, manage schemas, check job status
2. **Resources**: Browse database metadata via `sql://` URIs
3. **Prompts**: SQL workflow templates for common tasks
4. **Progress**: Real-time progress for long-running operations

## Requirements

- Node.js 16 or newer
- `npm`
- [`usql`](https://github.com/xo/usql) installed and available on `PATH`

## Quick Launch with npx

Run the server directly via npx:

```bash
npx usql-mcp
```

This downloads the package and executes the CLI entry point, which runs the MCP server on stdio.

You can also run it directly from the repository using npm's Git support (the `prepare` script compiles the TypeScript automatically):

```bash
npx github:jvm/usql-mcp
```

## Getting Started

```bash
git clone https://github.com/jvm/usql-mcp.git
cd usql-mcp
npm install
npm run build
```

The compiled files live in `dist/`. They are intentionally not committed—run `npm run build` whenever you need fresh output.

## Configuring Connections

Define connection strings via environment variables (`USQL_*`) or a `config.json` file mirroring `config.example.json`. Each `USQL_<NAME>=...` entry becomes a reusable connection whose name is the lower-cased `<name>` portion (`USQL_ORACLE1` → `oracle1`).

### Environment Variables

**Connection variables** (any `USQL_*` except reserved keys below):
```bash
export USQL_POSTGRES="postgres://user:password@localhost:5432/mydb"
export USQL_SQLITE="sqlite:///$(pwd)/data/app.db"
export USQL_ORACLE1="oracle://user:secret@host1:1521/service"
```

**Reserved configuration variables**:
- `USQL_CONFIG_PATH` - Path to config.json
- `USQL_QUERY_TIMEOUT_MS` - Default query timeout (leave unset for unlimited)
- `USQL_DEFAULT_CONNECTION` - Default connection name when omitted from tool calls
- `USQL_BINARY_PATH` - Full path to usql binary (if not on PATH)
- `USQL_BACKGROUND_THRESHOLD_MS` - Threshold for background execution (default: 30000)
- `USQL_JOB_RESULT_TTL_MS` - How long to keep completed job results (default: 3600000 = 1 hour)

### Configuration File

Create a `config.json` with connection details and server settings:

```json
{
  "connections": {
    "postgres": {
      "uri": "postgres://user:password@localhost:5432/mydb",
      "description": "Production PostgreSQL database"
    },
    "sqlite": {
      "uri": "sqlite:///path/to/database.db",
      "description": "Local SQLite database"
    }
  },
  "defaults": {
    "defaultConnection": "postgres",
    "queryTimeout": null,
    "backgroundThresholdMs": 30000,
    "jobResultTtlMs": 3600000,
    "allowDestructiveOperations": true,
    "blockHighRiskQueries": false,
    "blockCriticalRiskQueries": false,
    "requireWhereClauseForDelete": false,
    "maxResultBytes": 10485760,
    "rateLimitRpm": null,
    "maxConcurrentRequests": 10,
    "schemaCacheTtl": null
  }
}
```

**Configuration Options**:
- `queryTimeout`: Milliseconds before query times out (null = unlimited)
- `backgroundThresholdMs`: Queries exceeding this move to background (default: 30000)
- `jobResultTtlMs`: How long to retain completed job results (default: 3600000)
- `allowDestructiveOperations`: If false, block DROP/TRUNCATE operations
- `blockHighRiskQueries`: Block queries with risk level "high"
- `blockCriticalRiskQueries`: Block queries with risk level "critical"
- `requireWhereClauseForDelete`: Require WHERE clause on DELETE/UPDATE
- `maxResultBytes`: Maximum result size in bytes (default: 10MB)
- `rateLimitRpm`: Requests per minute limit (null = no limit)
- `schemaCacheTtl`: Schema cache TTL in milliseconds (null = no caching)

## Client Configuration

This section explains how to configure the usql-mcp server in different MCP clients.

### Claude Desktop

Claude Desktop uses a configuration file to register MCP servers. The location depends on your operating system:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "usql": {
      "command": "npx",
      "args": ["-y", "usql-mcp"],
      "env": {
        "USQL_DEFAULT_CONNECTION": "oracle://user:secret@host:1521/service",
        "USQL_POSTGRES": "postgres://user:password@localhost:5432/mydb",
        "USQL_SQLITE": "sqlite:///path/to/database.db"
      }
    }
  }
}
```

After editing the configuration file, restart Claude Desktop for changes to take effect.

### Claude Code

Claude Code (CLI) supports MCP servers through its configuration file located at:

- **All platforms**: `~/.clauderc` or `~/.config/claude/config.json`

Add the MCP server to your Claude Code configuration:

```json
{
  "mcpServers": {
    "usql": {
      "command": "npx",
      "args": ["-y", "usql-mcp"],
      "env": {
        "USQL_DEFAULT_CONNECTION": "oracle://user:secret@host:1521/service",
        "USQL_POSTGRES": "postgres://user:password@localhost:5432/mydb",
        "USQL_SQLITE": "sqlite:///path/to/database.db"
      }
    }
  }
}
```

The server will be available in your Claude Code sessions automatically.

### Codex CLI

Codex CLI configuration varies by implementation, but typically uses a similar JSON configuration approach. Create or edit your Codex configuration file (usually `~/.codexrc` or as specified in your Codex documentation):

```json
{
  "mcp": {
    "servers": {
      "usql": {
        "command": "npx",
        "args": ["-y", "usql-mcp"],
        "env": {
          "USQL_DEFAULT_CONNECTION": "oracle://user:secret@host:1521/service",
          "USQL_POSTGRES": "postgres://user:password@localhost:5432/mydb",
          "USQL_SQLITE": "sqlite:///path/to/database.db"
        }
      }
    }
  }
}
```

Refer to your specific Codex CLI documentation for the exact configuration file location and format.

### GitHub Copilot (VS Code)

GitHub Copilot in VS Code can use MCP servers through the Copilot Chat extension settings. Configuration is done through VS Code's `settings.json`:

1. Open VS Code Settings (JSON) via:
   - **macOS**: `Cmd + Shift + P` → "Preferences: Open User Settings (JSON)"
   - **Windows/Linux**: `Ctrl + Shift + P` → "Preferences: Open User Settings (JSON)"

2. Add the MCP server configuration:

```json
{
  "github.copilot.chat.mcp.servers": {
    "usql": {
      "command": "npx",
      "args": ["-y", "usql-mcp"],
      "env": {
        "USQL_DEFAULT_CONNECTION": "oracle://user:secret@host:1521/service",
        "USQL_POSTGRES": "postgres://user:password@localhost:5432/mydb",
        "USQL_SQLITE": "sqlite:///path/to/database.db"
      }
    }
  }
}
```

After saving the settings, reload VS Code or restart the Copilot extension for changes to take effect.

### Environment Variables vs. Configuration

For all clients, you can choose between:

1. **Inline environment variables** (shown above) - Connection strings in the config file
2. **System environment variables** - Set `USQL_*` variables in your shell profile

**System environment approach**:

```bash
# In ~/.bashrc, ~/.zshrc, or equivalent
export USQL_DEFAULT_CONNECTION="oracle://user:secret@host:1521/service"
export USQL_POSTGRES="postgres://user:password@localhost:5432/mydb"
export USQL_SQLITE="sqlite:///path/to/database.db"
```

Then use a simpler client configuration:

```json
{
  "mcpServers": {
    "usql": {
      "command": "npx",
      "args": ["-y", "usql-mcp"]
    }
  }
}
```

### Security Best Practices

- **Avoid hardcoding credentials**: Use environment variables or secure credential stores
- **File permissions**: Ensure configuration files with credentials are not world-readable (chmod 600)
- **Read-only access**: Create database users with minimal required permissions for AI queries
- **Network security**: Use SSL/TLS connections for remote databases
- **Audit logging**: Enable database audit logs to track AI-generated queries
- **Query safety**: Enable `blockCriticalRiskQueries` to prevent destructive operations
- **Rate limiting**: Set `rateLimitRpm` to prevent abuse in multi-user environments

## Tools Catalogue

### Core SQL Tools

| Tool             | Purpose                                | Key Inputs                                                                           |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| `execute_query`  | Run an arbitrary SQL statement         | `connection_string`, `query`, optional `output_format` (`json`\|`csv`), `timeout_ms` |
| `execute_script` | Execute a multi-statement script       | `connection_string`, `script`, optional `output_format`, `timeout_ms`                |
| `list_databases` | List databases available on the server | `connection_string`, optional `output_format`, `timeout_ms`                          |
| `list_tables`    | List tables in the current database    | `connection_string`, optional `output_format`, `timeout_ms`                          |
| `describe_table` | Inspect table metadata via `\d`        | `connection_string`, `table`, optional `output_format`, `timeout_ms`                 |

### Background Job Management

| Tool              | Purpose                                 | Key Inputs                                    |
| ----------------- | --------------------------------------- | --------------------------------------------- |
| `get_job_status`  | Check status of a background job        | `job_id`, `wait_seconds` (1-55)               |
| `cancel_job`      | Cancel a running background job         | `job_id`                                      |

### Server Information

| Tool              | Purpose                                 | Key Inputs                                    |
| ----------------- | --------------------------------------- | --------------------------------------------- |
| `get_server_info` | Get server configuration and stats      | None (read-only)                              |

## Resources

Access database metadata through MCP resources:

- `sql://connections` - List all available connections
- `sql://{connection}/databases` - List databases on a connection
- `sql://{connection}/{database}/tables` - List tables in a database
- `sql://{connection}/{database}/table/{name}` - Get detailed table schema

**Example usage**:
```
Read resource: sql://postgres/production/tables
Read resource: sql://postgres/production/table/users
```

## Prompts

Built-in SQL workflow templates:

1. **analyze_performance** - Analyze query performance and suggest optimizations
2. **profile_data_quality** - Profile data quality (nulls, duplicates, distributions)
3. **generate_migration** - Generate database migration scripts
4. **explain_schema** - Create comprehensive schema documentation
5. **optimize_query** - Optimize a slow-running query
6. **debug_slow_query** - Systematically debug slow queries

**Example usage**:
```
Use prompt: analyze_performance
  connection: postgres
  query: SELECT * FROM large_table WHERE status = 'active'
```

## Background Execution

Queries that exceed the `backgroundThresholdMs` (default: 30 seconds) automatically move to background execution:

1. **Initial Response**: Tool returns a `job_id` and status message
2. **Polling**: Use `get_job_status` with `wait_seconds` to check progress
3. **Results**: When complete, `get_job_status` returns the full result
4. **Progress**: Real-time progress percentage (0-100) for running jobs
5. **Cleanup**: Jobs are automatically cleaned up after `jobResultTtlMs` (default: 1 hour)

**Example workflow**:
```jsonc
// Initial query (takes >30s)
execute_query → {
  "status": "background",
  "job_id": "abc-123",
  "message": "Query is taking longer than 30000ms. Use get_job_status to check progress.",
  "started_at": "2025-01-15T10:30:00Z"
}

// Check status (waits up to 10s)
get_job_status(job_id: "abc-123", wait_seconds: 10) → {
  "status": "running",
  "job_id": "abc-123",
  "progress": 45,  // 45% complete
  "elapsed_ms": 15000
}

// Eventually completes
get_job_status(job_id: "abc-123", wait_seconds: 10) → {
  "status": "completed",
  "job_id": "abc-123",
  "result": { "format": "json", "content": "[...]" },
  "elapsed_ms": 45000
}
```

## Query Safety Analysis

Every query is automatically analyzed for safety risks:

**Risk Levels**:
- **Low**: Safe read-only queries
- **Medium**: Modifying operations with WHERE clauses
- **High**: Complex queries with many JOINs, missing indexes
- **Critical**: Destructive operations (DROP, TRUNCATE, DELETE without WHERE)

**Response includes analysis**:
```jsonc
{
  "format": "json",
  "content": "[...]",
  "safety_analysis": {
    "risk_level": "critical",
    "warnings": ["DELETE operation without WHERE clause"],
    "dangerous_operations": ["DELETE"],
    "complexity_score": 2,
    "recommendations": ["Add WHERE clause to limit deletion scope"]
  }
}
```

**Configuration options**:
- `allowDestructiveOperations: false` - Block all destructive operations
- `blockHighRiskQueries: true` - Block queries with "high" risk
- `blockCriticalRiskQueries: true` - Block queries with "critical" risk
- `requireWhereClauseForDelete: true` - Require WHERE on DELETE/UPDATE

## Response Format

Successful calls return the exact stdout produced by `usql`, paired with the format indicator:

```jsonc
{
  "format": "json", // or "csv"
  "content": "[{\"id\":1,\"name\":\"Alice\"}]",
  "elapsed_ms": 234,
  "safety_analysis": {
    "risk_level": "low",
    "warnings": [],
    "dangerous_operations": [],
    "complexity_score": 1,
    "recommendations": []
  }
}
```

Background job responses:

```jsonc
{
  "status": "background",
  "job_id": "uuid-string",
  "message": "Query is taking longer than 30000ms. It will continue running in the background.",
  "started_at": "2025-01-15T10:30:00.000Z",
  "elapsed_ms": 30001
}
```

If `usql` exits with a non-zero code, the handler forwards the message through the MCP error shape, keeping details like the sanitized connection string and original stderr.

## Performance Features

### Schema Caching

Enable caching to reduce subprocess overhead for metadata queries:

```json
{
  "defaults": {
    "schemaCacheTtl": 300000  // 5 minutes
  }
}
```

Cached operations:
- `list_databases`
- `list_tables`
- `describe_table`
- Resource reads

Cache statistics available via `get_server_info`:
```jsonc
{
  "schema_cache_stats": {
    "hits": 42,
    "misses": 8,
    "size": 15,
    "hit_rate": 0.840
  }
}
```

### Rate Limiting

Protect your databases from abuse:

```json
{
  "defaults": {
    "rateLimitRpm": 60,  // 60 requests per minute
    "maxConcurrentRequests": 10
  }
}
```

When limit exceeded:
```jsonc
{
  "error": "RateLimitExceeded",
  "message": "Rate limit exceeded: 60 requests per minute. Try again in 45 seconds.",
  "details": {
    "limit": 60,
    "current": 60,
    "resetInSeconds": 45
  }
}
```

## Development

- `npm run dev` – TypeScript compile in watch mode
- `npm run build` – emit ESM output to `dist/`
- `npm run lint` – ESLint/Prettier rules
- `npm run test` – Jest unit tests (519 tests, comprehensive coverage)
- `npm run type-check` – strict `tsc --noEmit`

Debug logging follows the namespace in `DEBUG=usql-mcp:*`.

### Architecture

See [`CLAUDE.md`](./CLAUDE.md) for coding agents guidelines and architecture documentation.

**Key components**:
- **Tools** (`src/tools/`) - MCP tool implementations
- **Resources** (`src/resources/`) - MCP resource handlers
- **Prompts** (`src/prompts/`) - SQL workflow templates
- **Background Jobs** (`src/usql/job-manager.ts`) - Async execution tracking
- **Query Safety** (`src/utils/query-safety-analyzer.ts`) - Risk analysis
- **Caching** (`src/cache/schema-cache.ts`) - Performance optimization
- **Progress** (`src/notifications/progress-notifier.ts`) - Real-time updates

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- execute-query.test.ts

# Run with coverage
npm test -- --coverage

# Integration tests (require usql installed)
npm test -- integration
```

**Test coverage**:
- 519 passing tests
- Unit tests for all tools, utilities, and managers
- Integration tests with real SQLite databases
- Request tracking, pagination, and protocol compliance tests

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for contributor guidelines and [`CLAUDE.md`](./CLAUDE.md) for coding agents guidelines. Open an issue before large changes so we can keep the tooling lean and aligned with the MCP ecosystem.

## License

MIT License - see [`LICENSE`](./LICENSE) for details.

## Credits

Built on top of the excellent [usql](https://github.com/xo/usql) universal database CLI by Kenneth Shaw and the [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic.
