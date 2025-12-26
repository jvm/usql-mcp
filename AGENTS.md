# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Repository Overview

This repository implements a **full-featured MCP Server** (Model Context Protocol Server) that exposes [usql](https://github.com/xo/usql) capabilities to AI assistants and LLM applications. The server enables AI models to execute SQL queries and inspect database schemas across any database system supported by usql, with enterprise-ready features including background execution, progress tracking, query safety validation, schema resources, SQL workflow prompts, and performance optimizations.

**Key Responsibilities**:
- Safely bridge user queries to usql CLI execution
- Handle connection strings with credential sanitization
- Parse and validate results with safety analysis
- Manage long-running queries with background execution
- Provide schema browsing via MCP resources
- Offer SQL workflow templates via MCP prompts
- Track progress for long operations
- Cache schema data for performance
- Rate limit requests for security

## Development Language & Stack

The project is implemented in **TypeScript/Node.js** with the following core dependencies:

- **@modelcontextprotocol/sdk**: Official SDK for building MCP servers (v1.x)
- **usql**: Invoked as an external CLI process (must be installed system-wide)
- **node-sql-parser**: For query validation and safety analysis
- Other standard Node.js utilities for process execution and error handling

## Project Structure

```
usql-mcp/
├── src/
│   ├── index.ts                          # MCP server initialization with all capabilities
│   ├── tools/                            # MCP Tools (8 tools)
│   │   ├── execute-query.ts              # Execute SQL queries with safety analysis
│   │   ├── execute-script.ts             # Execute multi-statement scripts
│   │   ├── list-databases.ts             # List available databases
│   │   ├── list-tables.ts                # List tables in a database
│   │   ├── describe-table.ts             # Get table schema details
│   │   ├── get-job-status.ts             # Check background job status
│   │   ├── get-server-info.ts            # Get server configuration and stats
│   │   ├── cancel-job.ts                 # Cancel running background jobs
│   │   ├── background-wrapper.ts         # Background execution wrapper
│   │   └── output-schemas.ts             # Tool output JSON schemas
│   ├── resources/                        # MCP Resources
│   │   ├── index.ts                      # Resource handlers registration
│   │   ├── list-resources.ts             # List available resources
│   │   ├── read-resource.ts              # Read resource content
│   │   └── uri-parser.ts                 # sql:// URI parsing
│   ├── prompts/                          # MCP Prompts
│   │   ├── index.ts                      # Prompt system exports
│   │   ├── prompt-registry.ts            # Central prompt registry
│   │   └── templates/                    # SQL workflow templates
│   │       ├── analysis.ts               # Performance & quality prompts
│   │       ├── migration.ts              # Migration & documentation prompts
│   │       └── debugging.ts              # Optimization & debugging prompts
│   ├── usql/                             # Core execution layer
│   │   ├── process-executor.ts           # Spawn and manage usql subprocesses
│   │   ├── parser.ts                     # Parse usql output into structured data
│   │   ├── connection.ts                 # Connection string validation
│   │   ├── config.ts                     # Configuration management
│   │   ├── job-manager.ts                # Background job tracking and cleanup
│   │   └── database-mapper.ts            # Database-specific command mapping
│   ├── notifications/                    # MCP Notifications
│   │   ├── progress-notifier.ts          # Progress reporting for long operations
│   │   └── list-changed-notifier.ts      # ListChanged notifications
│   ├── cache/                            # Performance caching
│   │   └── schema-cache.ts               # TTL-based schema caching
│   ├── utils/                            # Shared utilities
│   │   ├── error-handler.ts              # Consistent error formatting
│   │   ├── logger.ts                     # Debug logging
│   │   ├── query-safety-analyzer.ts      # Query risk analysis
│   │   ├── query-validator.ts            # Query syntax validation
│   │   ├── config-validator.ts           # Configuration validation
│   │   ├── rate-limiter.ts               # Request rate limiting
│   │   ├── request-tracker.ts            # Request cancellation tracking
│   │   └── pagination.ts                 # Cursor-based pagination
│   └── types/
│       └── index.ts                      # Shared TypeScript interfaces
├── dist/                                 # Compiled JavaScript output
├── tests/
│   ├── integration/                      # Tests requiring usql installation
│   │   ├── execute-query.sqlite.test.ts  # SQLite query execution
│   │   ├── resources.test.ts             # Resource browsing
│   │   └── process-executor.usql.test.ts # usql subprocess integration
│   └── unit/                             # Unit tests (519 tests total)
│       ├── tools.test.ts                 # All tool handlers
│       ├── background-wrapper.test.ts    # Background execution
│       ├── job-manager.test.ts           # Job lifecycle management
│       ├── query-safety-analyzer.test.ts # Safety analysis
│       ├── progress-notifier.test.ts     # Progress reporting
│       ├── pagination.test.ts            # Pagination utilities
│       ├── request-tracker.test.ts       # Request cancellation
│       ├── prompts/                      # Prompt system tests
│       │   └── prompt-registry.test.ts   # Prompt registration and retrieval
│       └── resources/                    # Resource system tests
│           ├── list-resources.test.ts    # Resource listing
│           └── uri-parser.test.ts        # URI parsing
├── package.json
├── tsconfig.json
├── .npmrc
├── README.md
└── CLAUDE.md (this file)
```

## MCP Capabilities Implemented

This server implements all 4 MCP capabilities:

1. **Tools** (8 tools): SQL execution, schema inspection, job management
2. **Resources**: Browse database metadata via `sql://` URIs with templates
3. **Prompts**: 6 SQL workflow templates for common tasks
4. **Progress**: Real-time progress notifications for long operations

All capabilities declare `listChanged: true` for protocol compliance.

## Essential Commands (follow this workflow strictly)

### Development Workflow

> Always execute these steps in order when making changes. Do not skip lint/type-check/test/build before finishing.

```bash
# 1) Install dependencies (includes MCP SDK)
npm install

# 2) TypeScript compilation (required before running server)
npm run build

# 3) Run compiled server (outputs to stdio for MCP protocol)
node dist/index.js

# 4) Development mode with auto-rebuild (use while iterating)
npm run dev

# 5) Run test suite (mandatory): 519 unit + integration tests
npm test

# 6) Type checking (mandatory)
npm run type-check

# 7) Linting (mandatory)
npm run lint

# 8) Format code (mandatory before finalizing changes)
npm run format
```

### Testing Strategy

- **Unit Tests** (515 tests): Mock usql subprocess output, test tool parameter validation, test output parsing
- **Integration Tests** (4 tests): Require actual usql CLI + test databases (SQLite for portability)
- **Test Database Setup**: Include minimal test fixtures (SQLite .db file or schema init script)

```bash
# Run all tests (519 total)
npm test

# Run specific test file
npm test -- execute-query.test.ts

# Run with coverage
npm test -- --coverage

# Integration tests (require usql installed)
npm test -- integration

# Watch mode during development
npm test -- --watch
```

## Architecture & Design Patterns

### Core Concept: Process-Based Execution

usql is a CLI tool, not a library. The MCP server spawns usql subprocesses for each query:

1. **Subprocess Invocation**: `usql 'connection_string' -c 'SELECT ...'`
2. **Output Parsing**: Parse usql's text/table output into structured JSON
3. **Error Handling**: Capture stderr for connection/permission errors
4. **Resource Cleanup**: Ensure subprocess termination and timeout handling
5. **Abort Signals**: Support cancellation via AbortSignal

### Background Execution Pattern

Queries exceeding `backgroundThresholdMs` (default: 30s) automatically move to background:

1. **Threshold Check**: Race between query completion and threshold timer
2. **Job Creation**: If threshold exceeded, create job with UUID, store promise
3. **Immediate Response**: Return `job_id` and status to client
4. **Async Completion**: Promise continues executing, updates job state
5. **Polling**: Client uses `get_job_status` with `wait_seconds` to check progress
6. **Progress Updates**: Time-based progress estimation (asymptotic curve)
7. **Cleanup**: Jobs auto-deleted after TTL (default: 1 hour)

**Implementation**: `src/tools/background-wrapper.ts` wraps tool handlers

### Tool Architecture

Each tool follows this enhanced pattern:

```typescript
// 1. Define schema with title and outputSchema
const schema: Tool = {
  name: "execute_query",
  title: "Execute SQL Query",
  description: "Execute a SQL query with safety analysis...",
  inputSchema: {
    type: "object",
    properties: {
      connection_string: { type: "string" },
      query: { type: "string" },
      parameters: { type: "array" },
      output_format: { enum: ["json", "csv"] },
      timeout_ms: { type: "number", minimum: 0 }
    },
    required: ["query"]  // connection_string optional if default configured
  },
  outputSchema: executeQueryOutputSchema  // JSON schema for response
};

// 2. Implement handler with background support
const handler = withBackgroundSupport(
  "execute_query",
  async (input, signal) => {
    validateInput(input);

    // Safety analysis before execution
    const safetyAnalysis = analyzeQuerySafety(input.query);
    if (shouldBlockQuery(safetyAnalysis)) {
      throw createUsqlError("QueryBlocked", "Query blocked by safety policy");
    }

    // Execute with abort signal support
    const result = await invokeUsql(
      input.connection_string,
      input.query,
      { signal }
    );

    // Return with safety analysis
    return {
      ...parseResult(result),
      safety_analysis: safetyAnalysis,
      elapsed_ms: Date.now() - startTime
    };
  }
);
```

### Resource Architecture

Resources expose database metadata via hierarchical URIs:

**URI Scheme**: `sql://{connection}/{database}/...`

**Supported patterns**:
- `sql://connections` - List all configured connections
- `sql://{connection}/databases` - List databases on connection
- `sql://{connection}/{database}/tables` - List tables in database
- `sql://{connection}/{database}/table/{name}` - Table schema details

**Template Support**: Clients can discover URI patterns via `resources/templates/list`

**Implementation**:
- `src/resources/uri-parser.ts` - Parse and validate URIs
- `src/resources/read-resource.ts` - Execute queries to fetch resource data
- Schema caching reduces subprocess overhead

### Prompt Architecture

Prompts provide SQL workflow templates with conversation starters:

**Registry Pattern**:
```typescript
export interface PromptTemplate {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  getMessages: (args: Record<string, string>) => PromptMessage[];
}

registerPrompt(analyzePerformancePrompt);
```

**Available Prompts**:
1. `analyze_performance` - Query performance analysis with EXPLAIN
2. `profile_data_quality` - Data profiling (nulls, duplicates, distributions)
3. `generate_migration` - Migration script generation
4. `explain_schema` - Schema documentation
5. `optimize_query` - Query optimization recommendations
6. `debug_slow_query` - Systematic slow query debugging

**Implementation**: `src/prompts/` with templates in `src/prompts/templates/`

### Progress Notification Pattern

Long-running operations report progress using MCP progress notifications:

**Time-Based Estimation**:
- Uses asymptotic curve: `99 * (1 - e^(-3*ratio))`
- Approaches but never reaches 100% until completion
- Monotonically increasing (never decreases)
- Updates every second during execution

**Integration**:
```typescript
const progressReporter = createProgressReporter(estimatedDurationMs, (progress) => {
  jobManager.updateProgress(jobId, progress);
});

progressReporter.start();
// ... operation runs ...
progressReporter.reportCompletion();  // Reports 100%
```

**Implementation**: `src/notifications/progress-notifier.ts`

### Query Safety Analysis

Every query is analyzed for risk before execution:

**Risk Levels**:
- **Low**: Read-only SELECT queries
- **Medium**: UPDATE/DELETE with WHERE clause
- **High**: Complex joins, subqueries, missing indexes
- **Critical**: DROP, TRUNCATE, DELETE/UPDATE without WHERE

**Analysis Components**:
1. **Dangerous Operations**: DROP, TRUNCATE, ALTER, etc.
2. **WHERE Clause Detection**: For UPDATE/DELETE/ALTER
3. **Complexity Scoring**: JOIN count, subquery count, aggregations
4. **Recommendations**: Actionable improvements

**Configuration**:
- `allowDestructiveOperations: false` - Block all destructive ops
- `blockHighRiskQueries: true` - Block "high" risk queries
- `blockCriticalRiskQueries: true` - Block "critical" risk queries
- `requireWhereClauseForDelete: true` - Require WHERE on DELETE/UPDATE

**Implementation**: `src/utils/query-safety-analyzer.ts`

### Connection String Handling

- **Validation**: Verify connection strings follow dburl format before invocation
- **Security**: Never log full connection strings (redact credentials in debug output)
- **Named Connections**: Support `USQL_*` env vars for reusable connections
- **Default Connection**: Use `USQL_DEFAULT_CONNECTION` when omitted from tools
- **Hashing**: Hash sanitized connection strings for job tracking (SHA256)
- **Error Messages**: Never expose raw connection string errors to client

### Output Parsing Strategy

usql outputs in multiple formats:

1. **JSON Output** (preferred): `usql --json` for structured data
2. **CSV Output** (optional): `usql --csv` for tabular export
3. **Error Messages**: Detect and format errors consistently

All responses include:
- `format`: "json" or "csv"
- `content`: Actual query results
- `elapsed_ms`: Request duration
- `safety_analysis`: Query risk analysis (for queries)

### Error Handling

All errors follow MCP error format:

```typescript
{
  error: "ExecutionError",          // Error code
  message: "Human-readable error description",
  details: {
    cause: "underlying cause if available",
    connectionString: "sanitized connection string (redacted)",
    query: "the query that failed",
    elapsed_ms: 1234
  }
}
```

**Never expose**:
- Passwords, tokens, or credentials
- Full database error details that might reveal schema/security info
- System paths or internal server state

**Error Codes**:
- `InvalidInput` - Bad parameters
- `ConnectionFailed` - Database connection error
- `QueryFailed` - Query execution error
- `Timeout` - Operation exceeded timeout
- `JobNotFound` - Background job doesn't exist
- `RateLimitExceeded` - Too many requests
- `QueryBlocked` - Blocked by safety policy

### Performance Optimizations

#### Schema Caching

TTL-based caching for metadata queries:

```typescript
// Configuration
{
  "defaults": {
    "schemaCacheTtl": 300000  // 5 minutes
  }
}

// Cached operations
- list_databases
- list_tables
- describe_table
- Resource reads

// Cache invalidation
- Manual: invalidateSchemaCache(connectionHash)
- Automatic: TTL expiration
- Modifying operations: invalidate on INSERT/UPDATE/DELETE/DROP
```

**Stats tracking**:
- Hits, misses, size, hit rate
- Exposed via `get_server_info`

**Implementation**: `src/cache/schema-cache.ts`

#### Rate Limiting

Per-minute request limits with graceful degradation:

```typescript
// Configuration
{
  "defaults": {
    "rateLimitRpm": 60  // 60 requests per minute
  }
}

// Behavior
- Track requests by identifier (default: "global")
- Rolling 1-minute windows
- Return RateLimitExceeded error with retry time
- Automatic cleanup of expired entries
```

**Implementation**: `src/utils/rate-limiter.ts`

#### Request Tracking

Track in-flight requests for cancellation support:

```typescript
// Features
- AbortController per request
- Graceful cancellation on server shutdown
- Future: $/cancelRequest protocol support
```

**Implementation**: `src/utils/request-tracker.ts`

## Key Implementation Notes

### 1. Query Parameter Binding

**NOT SUPPORTED**: Parameterized queries are not supported because usql doesn't provide a safe parameter binding API for arbitrary databases.

If `parameters` array is provided, reject with:
```typescript
throw createUsqlError(
  "InvalidInput",
  "Parameterized queries are not supported. Use literal values in the query."
);
```

### 2. Timeout Management

The server defaults to **unlimited** duration. Apply timeout only when configured:

```typescript
// Priority order
1. Tool call timeout_ms parameter
2. USQL_QUERY_TIMEOUT_MS environment variable
3. defaults.queryTimeout in config.json
4. null (unlimited)

// Implementation
const timeout = input.timeout_ms ?? getQueryTimeout() ?? null;
```

**Background execution**: Timeout applies to initial query. If it exceeds threshold, query moves to background and runs until completion (no timeout on background).

### 3. Database-Specific Commands

Different databases require different syntax for metadata queries:

```typescript
// list_databases
PostgreSQL: "SELECT datname FROM pg_database WHERE datistemplate = false"
MySQL:      "SHOW DATABASES"
SQLite:     Not applicable (single database)

// list_tables
PostgreSQL: "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
MySQL:      "SHOW TABLES"
SQLite:     "SELECT name FROM sqlite_master WHERE type='table'"
Oracle:     "SELECT table_name FROM user_tables"
```

**Implementation**: `src/usql/database-mapper.ts` maps database types to commands

### 4. AbortSignal Support

All tools support cancellation via AbortSignal:

```typescript
async function handleExecuteQuery(input, signal) {
  // Pass signal to subprocess executor
  const result = await executeUsqlQuery(
    connectionString,
    query,
    { signal, timeout, format }
  );

  // Check if aborted
  if (signal?.aborted) {
    throw createUsqlError("Cancelled", "Query was cancelled");
  }
}
```

**Subprocess handling**:
```typescript
const subprocess = spawn("usql", args);

if (signal) {
  const abortHandler = () => {
    subprocess.kill("SIGTERM");
  };
  signal.addEventListener("abort", abortHandler);

  // Cleanup on completion
  subprocess.on("exit", () => {
    signal.removeEventListener("abort", abortHandler);
  });
}
```

## Testing Databases

For integration tests, use **SQLite** (no external server needed):

```bash
# Create test database
sqlite3 test.db < schema.sql

# In tests, use connection string
const connStr = `sqlite:///${process.cwd()}/tests/fixtures/test.db`;
```

**Test fixtures** in `tests/fixtures/`:
- `test.db` - SQLite database with sample data
- `schema.sql` - Schema initialization script

## Security Checklist

When implementing a new tool or feature:

- [ ] Validate connection string format
- [ ] Sanitize error messages before returning to client (no credentials)
- [ ] Set query timeout to prevent resource exhaustion
- [ ] Log queries without credentials (for debugging)
- [ ] Analyze query safety (if executing SQL)
- [ ] Support AbortSignal for cancellation
- [ ] Hash connection strings (don't store full strings)
- [ ] Document security implications
- [ ] Test with malicious inputs
- [ ] Verify rate limiting applies

**Additional safety measures**:
- Never use `eval()` or `Function()` constructors
- Validate all user inputs against JSON schemas
- Use prepared statements when possible (not applicable with usql)
- Limit result sizes (default: 10MB)
- Block dangerous operations if configured
- Require WHERE clauses if configured

## Debugging Tips

Enable debug logging via environment variable:

```bash
DEBUG=usql-mcp:* node dist/index.js
```

**Debug namespaces**:
- `usql-mcp:server` - Server lifecycle and request handling
- `usql-mcp:tools:*` - Individual tool execution
- `usql-mcp:usql:*` - usql subprocess management
- `usql-mcp:cache:*` - Caching operations
- `usql-mcp:notifications:*` - Progress and list-changed notifications

Use structured logging with consistent prefixes:

```typescript
logger.debug("[process-executor] Spawning usql", { timeout, format });
logger.debug("[parser] Parsing JSON output", { rowCount: result.rows.length });
logger.error("[error-handler] Query failed", { sanitized: true, query: "SELECT..." });
```

**Logging best practices**:
- Always sanitize credentials before logging
- Include timing information (`elapsedMs`)
- Log at appropriate levels (debug/info/warn/error)
- Use structured data (objects) for searchability

## Dependencies to Avoid

- **Database drivers** (libpq, mysql, oracledb, etc.): usql handles this via subprocess
- **Heavy ORMs** (TypeORM, Sequelize, Prisma): usql is the abstraction layer
- **Global mutable state**: Keep tool handlers pure/stateless for MCP protocol
- **Synchronous I/O**: All operations should be async
- **Undocumented npm packages**: Stick to well-maintained dependencies

## Configuration Management

Configuration is loaded from multiple sources in priority order:

1. **config.json** (if exists at `USQL_CONFIG_PATH` or `./config.json`)
2. **Environment variables** (`USQL_*`)
3. **Default values** (hardcoded in `src/usql/config.ts`)

**Configuration caching**: Config is cached after first load. Use `resetConfigCache()` in tests.

**Validation**: All config is validated using `src/utils/config-validator.ts` with JSON schema.

## Building & Deployment

The MCP server runs as a Node.js process managed by Claude Desktop or other MCP clients.

**Build Output**: `npm run build` generates `dist/index.js` as the entry point

**Configuration**: Users add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "usql": {
      "command": "npx",
      "args": ["-y", "usql-mcp"],
      "env": {
        "USQL_DEFAULT_CONNECTION": "postgres://localhost/mydb",
        "USQL_QUERY_TIMEOUT_MS": "60000",
        "USQL_BACKGROUND_THRESHOLD_MS": "30000"
      }
    }
  }
}
```

The server outputs MCP protocol messages via stdout and reads requests via stdin.

**Environment**: Runs in sandbox mode for security isolation.

## Testing Best Practices

1. **Unit tests should not require usql**: Mock subprocess execution
2. **Integration tests should use SQLite**: Portable, no server needed
3. **Test fixtures should be minimal**: Small datasets, clear purpose
4. **Clean up after tests**: Reset config cache, clear job manager
5. **Test error paths**: Invalid inputs, timeouts, cancellation
6. **Test concurrent execution**: Multiple requests, background jobs
7. **Test safety analysis**: All risk levels, blocking policies

**Coverage target**: >80% for all modules

## Common Pitfalls

1. **Forgetting to sanitize credentials**: Always use `sanitizeConnectionString()`
2. **Not handling AbortSignal**: All async operations should support cancellation
3. **Hardcoding database-specific syntax**: Use `database-mapper.ts`
4. **Not cleaning up subprocesses**: Always kill on timeout/abort
5. **Exposing internal errors**: Format all errors through `formatMcpError()`
6. **Skipping safety analysis**: Always analyze queries before execution
7. **Forgetting to track elapsed time**: All responses should include `elapsed_ms`
8. **Not testing with real usql**: Integration tests catch subprocess issues

## References

- **MCP SDK Documentation**: https://github.com/modelcontextprotocol/sdk-typescript
- **MCP Specification**: https://spec.modelcontextprotocol.io/
- **MCP Server Examples**: https://github.com/modelcontextprotocol/servers
- **usql CLI Reference**: https://github.com/xo/usql
- **dburl Format**: https://github.com/xo/dburl
- **Node.js child_process**: https://nodejs.org/api/child_process.html
- **AbortController**: https://developer.mozilla.org/en-US/docs/Web/API/AbortController

## Version History

### v0.1.0 - Initial Release
- 8 MCP tools for SQL execution and schema inspection
- Background execution with job tracking
- Query safety analysis with configurable blocking
- Progress reporting for long operations
- Schema resources via sql:// URIs
- SQL workflow prompts (6 templates)
- Schema caching for performance
- Rate limiting for security
- Full MCP protocol compliance (all 4 capabilities)
- 519 passing tests with comprehensive coverage
