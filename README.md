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

## Quick Launch with npm exec

Once the package is published you will be able to run it directly via:

```bash
npx usql-mcp
```

Until it is published, you can still spin it up straight from the repository using npm’s Git support (the
`prepare` script compiles the TypeScript automatically):

```bash
npx github:jvm/usql-mcp
```

Both commands download the package, build `dist/`, and execute the CLI entry point (`usql-mcp`), which
runs the MCP server on stdio.

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

For Claude Desktop, point the MCP configuration to the compiled entry point:

```json
{
  "mcpServers": {
    "usql": {
      "command": "node",
      "args": ["/absolute/path/to/usql-mcp/dist/index.js"]
    }
  }
}
```

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
