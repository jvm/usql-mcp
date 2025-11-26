/**
 * list_tables tool - List tables in a database
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createToolHandler } from "./tool-handler-factory.js";
import { withBackgroundSupport } from "./background-wrapper.js";
import { detectDatabaseType, getListTablesCommand } from "../utils/database-mapper.js";
import { resolveConnectionStringOrDefault } from "../usql/config.js";

export const listTablesSchema: Tool = {
  name: "list_tables",
  description: "List all tables in a database. Uses default connection if none specified. Automatically detects the database type and uses the appropriate command.",
  inputSchema: {
    type: "object",
    properties: {
      connection_string: {
        type: "string",
        description:
          '(Optional) Database connection URL or configured connection name. If omitted, uses the default connection from USQL_DEFAULT_CONNECTION (e.g., "oracle" for USQL_ORACLE). Use get_server_info to discover available connections.',
      },
      database: {
        type: "string",
        description: "Optional database name to list tables from (if not specified in connection)",
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

const _handleListTables = createToolHandler({
  name: "list-tables",
  getQuery: (input) => {
    // Determine the database type from the connection string
    const connectionString = resolveConnectionStringOrDefault(
      (input as Record<string, unknown>).connection_string as string | undefined
    );
    const dbType = detectDatabaseType(connectionString);
    return getListTablesCommand(dbType);
  },
  errorType: "ListTablesError",
  getErrorDetails: (input) => ({
    ...(input.database && { database: input.database }),
  }),
});

export const handleListTables = withBackgroundSupport("list_tables", _handleListTables);
