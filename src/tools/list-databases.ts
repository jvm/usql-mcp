/**
 * list_databases tool - List all databases on a database server
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createToolHandler } from "./tool-handler-factory.js";
import { withBackgroundSupport } from "./background-wrapper.js";
import { detectDatabaseType, getListDatabasesCommand } from "../utils/database-mapper.js";
import { resolveConnectionStringOrDefault } from "../usql/config.js";

export const listDatabasesSchema: Tool = {
  name: "list_databases",
  description:
    "List all databases available on a database server. Uses default connection if none specified. Automatically detects the database type and uses the appropriate command.",
  inputSchema: {
    type: "object",
    properties: {
      connection_string: {
        type: "string",
        description:
          '(Optional) Database connection URL or configured connection name. If omitted, uses the default connection from USQL_DEFAULT_CONNECTION. Examples: "oracle" for USQL_ORACLE env var, or full URL like "postgres://localhost". Use get_server_info to discover available connections.',
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
};

const _handleListDatabases = createToolHandler({
  name: "list-databases",
  getQuery: (input) => {
    // Determine the database type from the connection string
    const connectionString = resolveConnectionStringOrDefault(
      (input as Record<string, unknown>).connection_string as string | undefined
    );
    const dbType = detectDatabaseType(connectionString);
    return getListDatabasesCommand(dbType);
  },
  errorType: "ListDatabasesError",
});

export const handleListDatabases = withBackgroundSupport("list_databases", _handleListDatabases);
