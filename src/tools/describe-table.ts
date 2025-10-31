/**
 * describe_table tool - Get schema information for a table
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DescribeTableInput, RawOutput } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { createUsqlError, formatMcpError } from "../utils/error-handler.js";
import { validateConnectionString } from "../usql/connection.js";
import { executeUsqlQuery } from "../usql/process-executor.js";
import { parseUsqlError } from "../usql/parser.js";
import { getQueryTimeout, resolveConnectionStringOrDefault } from "../usql/config.js";
import { withBackgroundSupport } from "./background-wrapper.js";

const logger = createLogger("usql-mcp:tools:describe-table");

export const describeTableSchema: Tool = {
  name: "describe_table",
  description: "Get detailed schema information for a specific table (columns, types, constraints). Uses default connection if none specified.",
  inputSchema: {
    type: "object",
    properties: {
      connection_string: {
        type: "string",
        description: '(Optional) Database connection URL or configured connection name. If omitted, uses the default connection from USQL_DEFAULT_CONNECTION (e.g., "oracle" for USQL_ORACLE). Use get_server_info to discover available connections.',
      },
      table: {
        type: "string",
        description: "Table name to describe",
      },
      database: {
        type: "string",
        description: "Optional database name (if not specified in connection)",
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
    required: ["table"],
  },
};

async function _handleDescribeTable(input: DescribeTableInput): Promise<RawOutput> {
  const outputFormat = input.output_format || "json";

  logger.debug("[describe-table] Handling request", {
    connectionStringInput: input.connection_string,
    table: input.table,
    database: input.database,
    outputFormat,
  });

  let resolvedConnectionString: string | undefined;

  try {
    if (!input.table || typeof input.table !== "string") {
      throw createUsqlError("InvalidInput", "table is required and must be a string");
    }

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

    // Build describe query
    // Use usql's \d command to describe table
    const query = `\\d ${input.table}`;

    const timeoutOverride =
      input.timeout_ms === null
        ? undefined
        : typeof input.timeout_ms === "number" && Number.isFinite(input.timeout_ms)
        ? input.timeout_ms
        : undefined;
    const timeout = timeoutOverride ?? getQueryTimeout();
    logger.debug("[describe-table] Executing describe command", {
      timeout,
      table: input.table,
      outputFormat,
    });

    const result = await executeUsqlQuery(resolvedConnectionString, query, {
      timeout,
      format: outputFormat,
    });

    logger.debug("[describe-table] Command executed", {
      exitCode: result.exitCode,
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
    });

    // Check for errors
    if (result.exitCode !== 0) {
      if (result.stderr) {
        const errorMessage = parseUsqlError(result.stderr);
        throw createUsqlError("DescribeTableError", errorMessage, {
          exitCode: result.exitCode,
          table: input.table,
        });
      }
      // Some databases don't error on missing table, check output
      if (!result.stdout.trim()) {
        throw createUsqlError(
          "TableNotFound",
          `Table not found: ${input.table}`,
          { table: input.table }
        );
      }
    }

    // Check for empty output
    if (!result.stdout.trim()) {
      throw createUsqlError(
        "TableNotFound",
        `Table not found: ${input.table}`,
        { table: input.table }
      );
    }

    logger.debug("[describe-table] Table schema retrieved", {
      table: input.table,
      outputFormat,
    });

    return {
      format: outputFormat as "json" | "csv",
      content: result.stdout,
    };
  } catch (error) {
    const connectionForError = resolvedConnectionString ?? input.connection_string;
    const mcpError = formatMcpError(
      error,
      connectionForError || input.table || input.database
        ? {
            connectionString: connectionForError,
            table: input.table,
            database: input.database,
          }
        : undefined
    );

    logger.error("[describe-table] Error describing table", error);
    throw mcpError;
  }
}

export const handleDescribeTable = withBackgroundSupport("describe_table", _handleDescribeTable);
