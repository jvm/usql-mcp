# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Repository Overview

This repository implements an **MCP Server** (Model Context Protocol Server) that exposes [usql](https://github.com/xo/usql) capabilities to AI assistants and LLM applications. The server enables AI models to execute SQL queries and inspect database schemas across any database system supported by usql.

**Key Responsibility**: Safely bridge user queries to usql CLI execution, handle connection strings, parse results, and return structured data to the AI model.

## Development Language & Stack

The project is implemented in **TypeScript/Node.js** with the following core dependencies:

- **@modelcontextprotocol/sdk**: Official SDK for building MCP servers
- **usql**: Invoked as an external CLI process (must be installed system-wide)
- **node-sql-parser**: Optional, for query validation/analysis
- Other standard Node.js utilities for process execution and error handling

## Project Structure

```
usql-mcp/
├── src/
│   ├── index.ts                 # MCP server initialization and tool registration
│   ├── tools/
│   │   ├── execute-query.ts     # execute_query tool implementation
│   │   ├── list-databases.ts    # list_databases tool implementation
│   │   ├── list-tables.ts       # list_tables tool implementation
│   │   ├── describe-table.ts    # describe_table tool implementation
│   │   └── execute-script.ts    # execute_script tool implementation
│   ├── usql/
│   │   ├── connection.ts        # Connection string validation and usql invocation
│   │   ├── process-executor.ts  # Spawn and manage usql subprocesses
│   │   └── parser.ts            # Parse usql output into structured data
│   ├── types/
│   │   └── index.ts             # Shared TypeScript interfaces
│   └── utils/
│       ├── error-handler.ts     # Consistent error formatting
│       └── logger.ts            # Debug logging
├── dist/                        # Compiled JavaScript output
├── tests/
│   ├── integration/             # Tests requiring usql installation
│   └── unit/                    # Unit tests with mocked usql
├── package.json
├── tsconfig.json
├── .npmrc                       # npm configuration
└── README.md
```

## Essential Commands

### Development Workflow

```bash
# Install dependencies (includes MCP SDK)
npm install

# TypeScript compilation
npm run build

# Run compiled server (outputs to stdio for MCP protocol)
node dist/index.js

# Development mode with auto-rebuild
npm run dev

# Run test suite
npm test

# Run single test file
npm test -- describe-table.test.ts

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

### Testing Strategy

- **Unit Tests**: Mock usql subprocess output, test tool parameter validation, test output parsing
- **Integration Tests**: Require actual usql CLI + test databases (SQLite recommended for portability)
- **Test Database Setup**: Include minimal test fixtures (SQLite .db file or schema init script)

```bash
# Run only unit tests (no external dependencies)
npm run test:unit

# Run integration tests (requires usql + test databases)
npm run test:integration

# Watch mode during development
npm run test -- --watch
```

## Architecture & Design Patterns

### Core Concept: Process-Based Execution

usql is a CLI tool, not a library. The MCP server spawns usql subprocesses for each query:

1. **Subprocess Invocation**: `usql 'connection_string' -c 'SELECT ...'`
2. **Output Parsing**: Parse usql's text/table output into structured JSON
3. **Error Handling**: Capture stderr for connection/permission errors
4. **Resource Cleanup**: Ensure subprocess termination and timeout handling

### Tool Architecture

Each tool (`execute-query.ts`, `list-databases.ts`, etc.) follows this pattern:

```typescript
// 1. Define schema (MCP tool parameters)
const schema = {
  name: "execute_query",
  description: "...",
  inputSchema: {
    type: "object",
    properties: {
      connection_string: { type: "string" },
      query: { type: "string" },
      parameters: { type: "array" }
    },
    required: ["connection_string", "query"]
  }
};

// 2. Implement handler
async function execute(input) {
  validateInput(input);
  const result = await invokeUsql(input.connection_string, input.query);
  return parseResult(result);
}
```

### Connection String Handling

- **Validation**: Verify connection strings follow dburl format before invocation
- **Security**: Never log full connection strings (redact credentials in debug output)
- **Environment Variables**: Support `process.env.USQL_*` for default connections
- **Error Messages**: Never expose raw connection string errors to client

### Output Parsing Strategy

usql outputs in multiple formats. Default parsing assumes:

1. **JSON Output** (preferred): `usql --json` for structured data
2. **Table Output** (fallback): Parse psql-style text tables
3. **Error Messages**: Detect and format errors consistently

Consider using [`json` output format](https://github.com/xo/usql#formatting) when available.

### Error Handling

All errors must follow MCP error format:

```typescript
{
  error: "ExecutionError",
  message: "Human-readable error description",
  details: {
    cause: "underlying cause if available",
    connectionString: "sanitized connection string (redacted)",
    query: "the query that failed"
  }
}
```

**Never expose**:
- Passwords or tokens
- Full database error details that might reveal schema/security info
- System paths or internal server state

## Key Implementation Notes

### 1. Query Parameter Binding

For tools accepting `parameters` array:
- Map to usql's parameter binding syntax (varies by database)
- PostgreSQL: `$1, $2, ...`
- MySQL: `?, ?, ...`
- Validate parameter count matches placeholders

### 2. Timeout Management

Set appropriate timeout logic for subprocess execution. The server now defaults to unlimited duration and only
applies a timeout when `USQL_QUERY_TIMEOUT_MS` (or `defaults.queryTimeout`) is provided. Ensure any future
changes preserve the ability to kill queries once a timeout is configured.

### 3. Connection Pooling (Optional Enhancement)

For future optimization, consider caching connections but ensure:
- Connections are properly closed on server shutdown
- Per-connection state doesn't leak between requests
- Thread safety if using connection pools

### 4. Schema Inspection Commands

Different databases require different syntax:

```
PostgreSQL: SELECT * FROM information_schema.tables
MySQL: SHOW TABLES
SQLite: SELECT name FROM sqlite_master WHERE type='table'
Oracle: SELECT table_name FROM user_tables
```

Consider using usql's built-in schema commands (`\dt`, `\d table_name`) where possible.

## Testing Databases

For integration tests, use **SQLite** (no external server needed):

```bash
# Create test database
sqlite3 test.db < schema.sql

# In tests, use connection string: sqlite:///$(pwd)/test.db
```

## Security Checklist

When implementing a new tool:

- [ ] Validate connection string format
- [ ] Use prepared statements for parameterized queries
- [ ] Sanitize error messages before returning to client
- [ ] Set query timeout to prevent resource exhaustion
- [ ] Log queries without credentials (for debugging)
- [ ] Document that users should create read-only database accounts for AI queries

## Debugging Tips

Enable debug logging via environment variable:

```bash
DEBUG=usql-mcp:* node dist/index.js
```

This enables detailed logs for:
- Connection attempts
- usql subprocess invocation
- Query execution
- Output parsing

Use structured logging with consistent prefixes:

```typescript
logger.debug("[process-executor] Spawning usql with timeout 30s");
logger.debug("[parser] Parsing JSON output, rows=" + result.rows.length);
logger.error("[error-handler] Query failed", { sanitized: true, query: "SELECT..." });
```

## Dependencies to Avoid

- **Database drivers** (libpq, mysql, etc.): usql handles this via subprocess
- **Heavy ORMs**: usql is the abstraction layer
- **Global mutable state**: Keep tool handlers pure/stateless for MCP protocol

## Building & Deployment

The MCP server runs as a Node.js process managed by Claude Desktop or other MCP clients.

**Build Output**: `npm run build` generates `dist/index.js` as the entry point

**Configuration**: Users add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "usql": {
      "command": "node",
      "args": ["/path/to/usql-mcp/dist/index.js"]
    }
  }
}
```

The server outputs MCP protocol messages via stdout and reads requests via stdin.

## References

- **MCP SDK Documentation**: https://github.com/modelcontextprotocol/sdk-typescript
- **MCP Server Examples**: https://github.com/modelcontextprotocol/servers
- **usql CLI Reference**: https://github.com/xo/usql
- **dburl Format**: https://github.com/xo/dburl
