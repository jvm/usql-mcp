/**
 * Configuration loader for usql-mcp
 * Loads config from file and environment variables
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { UsqlConfig, ConnectionConfig } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("usql-mcp:config");

let cachedConfig: UsqlConfig | null = null;

export function loadConfig(): UsqlConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const config: UsqlConfig = {
    connections: {},
    defaults: {
      queryTimeout: undefined,
      maxResultRows: 10000,
      defaultConnection: undefined,
    },
  };

  // Load from config file if present
  const configPath = process.env.USQL_CONFIG_PATH || "./config.json";
  try {
    const fullPath = resolve(configPath);
    const content = readFileSync(fullPath, "utf-8");
    const fileConfig = JSON.parse(content) as UsqlConfig;

    logger.debug("[config] Loaded config from file", { path: configPath });

    if (fileConfig.connections) {
      config.connections = { ...config.connections, ...fileConfig.connections };
    }
    if (fileConfig.defaults) {
      config.defaults = { ...config.defaults, ...fileConfig.defaults };
    }
  } catch (error) {
    if (process.env.USQL_CONFIG_PATH) {
      // Only warn if explicitly configured
      logger.warn(
        "[config] Could not load config file",
        error instanceof Error ? error.message : String(error)
      );
    } else {
      logger.debug("[config] Config file not found (using defaults)");
    }
  }

  // Load from environment variables
  // USQL_* env vars are added as connections
  for (const [key, value] of Object.entries(process.env)) {
    if (
      key.startsWith("USQL_") &&
      key !== "USQL_CONFIG_PATH" &&
      key !== "USQL_QUERY_TIMEOUT_MS" &&
      key !== "USQL_DEFAULT_CONNECTION" &&
      value
    ) {
      const connectionName = key.substring(5).toLowerCase();
      config.connections[connectionName] = {
        uri: value,
        description: `Connection from ${key} environment variable`,
      };
      logger.debug("[config] Loaded connection from env var", { name: connectionName });
    }
  }

  // Override defaults from environment
  if (process.env.USQL_QUERY_TIMEOUT_MS) {
    const timeout = parseInt(process.env.USQL_QUERY_TIMEOUT_MS, 10);
    if (!isNaN(timeout) && config.defaults) {
      config.defaults.queryTimeout = timeout;
      logger.debug("[config] Set query timeout from env var", { timeout });
    }
  }

  if (process.env.USQL_DEFAULT_CONNECTION) {
    const defaultConnection = process.env.USQL_DEFAULT_CONNECTION.toLowerCase();
    if (config.defaults) {
      config.defaults.defaultConnection = defaultConnection;
      logger.debug("[config] Set default connection from env var", { defaultConnection });
    }
  }

  cachedConfig = config;
  logger.debug("[config] Config loaded", {
    connections: Object.keys(config.connections).length,
    queryTimeout: config.defaults?.queryTimeout,
    defaultConnection: config.defaults?.defaultConnection,
  });

  return config;
}

export function getConnection(nameOrUri: string): ConnectionConfig | null {
  const config = loadConfig();

  // If it looks like a connection URI, return it directly
  if (nameOrUri.includes("://")) {
    return { uri: nameOrUri };
  }

  // Otherwise, look it up by name
  const connection = config.connections[nameOrUri.toLowerCase()];
  return connection || null;
}

export function resolveConnectionString(nameOrUri: string): string {
  const connection = getConnection(nameOrUri);
  if (!connection) {
    throw new Error(
      `Connection not found: ${nameOrUri}. Available connections: ${Object.keys(loadConfig().connections).join(", ")}`
    );
  }
  return connection.uri;
}

export function getQueryTimeout(): number | undefined {
  const config = loadConfig();
  return config.defaults?.queryTimeout;
}

export function getDefaultConnectionName(): string | undefined {
  const config = loadConfig();
  return config.defaults?.defaultConnection;
}

export function resolveConnectionStringOrDefault(nameOrUri?: string): string {
  if (nameOrUri && typeof nameOrUri === "string" && nameOrUri.trim().length > 0) {
    return resolveConnectionString(nameOrUri);
  }

  const defaultConnection = getDefaultConnectionName();
  if (!defaultConnection) {
    throw new Error(
      "No connection string provided and no default connection configured. Set USQL_DEFAULT_CONNECTION or defaults.defaultConnection."
    );
  }

  return resolveConnectionString(defaultConnection);
}

// Test-only helper to clear cached configuration
export function resetConfigCache(): void {
  cachedConfig = null;
}
