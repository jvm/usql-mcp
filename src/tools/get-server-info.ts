/**
 * get_server_info tool - Get server configuration and available connections
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createLogger } from "../utils/logger.js";
import { loadConfig, getDefaultConnectionName, getBackgroundThresholdMs, getJobResultTtlMs, getQueryTimeout } from "../usql/config.js";

const logger = createLogger("usql-mcp:tools:get-server-info");

export interface ServerInfo {
  default_connection?: string;
  available_connections: string[];
  background_execution_threshold_ms: number;
  job_result_ttl_ms: number;
  query_timeout_ms?: number;
}

export const getServerInfoSchema: Tool = {
  name: "get_server_info",
  description:
    "Get server configuration information including available database connections, default connection, and execution settings. Use this to discover what connections are available.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export async function handleGetServerInfo(): Promise<ServerInfo> {
  logger.debug("[get-server-info] Handling request");

  const config = loadConfig();
  const defaultConnection = getDefaultConnectionName();
  const backgroundThreshold = getBackgroundThresholdMs();
  const jobResultTtl = getJobResultTtlMs();
  const queryTimeout = getQueryTimeout();

  const availableConnections = Object.keys(config.connections).sort();

  const response: ServerInfo = {
    available_connections: availableConnections,
    background_execution_threshold_ms: backgroundThreshold,
    job_result_ttl_ms: jobResultTtl,
  };

  // Only include default_connection if one is configured
  if (defaultConnection) {
    response.default_connection = defaultConnection;
  }

  // Only include query timeout if one is configured
  if (typeof queryTimeout === "number") {
    response.query_timeout_ms = queryTimeout;
  }

  logger.debug("[get-server-info] Returning configuration", {
    hasDefault: !!defaultConnection,
    connectionCount: availableConnections.length,
    threshold: backgroundThreshold,
  });

  return response;
}
