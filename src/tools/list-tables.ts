/**
 * list_tables tool - List tables in a database
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ListTablesInput, RawOutput } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { createUsqlError, formatMcpError, sanitizeConnectionString } from "../utils/error-handler.js";
import { validateConnectionString } from "../usql/connection.js";
import { executeUsqlQuery } from "../usql/process-executor.js";
import { parseUsqlError } from "../usql/parser.js";
import { getQueryTimeout, resolveConnectionStringOrDefault } from "../usql/config.js";
import { detectDatabaseType, getListTablesCommand } from "../utils/database-mapper.js";
import { withBackgroundSupport } from "./background-wrapper.js";
import { listTablesOutputSchema, backgroundJobOutputSchema } from "./output-schemas.js";

const logger = createLogger("usql-mcp:tools:list-tables");

export const listTablesSchema: Tool = {
  name: "list_tables",
  title: "List Tables",
  description:
    "List all tables in a database. " +
    "Automatically detects the database type (PostgreSQL, MySQL, Oracle, etc.) and uses the appropriate command. " +
    "Returns table names and metadata such as schema, owner, and row counts (database-dependent). " +
    "Uses default connection if none specified.",
  inputSchema: {
    type: "object",
    properties: {
      connection_string: {
        type: "string",
        description:
          '(Optional) Database connection URL or configured connection name. If omitted, uses the default connection from USQL_DEFAULT_CONNECTION (e.g., "oracle" for USQL_ORACLE). Use get_server_info to discover available connections.',
      },
      database: {
        type: "string",
        description: "Optional database name to list tables from (if not specified in connection)",
      },
      output_format: {
        type: "string",
        enum: ["json", "csv"],
        description: "Output format for results (default: json)",
      },
      timeout_ms: {
        type: ["number", "null"],
        description:
          "Optional timeout in milliseconds for this call (overrides defaults). Use null for unlimited.",
        minimum: 1,
      },
    },
    required: [],
  },
  outputSchema: {
    oneOf: [listTablesOutputSchema, backgroundJobOutputSchema],
  } as any,
};

async function _handleListTables(
  input: ListTablesInput,
  signal?: AbortSignal
): Promise<RawOutput> {
  const outputFormat = input.output_format || "json";

  logger.debug("[list-tables] Handling request", {
    connectionString: input.connection_string
      ? sanitizeConnectionString(input.connection_string)
      : undefined,
    database: input.database,
    outputFormat,
  });

  let resolvedConnectionString: string | undefined;

  try {
    // Resolve connection string
    try {
      resolvedConnectionString = resolveConnectionStringOrDefault(input.connection_string);
    } catch (error) {
      throw createUsqlError("InvalidConnection", `Failed to resolve connection: ${String(error)}`);
    }

    if (!validateConnectionString(resolvedConnectionString)) {
      throw createUsqlError(
        "InvalidConnection",
        `Invalid connection string format: ${resolvedConnectionString}`
      );
    }

    // Reject database parameter switching
    if (input.database) {
      throw createUsqlError(
        "DatabaseSwitchNotSupported",
        "Selecting a different database via the database parameter is not supported. Please include the database in the connection string instead."
      );
    }

    // Build query using database-specific command
    const dbType = detectDatabaseType(resolvedConnectionString);
    const query = getListTablesCommand(dbType);

    const timeoutOverride =
      input.timeout_ms === null
        ? undefined
        : typeof input.timeout_ms === "number" && Number.isFinite(input.timeout_ms)
          ? input.timeout_ms
          : undefined;
    const timeout = timeoutOverride ?? getQueryTimeout();
    logger.debug("[list-tables] Executing list command", {
      timeout,
      database: input.database,
      outputFormat,
    });

    const result = await executeUsqlQuery(resolvedConnectionString, query, {
      timeout,
      format: outputFormat,
      signal,
    });

    logger.debug("[list-tables] Command executed", {
      exitCode: result.exitCode,
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
    });

    // Check for errors
    if (result.exitCode !== 0 && result.stderr) {
      const errorMessage = parseUsqlError(result.stderr);
      throw createUsqlError("ListTablesError", errorMessage, { exitCode: result.exitCode });
    }

    logger.debug("[list-tables] Tables retrieved", {
      outputFormat,
      database: input.database,
    });

    return {
      format: outputFormat as "json" | "csv",
      content: result.stdout,
    };
  } catch (error) {
    const connectionForError = resolvedConnectionString ?? input.connection_string;
    const mcpError = formatMcpError(
      error,
      connectionForError || input.database
        ? {
            connectionString: connectionForError,
            database: input.database,
          }
        : undefined
    );

    logger.error("[list-tables] Error listing tables", error);
    throw mcpError;
  }
}

export const handleListTables = withBackgroundSupport("list_tables", _handleListTables);
