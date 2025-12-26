/**
 * List resources handler - returns available resources
 */

import { loadConfig } from "../usql/config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("usql-mcp:resources:list");

export interface ResourceListItem {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * List all available resources
 */
export async function listResources(): Promise<ResourceListItem[]> {
  logger.debug("[list-resources] Listing all resources");

  const config = loadConfig();
  const connections = Object.keys(config.connections);

  const resources: ResourceListItem[] = [];

  // Add the connections list resource
  resources.push({
    uri: "sql://connections",
    name: "Available Database Connections",
    description: "List of all configured database connections",
    mimeType: "application/json",
  });

  // Add a databases resource for each connection
  for (const connection of connections) {
    resources.push({
      uri: `sql://${connection}/databases`,
      name: `Databases on ${connection}`,
      description: `List of databases available on the ${connection} connection`,
      mimeType: "application/json",
    });
  }

  logger.debug("[list-resources] Found resources", { count: resources.length });

  return resources;
}

/**
 * List resource templates
 * These are URI patterns that can be filled in with parameters
 */
export function listResourceTemplates(): ResourceTemplate[] {
  return [
    {
      uriTemplate: "sql://connections",
      name: "Database Connections",
      description: "List of all configured database connections",
      mimeType: "application/json",
    },
    {
      uriTemplate: "sql://{connection}/databases",
      name: "Databases",
      description: "List of databases on a specific connection",
      mimeType: "application/json",
    },
    {
      uriTemplate: "sql://{connection}/{database}/tables",
      name: "Tables",
      description: "List of tables in a specific database",
      mimeType: "application/json",
    },
    {
      uriTemplate: "sql://{connection}/{database}/table/{table}",
      name: "Table Schema",
      description: "Detailed schema information for a specific table",
      mimeType: "application/json",
    },
  ];
}

export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}
