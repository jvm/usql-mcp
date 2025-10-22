# USQL MCP Server

`usql-mcp` bridges the [Model Context Protocol](https://modelcontextprotocol.io/) with the
[usql](https://github.com/xo/usql) CLI so assistants and other MCP clients can run queries against any
database usql supports. The server forwards tool requests directly to `usql` and streams the raw CLI
output back to the caller (JSON by default, CSV on request), keeping behaviour identical to what you would
see on the command line.

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

You can also run it directly from the repository using npm's Git support (the `prepare` script compiles
the TypeScript automatically):

```bash
npx github:jvm/usql-mcp
```

## Getting Started

```bash
git clone https://github.com/yourusername/usql-mcp.git
cd usql-mcp
npm install
npm run build
```

The compiled files live in `dist/`. They are intentionally not committed—run `npm run build` whenever you
need fresh output.

## Configuring Connections

Define connection strings via environment variables (`USQL_*`) or a `config.json` file mirroring
`config.example.json`. Each `USQL_<NAME>=...` entry becomes a reusable connection whose name is the
lower-cased `<name>` portion (`USQL_ORACLE1` → `oracle1`). Reserved keys that **aren’t** treated as
connections are:

- `USQL_CONFIG_PATH`
- `USQL_QUERY_TIMEOUT_MS`
- `USQL_DEFAULT_CONNECTION`
- `USQL_BINARY_PATH`

Examples:

```bash
export USQL_POSTGRES="postgres://user:password@localhost:5432/mydb"
export USQL_SQLITE="sqlite:///$(pwd)/data/app.db"
export USQL_ORACLE1="oracle://user:secret@host1:1521/service"
export USQL_ORACLE2="oracle://user:secret@host2:1521/service"
```

You can also supply a full URI directly in tool requests. `USQL_QUERY_TIMEOUT_MS` controls the default
query timeout; leave it unset (or set `defaults.queryTimeout` to `null`) for unlimited execution and
override it when you need a guard. Individual tool calls can pass `timeout_ms` to override (set to
`null` for unlimited on that call). Set `USQL_DEFAULT_CONNECTION` (or `defaults.defaultConnection` in
`config.json`) to name the connection that should be used automatically when a tool call omits the
`connection_string` field.

If `usql` is not on your `PATH`, set `USQL_BINARY_PATH` to the absolute path of the executable (for
example, `/usr/local/bin/usql`). When unset, the MCP server assumes `usql` is discoverable via the
environment `PATH`.

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
      "args": ["usql-mcp"],
      "env": {
        "USQL_POSTGRES": "postgres://user:password@localhost:5432/mydb",
        "USQL_SQLITE": "sqlite:///path/to/database.db",
        "USQL_DEFAULT_CONNECTION": "postgres",
        "USQL_QUERY_TIMEOUT_MS": "30000"
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
        "USQL_POSTGRES": "postgres://user:password@localhost:5432/mydb",
        "USQL_DEFAULT_CONNECTION": "postgres"
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
          "USQL_POSTGRES": "postgres://user:password@localhost:5432/mydb",
          "USQL_MYSQL": "mysql://user:password@localhost:3306/mydb"
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
        "USQL_POSTGRES": "postgres://user:password@localhost:5432/mydb",
        "USQL_SQLITE": "sqlite:///absolute/path/to/database.db",
        "USQL_DEFAULT_CONNECTION": "postgres"
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
export USQL_POSTGRES="postgres://user:password@localhost:5432/mydb"
export USQL_SQLITE="sqlite:///path/to/database.db"
export USQL_DEFAULT_CONNECTION="postgres"
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

## Tool Catalogue

| Tool | Purpose | Notable Inputs |
| --- | --- | --- |
| `execute_query` | Run an arbitrary SQL statement | `connection_string`, `query`, optional `output_format` (`json`\|`csv`), `timeout_ms` |
| `execute_script` | Execute a multi-statement script | `connection_string`, `script`, optional `output_format`, `timeout_ms` |
| `list_databases` | List databases available on the server | `connection_string`, optional `output_format`, `timeout_ms` |
| `list_tables` | List tables in the current database | `connection_string`, optional `output_format`, `timeout_ms` |
| `describe_table` | Inspect table metadata via `\d` | `connection_string`, `table`, optional `output_format`, `timeout_ms` |

Successful calls return the exact stdout produced by `usql`, paired with the format indicator:

```jsonc
{
  "format": "json", // or "csv"
  "content": "[{\"id\":1}]"
}
```

If `usql` exits with a non-zero code the handler forwards the message through the MCP error shape, keeping
details like the sanitized connection string and original stderr.

## Development

- `npm run dev` – TypeScript compile in watch mode
- `npm run build` – emit ESM output to `dist/`
- `npm run lint` – ESLint/Prettier rules
- `npm run test` – Jest unit tests (no external services required)
- `npm run type-check` – strict `tsc --noEmit`

Debug logging follows the namespace in `DEBUG=usql-mcp:*`.

## Contributing

See `AGENTS.md` for contributor guidelines. Open an issue before large changes so we can keep the tooling
lean and aligned with the MCP ecosystem.
