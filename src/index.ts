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
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
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
import {
  getJobResultTtlMs,
  getRateLimitRpm,
  getSchemaCacheTtl,
} from "./usql/config.js";

// Import enhancements
import { initializeRateLimiter, shutdownRateLimiter } from "./utils/rate-limiter.js";
import { initializeSchemaCache, shutdownSchemaCache } from "./cache/schema-cache.js";

// Import resource handlers
import { listResources, listResourceTemplates, readResource } from "./resources/index.js";

// Import prompt handlers
import { listPrompts, getPrompt } from "./prompts/index.js";

// Import notification handlers
import { initializeListChangedNotifier } from "./notifications/list-changed-notifier.js";

// Import request tracking
import { cancelAllRequests } from "./utils/request-tracker.js";

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

    // Initialize rate limiter if configured
    const rateLimitRpm = getRateLimitRpm();
    if (rateLimitRpm !== null && rateLimitRpm > 0) {
      initializeRateLimiter(rateLimitRpm);
      logger.debug("[server] Rate limiter initialized", { rateLimitRpm });
    }

    // Initialize schema cache if configured
    const schemaCacheTtl = getSchemaCacheTtl();
    if (schemaCacheTtl !== null && schemaCacheTtl > 0) {
      initializeSchemaCache(schemaCacheTtl);
      logger.debug("[server] Schema cache initialized", { schemaCacheTtl });
    }

    this.server = new Server(
      {
        name: "usql-mcp",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {
            listChanged: true,
          },
          resources: {
            listChanged: true,
          },
          prompts: {
            listChanged: true,
          },
        },
      }
    );

    // Initialize list changed notifier
    initializeListChangedNotifier(this.server);

    // Setup request handlers
    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.setupPromptHandlers();
    this.setupCancellationHandler();
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
              text: JSON.stringify(resultWithTiming),
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
          elapsed_ms: elapsedMs,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorResponse),
              isError: true,
            },
          ],
        };
      }
    });
  }

  private setupResourceHandlers(): void {
    logger.debug("[server] Setting up resource handlers");

    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.debug("[server] Listing resources");
      try {
        const resources = await listResources();
        logger.debug("[server] Found resources", { count: resources.length });
        return { resources };
      } catch (error) {
        logger.error("[server] Error listing resources", error);
        throw formatMcpError(error);
      }
    });

    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      logger.debug("[server] Reading resource", { uri });

      try {
        const content = await readResource(uri);
        logger.debug("[server] Resource read successfully", { uri });

        return {
          contents: [
            {
              uri: content.uri,
              mimeType: content.mimeType,
              text: content.text,
            },
          ],
        };
      } catch (error) {
        logger.error("[server] Error reading resource", { uri, error });
        throw formatMcpError(error);
      }
    });

    // List resource templates handler
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      logger.debug("[server] Listing resource templates");
      try {
        const templates = listResourceTemplates();
        logger.debug("[server] Found resource templates", { count: templates.length });
        return { resourceTemplates: templates };
      } catch (error) {
        logger.error("[server] Error listing resource templates", error);
        throw formatMcpError(error);
      }
    });
  }

  private setupPromptHandlers(): void {
    logger.debug("[server] Setting up prompt handlers");

    // List prompts handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.debug("[server] Listing prompts");
      try {
        const prompts = listPrompts();
        logger.debug("[server] Found prompts", { count: prompts.length });
        return { prompts };
      } catch (error) {
        logger.error("[server] Error listing prompts", error);
        throw formatMcpError(error);
      }
    });

    // Get prompt handler
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.debug("[server] Getting prompt", { name, args });

      try {
        const prompt = getPrompt(name, args ?? {});
        logger.debug("[server] Prompt retrieved successfully", { name });
        return prompt;
      } catch (error) {
        logger.error("[server] Error getting prompt", { name, error });
        throw formatMcpError(error);
      }
    });
  }

  private setupCancellationHandler(): void {
    logger.debug("[server] Setting up cancellation handler");

    // Handle $/cancelRequest notifications
    // Note: This uses server.notification() to receive cancellation requests
    // The MCP SDK doesn't have a specific schema for this, but we can set up
    // a generic notification handler
    // For now, we track requests but cancellation will need SDK support

    // The request tracking is integrated into tool execution
  }

  private setupErrorHandling(): void {
    logger.debug("[server] Setting up error handling");

    this.server.onerror = (error): void => {
      logger.error("[server] Server error", error);
    };

    const gracefulShutdown = (): void => {
      logger.info("[server] Shutting down, cleaning up resources");

      // Cancel all in-flight requests
      cancelAllRequests();

      // Cancel background jobs
      const jobManager = getJobManager();
      const runningJobs = jobManager.getRunningJobs();
      if (runningJobs.length > 0) {
        logger.info("[server] Cancelling background jobs", { count: runningJobs.length });
      }
      shutdownJobManager();

      // Shutdown enhancements
      shutdownRateLimiter();
      shutdownSchemaCache();
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
