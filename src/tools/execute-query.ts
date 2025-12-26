/**
 * execute_query tool - Execute a SQL query against a database
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ExecuteQueryInput, RawOutput } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import {
  createUsqlError,
  formatMcpError,
  sanitizeConnectionString,
} from "../utils/error-handler.js";
import { validateConnectionString } from "../usql/connection.js";
import { executeUsqlQuery } from "../usql/process-executor.js";
import { parseUsqlError } from "../usql/parser.js";
import { getQueryTimeout, resolveConnectionStringOrDefault, getSafetyConfig } from "../usql/config.js";
import { withBackgroundSupport } from "./background-wrapper.js";
import { executeQueryOutputSchema, backgroundJobOutputSchema } from "./output-schemas.js";
import { analyzeQuerySafety, shouldBlockQuery } from "../utils/query-safety-analyzer.js";

const logger = createLogger("usql-mcp:tools:execute-query");

export const executeQuerySchema: Tool = {
  name: "execute_query",
  title: "Execute SQL Query",
  description:
    "Execute a SQL query against a database and return results. " +
    "Use this for SELECT, INSERT, UPDATE, DELETE, and other single-statement queries. " +
    "For multi-statement SQL scripts, use execute_script instead. " +
    "Supports JSON and CSV output formats. " +
    "Uses default connection if none specified. " +
    "Long-running queries (>30s by default) will return a job_id and continue in the background.",
  inputSchema: {
    type: "object",
    properties: {
      connection_string: {
        type: "string",
        description:
          '(Optional) Database connection URL or configured connection name. If omitted, uses the default connection from USQL_DEFAULT_CONNECTION. Can be a full URL (e.g., "postgres://user:pass@localhost/db") or a connection name from env vars (e.g., "oracle" for USQL_ORACLE, "postgres" for USQL_POSTGRES). Use get_server_info to discover available connections.',
      },
      query: {
        type: "string",
        description: "SQL query to execute (SELECT, INSERT, UPDATE, DELETE, etc.)",
      },
      parameters: {
        type: "array",
        description: "Optional query parameters for prepared statements",
        items: {
          type: ["string", "number", "boolean", "null"],
        },
      },
      output_format: {
        type: "string",
        enum: ["json", "csv"],
        description: "Output format for query results (default: json)",
      },
      timeout_ms: {
        type: ["number", "null"],
        description:
          "Optional timeout in milliseconds for this call (overrides defaults). Use null for unlimited.",
        minimum: 1,
      },
    },
    required: ["query"],
  },
  outputSchema: {
    oneOf: [executeQueryOutputSchema, backgroundJobOutputSchema],
  } as any,
};

async function _handleExecuteQuery(
  input: ExecuteQueryInput,
  signal?: AbortSignal
): Promise<RawOutput> {
  const outputFormat = input.output_format || "json";

  logger.debug("[execute-query] Handling request", {
    connectionStringInput: input.connection_string,
    queryLength: input.query?.length || 0,
    parameterCount: input.parameters?.length || 0,
    outputFormat,
  });

  let resolvedConnectionString: string | undefined;

  try {
    if (!input.query || typeof input.query !== "string") {
      throw createUsqlError("InvalidInput", "query is required and must be a string");
    }

    // Resolve connection string (could be a name like "oracle" or a full URI)
    try {
      resolvedConnectionString = resolveConnectionStringOrDefault(input.connection_string);
    } catch (error) {
      throw createUsqlError("InvalidConnection", `Failed to resolve connection: ${String(error)}`);
    }

    logger.debug("[execute-query] Resolved connection", {
      connectionString: sanitizeConnectionString(resolvedConnectionString),
    });

    if (!validateConnectionString(resolvedConnectionString)) {
      throw createUsqlError(
        "InvalidConnection",
        `Invalid connection string format: ${resolvedConnectionString}`
      );
    }

    // Validate parameters are not provided (not yet implemented)
    if (input.parameters && input.parameters.length > 0) {
      throw createUsqlError(
        "NotImplemented",
        "Query parameters are not yet supported. Please include parameter values directly in the SQL query. " +
          "Note: This is a security limitation - prepared statements cannot be implemented via the usql CLI. " +
          "If you need parameterized queries, consider using a native database driver."
      );
    }

    // Analyze query safety
    const safetyAnalysis = analyzeQuerySafety(input.query);
    const safetyConfig = getSafetyConfig();

    logger.debug("[execute-query] Safety analysis complete", {
      riskLevel: safetyAnalysis.riskLevel,
      warningCount: safetyAnalysis.warnings.length,
      dangerousOpsCount: safetyAnalysis.dangerousOperations.length,
    });

    // Check if query should be blocked
    if (shouldBlockQuery(safetyAnalysis, safetyConfig)) {
      const blockReasons = [];
      if (safetyConfig.blockCriticalRiskQueries && safetyAnalysis.riskLevel === "critical") {
        blockReasons.push("Query has critical risk level");
      }
      if (safetyConfig.blockHighRiskQueries && safetyAnalysis.riskLevel === "high") {
        blockReasons.push("Query has high risk level");
      }
      if (
        safetyConfig.requireWhereClauseForDelete &&
        (safetyAnalysis.details.hasDeleteWithoutWhere || safetyAnalysis.details.hasUpdateWithoutWhere)
      ) {
        blockReasons.push("DELETE/UPDATE without WHERE clause is not allowed");
      }
      if (
        !safetyConfig.allowDestructiveOperations &&
        (safetyAnalysis.details.hasDropStatement || safetyAnalysis.details.hasTruncateStatement)
      ) {
        blockReasons.push("Destructive operations (DROP/TRUNCATE) are not allowed");
      }

      throw createUsqlError("QueryBlocked", `Query blocked by safety policy: ${blockReasons.join("; ")}`, {
        safetyAnalysis,
        blockReasons,
      });
    }

    // Execute query
    const timeoutOverride =
      input.timeout_ms === null
        ? undefined
        : typeof input.timeout_ms === "number" && Number.isFinite(input.timeout_ms)
          ? input.timeout_ms
          : undefined;
    const timeout = timeoutOverride ?? getQueryTimeout();
    logger.debug("[execute-query] Executing query with timeout", { timeout });

    const result = await executeUsqlQuery(resolvedConnectionString, input.query, {
      timeout,
      format: outputFormat,
      signal,
    });

    logger.debug("[execute-query] Query executed", {
      exitCode: result.exitCode,
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
    });

    // Check for errors
    if (result.exitCode !== 0 && result.stderr) {
      const errorMessage = parseUsqlError(result.stderr);
      throw createUsqlError("QueryExecutionError", errorMessage, {
        exitCode: result.exitCode,
        query: input.query.substring(0, 200),
      });
    }

    // Return raw output with safety analysis
    logger.debug("[execute-query] Query successful", {
      outputFormat,
      contentLength: result.stdout.length,
    });

    return {
      format: outputFormat as "json" | "csv",
      content: result.stdout,
      safety_analysis: {
        risk_level: safetyAnalysis.riskLevel,
        warnings: safetyAnalysis.warnings,
        dangerous_operations: safetyAnalysis.dangerousOperations,
        complexity_score: safetyAnalysis.complexityScore,
        recommendations: safetyAnalysis.recommendations,
      },
    };
  } catch (error) {
    // Use user-provided connection string for error details (before resolution)
    // This ensures we sanitize what the user actually provided
    const connectionForError = input.connection_string || resolvedConnectionString;
    const queryForError =
      typeof input.query === "string" ? input.query.substring(0, 200) : undefined;
    const mcpError = formatMcpError(
      error,
      connectionForError || queryForError
        ? {
            connectionString: connectionForError
              ? sanitizeConnectionString(connectionForError)
              : undefined,
            query: queryForError,
          }
        : undefined
    );

    logger.error("[execute-query] Error executing query", error);
    throw mcpError;
  }
}

export const handleExecuteQuery = withBackgroundSupport("execute_query", _handleExecuteQuery);
