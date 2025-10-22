/**
 * list_databases tool - List all databases on a database server
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ListDatabasesInput, RawOutput } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { createUsqlError, formatMcpError } from "../utils/error-handler.js";
import { validateConnectionString } from "../usql/connection.js";
import { executeUsqlQuery } from "../usql/process-executor.js";
import { parseUsqlError } from "../usql/parser.js";
import { getQueryTimeout, resolveConnectionStringOrDefault } from "../usql/config.js";

const logger = createLogger("usql-mcp:tools:list-databases");

export const listDatabasesSchema: Tool = {
  name: "list_databases",
  description: "List all databases available on a database server",
  inputSchema: {
    type: "object",
    properties: {
      connection_string: {
        type: "string",
        description:
          'Database connection URL or configured connection name (e.g., "oracle" for USQL_ORACLE env var, or full URL like "postgres://localhost")',
      },
      output_format: {
        type: "string",
        enum: ["json", "csv"],
        description: "Output format for results (default: json)",
      },
      timeout_ms: {
        type: ["number", "null"],
        description: "Optional timeout in milliseconds for this call (overrides defaults). Use null for unlimited.",
        minimum: 1,
      },
    },
    required: [],
  },
};


export async function handleListDatabases(input: ListDatabasesInput): Promise<RawOutput> {
  const outputFormat = input.output_format || "json";

  logger.debug("[list-databases] Handling request", {
    connectionStringInput: input.connection_string,
    outputFormat,
  });

  let resolvedConnectionString: string | undefined;

  try {
    // Resolve connection string (could be a name like "oracle" or a full URI)
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

    // Use usql's built-in \l command to list databases
    // This works across most SQL databases
    const query = "\\l";

    const timeoutOverride =
      input.timeout_ms === null
        ? undefined
        : typeof input.timeout_ms === "number" && Number.isFinite(input.timeout_ms)
        ? input.timeout_ms
        : undefined;
    const timeout = timeoutOverride ?? getQueryTimeout();
    logger.debug("[list-databases] Executing list command", { timeout, outputFormat });

    const result = await executeUsqlQuery(resolvedConnectionString, query, {
      timeout,
      format: outputFormat,
    });

    logger.debug("[list-databases] Command executed", {
      exitCode: result.exitCode,
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
    });

    // Check for errors
    if (result.exitCode !== 0 && result.stderr) {
      const errorMessage = parseUsqlError(result.stderr);
      throw createUsqlError("ListDatabasesError", errorMessage, { exitCode: result.exitCode });
    }

    logger.debug("[list-databases] Databases retrieved", { outputFormat });

    return {
      format: outputFormat as "json" | "csv",
      content: result.stdout,
    };
  } catch (error) {
    const connectionForError = resolvedConnectionString ?? input.connection_string;
    const mcpError = formatMcpError(error, connectionForError ? { connectionString: connectionForError } : undefined);

    logger.error("[list-databases] Error listing databases", error);
    throw mcpError;
  }
}
