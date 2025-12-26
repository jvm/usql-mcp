/**
 * Read resource handler - retrieves resource contents
 */

import { parseResourceUri, validateConnectionName, ResourceUriError } from "./uri-parser.js";
import { loadConfig, resolveConnectionString } from "../usql/config.js";
import { executeUsqlQuery } from "../usql/process-executor.js";
import { getListDatabasesCommand, getListTablesCommand, getDescribeTableCommand, detectDatabaseType } from "../utils/database-mapper.js";
import { createLogger } from "../utils/logger.js";
import { parseUsqlError } from "../usql/parser.js";
import { createUsqlError } from "../utils/error-handler.js";

const logger = createLogger("usql-mcp:resources:read");

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
}

/**
 * Read a resource by URI
 */
export async function readResource(uri: string): Promise<ResourceContent> {
  logger.debug("[read-resource] Reading resource", { uri });

  try {
    const parsed = parseResourceUri(uri);
    const config = loadConfig();
    const availableConnections = Object.keys(config.connections);

    switch (parsed.resourceType) {
      case "connections":
        return readConnectionsList(uri, availableConnections);

      case "databases":
        if (!parsed.connection) {
          throw new ResourceUriError("Connection is required for databases resource");
        }
        validateConnectionName(parsed.connection, availableConnections);
        return await readDatabasesList(uri, parsed.connection);

      case "tables":
        if (!parsed.connection || !parsed.database) {
          throw new ResourceUriError("Connection and database are required for tables resource");
        }
        validateConnectionName(parsed.connection, availableConnections);
        return await readTablesList(uri, parsed.connection, parsed.database);

      case "table":
        if (!parsed.connection || !parsed.database || !parsed.table) {
          throw new ResourceUriError("Connection, database, and table are required for table resource");
        }
        validateConnectionName(parsed.connection, availableConnections);
        return await readTableSchema(uri, parsed.connection, parsed.database, parsed.table);

      default:
        throw new ResourceUriError(`Unknown resource type: ${parsed.resourceType}`);
    }
  } catch (error) {
    logger.error("[read-resource] Error reading resource", { uri, error });
    throw error;
  }
}

/**
 * Read the list of available connections
 */
function readConnectionsList(uri: string, connections: string[]): ResourceContent {
  const content = {
    connections: connections.map((name) => ({
      name,
      uri: `sql://${name}/databases`,
    })),
  };

  return {
    uri,
    mimeType: "application/json",
    text: JSON.stringify(content, null, 2),
  };
}

/**
 * Read the list of databases for a connection
 */
async function readDatabasesList(uri: string, connection: string): Promise<ResourceContent> {
  logger.debug("[read-databases] Listing databases", { connection });

  const connectionString = resolveConnectionString(connection);
  const dbType = detectDatabaseType(connectionString);
  const query = getListDatabasesCommand(dbType);

  const result = await executeUsqlQuery(connectionString, query, {
    format: "json",
    timeout: 30000,
  });

  if (result.exitCode !== 0 && result.stderr) {
    const errorMessage = parseUsqlError(result.stderr);
    throw createUsqlError("ListDatabasesError", errorMessage, { exitCode: result.exitCode });
  }

  return {
    uri,
    mimeType: "application/json",
    text: result.stdout,
  };
}

/**
 * Read the list of tables for a database
 */
async function readTablesList(
  uri: string,
  connection: string,
  database: string
): Promise<ResourceContent> {
  logger.debug("[read-tables] Listing tables", { connection, database });

  // Build connection string with database
  const baseConnectionString = resolveConnectionString(connection);
  const connectionString = buildConnectionStringWithDatabase(baseConnectionString, database);

  const dbType = detectDatabaseType(connectionString);
  const query = getListTablesCommand(dbType);

  const result = await executeUsqlQuery(connectionString, query, {
    format: "json",
    timeout: 30000,
  });

  if (result.exitCode !== 0 && result.stderr) {
    const errorMessage = parseUsqlError(result.stderr);
    throw createUsqlError("ListTablesError", errorMessage, { exitCode: result.exitCode });
  }

  return {
    uri,
    mimeType: "application/json",
    text: result.stdout,
  };
}

/**
 * Read the schema for a specific table
 */
async function readTableSchema(
  uri: string,
  connection: string,
  database: string,
  table: string
): Promise<ResourceContent> {
  logger.debug("[read-table-schema] Describing table", { connection, database, table });

  // Build connection string with database
  const baseConnectionString = resolveConnectionString(connection);
  const connectionString = buildConnectionStringWithDatabase(baseConnectionString, database);

  const dbType = detectDatabaseType(connectionString);
  const query = getDescribeTableCommand(dbType, table);

  const result = await executeUsqlQuery(connectionString, query, {
    format: "json",
    timeout: 30000,
  });

  if (result.exitCode !== 0 && result.stderr) {
    const errorMessage = parseUsqlError(result.stderr);
    throw createUsqlError("DescribeTableError", errorMessage, { exitCode: result.exitCode, table });
  }

  if (!result.stdout.trim()) {
    throw createUsqlError("TableNotFound", `Table not found: ${table}`, { table });
  }

  return {
    uri,
    mimeType: "application/json",
    text: result.stdout,
  };
}

/**
 * Build a connection string with a database appended
 */
function buildConnectionStringWithDatabase(baseConnectionString: string, database: string): string {
  // Parse the connection string to add database
  try {
    const url = new URL(baseConnectionString);

    // For most databases, append the database to the path
    if (!url.pathname || url.pathname === "/") {
      url.pathname = `/${database}`;
    } else if (!url.pathname.endsWith(database)) {
      // If path exists but doesn't end with database, replace it
      url.pathname = `/${database}`;
    }

    return url.toString();
  } catch (error) {
    // If not a valid URL, just append the database
    // This handles cases like "postgres://localhost" -> "postgres://localhost/dbname"
    if (baseConnectionString.endsWith("/")) {
      return baseConnectionString + database;
    }
    return baseConnectionString + "/" + database;
  }
}
