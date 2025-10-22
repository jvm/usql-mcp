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

const logger = createLogger("usql-mcp:server");

class UsqlMcpServer {
  private server: Server;
  private tools = [
    executeQuerySchema,
    listDatabasesSchema,
    listTablesSchema,
    describeTableSchema,
    executeScriptSchema,
  ];

  constructor() {
    logger.debug("[server] Initializing MCP server");

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
      logger.debug("[server] Tool call", {
        tool: request.params.name,
      });

      try {
        const result = await this.executeTool(request.params.name, request.params.arguments);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const mcpError = formatMcpError(error);
        logger.error("[server] Tool execution error", error);

        return {
          content: [
            {
              type: "text",
              text: `${mcpError.error}: ${mcpError.message}`,
              isError: true,
            },
            ...(mcpError.details
              ? [
                  {
                    type: "text",
                    text: JSON.stringify(mcpError.details, null, 2),
                    isError: true,
                  },
                ]
              : []),
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

    process.on("SIGTERM", () => {
      logger.info("[server] Received SIGTERM, shutting down");
      process.exit(0);
    });

    process.on("SIGINT", () => {
      logger.info("[server] Received SIGINT, shutting down");
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
