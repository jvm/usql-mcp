#!/usr/bin/env node

/**
 * Main MCP Server for usql
 * Exposes usql capabilities as MCP tools
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { createLogger } from "./utils/logger.js";
import { formatMcpError } from "./utils/error-handler.js";

// Import tool schemas and handlers
import { executeQuerySchema, handleExecuteQuery } from "./tools/execute-query.js";
import { listDatabasesSchema, handleListDatabases } from "./tools/list-databases.js";
import { listTablesSchema, handleListTables } from "./tools/list-tables.js";
import { describeTableSchema, handleDescribeTable } from "./tools/describe-table.js";
import { executeScriptSchema, handleExecuteScript } from "./tools/execute-script.js";
import { getJobStatusSchema, handleGetJobStatus } from "./tools/get-job-status.js";
import { getServerInfoSchema, handleGetServerInfo } from "./tools/get-server-info.js";
import { cancelJobSchema, handleCancelJob } from "./tools/cancel-job.js";

// Import job manager
import { initializeJobManager, shutdownJobManager, getJobManager } from "./usql/job-manager.js";
import { getJobResultTtlMs } from "./usql/config.js";

const logger = createLogger("usql-mcp:server");

class UsqlMcpServer {
  private server: Server;
  private tools = [
    executeQuerySchema,
    listDatabasesSchema,
    listTablesSchema,
    describeTableSchema,
    executeScriptSchema,
    getJobStatusSchema,
    getServerInfoSchema,
    cancelJobSchema,
  ];

  constructor() {
    logger.debug("[server] Initializing MCP server");

    // Initialize job manager with configured TTL
    const jobResultTtl = getJobResultTtlMs();
    initializeJobManager(jobResultTtl);

    this.server = new Server(
      {
        name: "usql-mcp",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Setup request handlers
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    logger.debug("[server] Setting up tool handlers");

    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug("[server] Listing tools", {
        toolCount: this.tools.length,
        tools: this.tools.map((t) => t.name),
      });
      return {
        tools: this.tools,
      };
    });

    // Tool call handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const requestStartTime = Date.now();

      logger.debug("[server] Tool call", {
        tool: request.params.name,
      });

      try {
        const result = await this.executeTool(request.params.name, request.params.arguments);

        const requestEndTime = Date.now();
        const elapsedMs = requestEndTime - requestStartTime;

        // Add elapsed_ms to the result
        const resultWithTiming = {
          ...(typeof result === "object" && result !== null ? result : {}),
          elapsed_ms: elapsedMs,
        };

        logger.debug("[server] Tool execution completed", {
          tool: request.params.name,
          elapsedMs,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(resultWithTiming, null, 2),
            },
          ],
        };
      } catch (error) {
        const requestEndTime = Date.now();
        const elapsedMs = requestEndTime - requestStartTime;

        const mcpError = formatMcpError(error);
        logger.error("[server] Tool execution error", {
          error,
          elapsedMs,
        });

        // Add elapsed_ms to error response
        const errorResponse = {
          error: mcpError.error,
          message: mcpError.message,
          ...(mcpError.details ? { details: mcpError.details } : {}),
          elapsed_ms: elapsedMs,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorResponse, null, 2),
              isError: true,
            },
          ],
        };
      }
    });
  }

  private setupErrorHandling(): void {
    logger.debug("[server] Setting up error handling");

    this.server.onerror = (error): void => {
      logger.error("[server] Server error", error);
    };

    const gracefulShutdown = () => {
      logger.info("[server] Shutting down, cleaning up job manager");
      const jobManager = getJobManager();
      const runningJobs = jobManager.getRunningJobs();
      if (runningJobs.length > 0) {
        logger.info("[server] Cancelling background jobs", { count: runningJobs.length });
      }
      shutdownJobManager();
    };

    process.on("SIGTERM", () => {
      logger.info("[server] Received SIGTERM, shutting down");
      gracefulShutdown();
      process.exit(0);
    });

    process.on("SIGINT", () => {
      logger.info("[server] Received SIGINT, shutting down");
      gracefulShutdown();
      process.exit(0);
    });
  }

  private async executeTool(toolName: string, input: unknown): Promise<unknown> {
    logger.debug("[server] Executing tool", { toolName });

    switch (toolName) {
      case "execute_query":
        return await handleExecuteQuery(input as Parameters<typeof handleExecuteQuery>[0]);

      case "list_databases":
        return await handleListDatabases(input as Parameters<typeof handleListDatabases>[0]);

      case "list_tables":
        return await handleListTables(input as Parameters<typeof handleListTables>[0]);

      case "describe_table":
        return await handleDescribeTable(input as Parameters<typeof handleDescribeTable>[0]);

      case "execute_script":
        return await handleExecuteScript(input as Parameters<typeof handleExecuteScript>[0]);

      case "get_job_status":
        return await handleGetJobStatus(input as Parameters<typeof handleGetJobStatus>[0]);

      case "get_server_info":
        return await handleGetServerInfo();

      case "cancel_job":
        return await handleCancelJob(input as Parameters<typeof handleCancelJob>[0]);

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
  }

  public async run(): Promise<void> {
    logger.info("[server] Starting MCP server");

    const transport = new StdioServerTransport();

    // Connect server to transport
    await this.server.connect(transport);

    logger.info("[server] MCP server running on stdio transport");

    // Keep the server running
    await new Promise(() => {
      // This promise never resolves, keeping the process alive
    });
  }
}

// Main entry point
async function main(): Promise<void> {
  try {
    const server = new UsqlMcpServer();
    await server.run();
  } catch (error) {
    logger.error("[server] Fatal error", error);
    process.exit(1);
  }
}

main();
