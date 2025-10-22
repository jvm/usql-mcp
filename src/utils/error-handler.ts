/**
 * Error handling and formatting for MCP protocol
 */

import { McpError } from "../types/index.js";
import { createLogger } from "./logger.js";

const logger = createLogger("usql-mcp:error");

export class UsqlError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "UsqlError";
  }
}

export function sanitizeConnectionString(conn: string): string {
  return conn.replace(/:([^@/]*?)@/, ":***@");
}

export function formatMcpError(error: unknown, context?: Record<string, unknown>): McpError {
  logger.debug("Formatting MCP error", { error, context });

  const sanitizedContext: Record<string, unknown> = {};
  if (context) {
    if (typeof context.connectionString === "string") {
      sanitizedContext.connectionString = sanitizeConnectionString(context.connectionString);
    }
    if (context.query) {
      sanitizedContext.query = context.query;
    }
    if (context.database) {
      sanitizedContext.database = context.database;
    }
    if (context.table) {
      sanitizedContext.table = context.table;
    }
    for (const [key, value] of Object.entries(context)) {
      if (key === "connectionString" || key === "query" || key === "database" || key === "table") {
        continue;
      }
      sanitizedContext[key] = value;
    }
  }

  const mergeDetails = (details?: Record<string, unknown>): Record<string, unknown> | undefined => {
    const hasContext = Object.keys(sanitizedContext).length > 0;
    if (!details && !hasContext) {
      return undefined;
    }
    return {
      ...(details ?? {}),
      ...(hasContext ? sanitizedContext : {}),
    };
  };

  if (error && typeof error === "object") {
    const maybe = error as Partial<McpError> & { code?: string };
    if (typeof maybe.error === "string" && typeof maybe.message === "string") {
      return {
        error: maybe.error,
        message: maybe.message,
        details: mergeDetails(maybe.details ? { ...maybe.details } : undefined),
      };
    }

    if (typeof maybe.code === "string" && typeof maybe.message === "string") {
      return {
        error: maybe.code,
        message: maybe.message,
        details: mergeDetails(maybe.details ? { ...maybe.details } : undefined),
      };
    }
  }

  if (error instanceof UsqlError) {
    return {
      error: error.code,
      message: error.message,
      details: mergeDetails(error.details),
    };
  }

  if (error instanceof Error) {
    // Check for common usql errors
    if (error.message.includes("ENOENT")) {
      return {
        error: "UsqlNotFound",
        message:
          "usql command not found. Please ensure usql is installed and in PATH. See https://github.com/xo/usql#installation",
        details: mergeDetails({ originalError: error.message }),
      };
    }

    if (error.message.includes("connection refused") || error.message.includes("ECONNREFUSED")) {
      return {
        error: "ConnectionError",
        message: "Database connection refused. Check host, port, and credentials.",
        details: mergeDetails({ originalError: error.message }),
      };
    }

    if (error.message.includes("timeout")) {
      return {
        error: "TimeoutError",
        message: "Query execution timed out. Consider simplifying the query or increasing timeout.",
        details: mergeDetails(undefined),
      };
    }

    // Generic database error
    return {
      error: "QueryError",
      message: error.message,
      details: mergeDetails(undefined),
    };
  }

  // Unknown error type
  return {
    error: "UnknownError",
    message: "An unexpected error occurred",
    details: mergeDetails({ originalError: String(error) }),
  };
}

export function createUsqlError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): UsqlError {
  return new UsqlError(code, message, details);
}
