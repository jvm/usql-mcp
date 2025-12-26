/**
 * get_server_info tool - Get server configuration and available connections
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createLogger } from "../utils/logger.js";
import {
  loadConfig,
  getDefaultConnectionName,
  getBackgroundThresholdMs,
  getJobResultTtlMs,
  getQueryTimeout,
  getMaxResultBytes,
  getRateLimitRpm,
  getMaxConcurrentRequests,
  getSchemaCacheTtl,
} from "../usql/config.js";
import { getServerInfoOutputSchema } from "./output-schemas.js";
import { getSchemaCacheStats } from "../cache/schema-cache.js";

const logger = createLogger("usql-mcp:tools:get-server-info");

export interface ServerInfo {
  default_connection?: string;
  available_connections: string[];
  background_execution_threshold_ms: number;
  job_result_ttl_ms: number;
  query_timeout_ms?: number;
  max_result_bytes: number;
  rate_limit_rpm?: number;
  max_concurrent_requests: number;
  schema_cache_ttl_ms?: number;
  schema_cache_stats?: {
    hits: number;
    misses: number;
    size: number;
    hit_rate: number;
  };
  elapsed_ms_scope: string;
}

export const getServerInfoSchema: Tool = {
  name: "get_server_info",
  title: "Get Server Configuration",
  description:
    "Get server configuration information including available database connections, default connection, and execution settings. " +
    "Use this to discover what connections are available and configured. " +
    "Returns background execution threshold, job TTL, query timeout, and other server settings. " +
    "No parameters required - this is a read-only operation.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
  outputSchema: getServerInfoOutputSchema as any,
};

export async function handleGetServerInfo(): Promise<ServerInfo> {
  logger.debug("[get-server-info] Handling request");

  const config = loadConfig();
  const defaultConnection = getDefaultConnectionName();
  const backgroundThreshold = getBackgroundThresholdMs();
  const jobResultTtl = getJobResultTtlMs();
  const queryTimeout = getQueryTimeout();
  const maxResultBytes = getMaxResultBytes();
  const rateLimitRpm = getRateLimitRpm();
  const maxConcurrent = getMaxConcurrentRequests();
  const schemaCacheTtl = getSchemaCacheTtl();

  const availableConnections = Object.keys(config.connections).sort();

  const response: ServerInfo = {
    available_connections: availableConnections,
    background_execution_threshold_ms: backgroundThreshold,
    job_result_ttl_ms: jobResultTtl,
    max_result_bytes: maxResultBytes,
    max_concurrent_requests: maxConcurrent,
    elapsed_ms_scope:
      "Per-process: elapsed_ms is computed from job start to completion/now within the current server lifetime.",
  };

  // Only include default_connection if one is configured
  if (defaultConnection) {
    response.default_connection = defaultConnection;
  }

  // Only include query timeout if one is configured
  if (typeof queryTimeout === "number") {
    response.query_timeout_ms = queryTimeout;
  }

  // Only include rate limit if configured
  if (rateLimitRpm !== null && rateLimitRpm > 0) {
    response.rate_limit_rpm = rateLimitRpm;
  }

  // Only include schema cache TTL if configured
  if (schemaCacheTtl !== null && schemaCacheTtl > 0) {
    response.schema_cache_ttl_ms = schemaCacheTtl;

    // Include cache stats if cache is enabled
    const cacheStats = getSchemaCacheStats();
    if (cacheStats) {
      response.schema_cache_stats = {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        size: cacheStats.size,
        hit_rate: Math.round(cacheStats.hitRate * 1000) / 1000, // Round to 3 decimals
      };
    }
  }

  logger.debug("[get-server-info] Returning configuration", {
    hasDefault: !!defaultConnection,
    connectionCount: availableConnections.length,
    threshold: backgroundThreshold,
    rateLimitRpm,
    schemaCacheTtl,
  });

  return response;
}
