/**
 * execute_script tool - Execute a multi-statement SQL script
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ExecuteScriptInput, RawOutput } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { createUsqlError, formatMcpError } from "../utils/error-handler.js";
import { validateConnectionString } from "../usql/connection.js";
import { executeUsqlQuery } from "../usql/process-executor.js";
import { parseUsqlError } from "../usql/parser.js";
import { getQueryTimeout, resolveConnectionStringOrDefault } from "../usql/config.js";

const logger = createLogger("usql-mcp:tools:execute-script");

export const executeScriptSchema: Tool = {
  name: "execute_script",
  description:
    "Execute a multi-statement SQL script against a database. All statements are executed in sequence.",
  inputSchema: {
    type: "object",
    properties: {
      connection_string: {
        type: "string",
        description: 'Database connection URL or configured connection name (e.g., "oracle" for USQL_ORACLE)',
      },
      script: {
        type: "string",
        description:
          "Multi-line SQL script with one or more SQL statements separated by semicolons",
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
    required: ["script"],
  },
};

export async function handleExecuteScript(input: ExecuteScriptInput): Promise<RawOutput> {
  const outputFormat = input.output_format || "json";

  logger.debug("[execute-script] Handling request", {
    connectionStringInput: input.connection_string,
    scriptLength: input.script?.length || 0,
    statementCount: input.script?.split(";").filter((s) => s.trim()).length || 0,
    outputFormat,
  });

  let resolvedConnectionString: string | undefined;

  try {
    if (!input.script || typeof input.script !== "string") {
      throw createUsqlError("InvalidInput", "script is required and must be a string");
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

    // Validate script contains SQL
    const trimmedScript = input.script.trim();
    if (!trimmedScript) {
      throw createUsqlError("InvalidInput", "script cannot be empty");
    }

    // Check for potentially dangerous operations (basic check)
    const upperScript = trimmedScript.toUpperCase();
    const hasDropTable = upperScript.includes("DROP TABLE");
    const hasDropDatabase = upperScript.includes("DROP DATABASE");

    if (hasDropTable || hasDropDatabase) {
      logger.warn("[execute-script] Potentially destructive script detected", {
        hasDropTable,
        hasDropDatabase,
      });
      // We still allow it but log the warning for audit purposes
    }

    // Execute script
    const timeoutOverride =
      input.timeout_ms === null
        ? undefined
        : typeof input.timeout_ms === "number" && Number.isFinite(input.timeout_ms)
        ? input.timeout_ms
        : undefined;
    const timeout = timeoutOverride ?? getQueryTimeout();
    logger.debug("[execute-script] Executing script with timeout", { timeout, outputFormat });

    const result = await executeUsqlQuery(resolvedConnectionString, trimmedScript, {
      timeout,
      format: outputFormat,
    });

    logger.debug("[execute-script] Script executed", {
      exitCode: result.exitCode,
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
    });

    // Check for errors
    if (result.exitCode !== 0 && result.stderr) {
      const errorMessage = parseUsqlError(result.stderr);
      throw createUsqlError("ScriptExecutionError", errorMessage, {
        exitCode: result.exitCode,
        scriptLength: input.script.length,
      });
    }

    logger.debug("[execute-script] Script completed successfully", {
      outputFormat,
      contentLength: result.stdout.length,
    });

    return {
      format: outputFormat as "json" | "csv",
      content: result.stdout,
    };
  } catch (error) {
    const connectionForError = resolvedConnectionString ?? input.connection_string;
    const mcpError = formatMcpError(
      error,
      connectionForError || input.script
        ? {
            connectionString: connectionForError,
            scriptLength: input.script?.length,
          }
        : undefined
    );

    logger.error("[execute-script] Error executing script", error);
    throw mcpError;
  }
}
