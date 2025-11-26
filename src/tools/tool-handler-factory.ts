/**
 * Factory for creating tool handlers with common patterns
 * Reduces code duplication across tool implementations
 */

import { createLogger } from "../utils/logger.js";
import {
  createUsqlError,
  formatMcpError,
  sanitizeConnectionString,
} from "../utils/error-handler.js";
import { validateConnectionString } from "../usql/connection.js";
import { executeUsqlQuery } from "../usql/process-executor.js";
import { parseUsqlError } from "../usql/parser.js";
import { getQueryTimeout, resolveConnectionStringOrDefault } from "../usql/config.js";
import { RawOutput } from "../types/index.js";

/**
 * Configuration for creating a tool handler
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolHandlerConfig {
  name: string; // Tool name for logging
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getQuery: (input: any) => string; // Function to extract/build query from input
  errorType?: string; // Error type for errors (default: "ToolExecutionError")
  includeExitCodeInError?: boolean; // Whether to include exit code in error details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getErrorDetails?: (input: any, error?: Error) => Record<string, any>; // Function to extract additional error context from input
}

/**
 * Creates a tool handler function with common error handling and logging
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createToolHandler(config: ToolHandlerConfig) {
  const logger = createLogger(`usql-mcp:tools:${config.name}`);
  const errorType = config.errorType || "ToolExecutionError";
  const includeExitCode = config.includeExitCodeInError ?? true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (input: any): Promise<RawOutput> => {
    const outputFormat = (input.output_format || "json") as string;

    logger.debug(`[${config.name}] Handling request`, {
      connectionStringInput: input.connection_string,
      outputFormat,
    });

    let resolvedConnectionString: string | undefined;

    try {
      // Resolve connection string
      try {
        resolvedConnectionString = resolveConnectionStringOrDefault(input.connection_string);
      } catch (error) {
        throw createUsqlError(
          "InvalidConnection",
          `Failed to resolve connection: ${String(error)}`
        );
      }

      logger.debug(`[${config.name}] Resolved connection`, {
        connectionString: sanitizeConnectionString(resolvedConnectionString),
      });

      // Validate connection string
      if (!validateConnectionString(resolvedConnectionString)) {
        throw createUsqlError(
          "InvalidConnection",
          `Invalid connection string format: ${resolvedConnectionString}`
        );
      }

      // Get the query to execute
      let query: string;
      try {
        query = config.getQuery(input);
      } catch (error) {
        throw createUsqlError("InvalidInput", `Failed to build query: ${String(error)}`);
      }

      // Handle timeout
      const timeoutOverride =
        input.timeout_ms === null
          ? undefined
          : typeof input.timeout_ms === "number" && Number.isFinite(input.timeout_ms)
            ? input.timeout_ms
            : undefined;
      const timeout = timeoutOverride ?? getQueryTimeout();

      logger.debug(`[${config.name}] Executing with timeout`, { timeout, format: outputFormat });

      // Execute query
      const result = await executeUsqlQuery(resolvedConnectionString, query, {
        timeout,
        format: (outputFormat === "csv" ? "csv" : "json") as "json" | "csv",
      });

      logger.debug(`[${config.name}] Execution completed`, {
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stderrLength: result.stderr.length,
      });

      // Check for errors
      if (result.exitCode !== 0 && result.stderr) {
        const errorMessage = parseUsqlError(result.stderr);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorDetails: any = {};
        if (includeExitCode) {
          errorDetails.exitCode = result.exitCode;
        }
        throw createUsqlError(errorType, errorMessage, errorDetails);
      }

      logger.debug(`[${config.name}] Success`, { outputFormat });

      return {
        format: (outputFormat === "csv" ? "csv" : "json") as "json" | "csv",
        content: result.stdout,
      };
    } catch (error) {
      // Format error for MCP
      const connectionForError =
        resolvedConnectionString ?? (input.connection_string as string | undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorDetails: any = connectionForError
        ? {
            connectionString: sanitizeConnectionString(connectionForError),
          }
        : {};

      // Add custom error details if getErrorDetails is provided
      if (config.getErrorDetails) {
        const customDetails = config.getErrorDetails(
          input,
          error instanceof Error ? error : undefined
        );
        Object.assign(errorDetails, customDetails);
      }

      const mcpError = formatMcpError(
        error,
        Object.keys(errorDetails).length > 0 ? errorDetails : undefined
      );

      logger.error(`[${config.name}] Error executing tool`, error);
      throw mcpError;
    }
  };
}
