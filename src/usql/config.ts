/**
 * Configuration loader for usql-mcp
 * Loads config from file and environment variables with validation
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { UsqlConfig, ConnectionConfig } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { validateConfig, ConfigValidationError } from "../utils/config-validator.js";

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
      backgroundThresholdMs: 30000, // 30 seconds default
      jobResultTtlMs: 3600000, // 1 hour default
    },
  };

  // Load from config file if present
  const configPath = process.env.USQL_CONFIG_PATH || "./config.json";
  try {
    const fullPath = resolve(configPath);
    const content = readFileSync(fullPath, "utf-8");
    const rawConfig = JSON.parse(content);

    // Validate the config file format
    let fileConfig: UsqlConfig;
    try {
      // Extract top-level settings for validation (ignore nested connections/defaults)
      const settingsToValidate: Record<string, unknown> = {};
      if ("queryTimeoutMs" in rawConfig) settingsToValidate.queryTimeoutMs = rawConfig.queryTimeoutMs;
      if ("jobResultTtlMs" in rawConfig) settingsToValidate.jobResultTtlMs = rawConfig.jobResultTtlMs;
      if ("allowDestructiveOperations" in rawConfig) settingsToValidate.allowDestructiveOperations = rawConfig.allowDestructiveOperations;

      const validated = validateConfig(settingsToValidate);
      logger.debug("[config] Config file validation passed", { path: configPath });

      // Transform validated config into UsqlConfig format
      fileConfig = {
        connections: {},
        defaults: {
          queryTimeout: validated.queryTimeoutMs,
          maxResultRows: 10000,
          defaultConnection: undefined,
          backgroundThresholdMs: 30000,
          jobResultTtlMs: validated.jobResultTtlMs || 3600000,
        },
      };

      // Handle connections from config file if present
      if (rawConfig.connections && typeof rawConfig.connections === "object") {
        for (const [name, connConfig] of Object.entries(rawConfig.connections)) {
          if (connConfig && typeof connConfig === "object") {
            const conn = connConfig as Record<string, unknown>;
            fileConfig.connections[name.toLowerCase()] = {
              uri: (conn.uri as string) || "",
              description: conn.description as string | undefined,
            };
          }
        }
      }

      // Handle defaults from config file if present
      if (rawConfig.defaults && typeof rawConfig.defaults === "object") {
        const defaults = rawConfig.defaults as Record<string, unknown>;
        if (fileConfig.defaults) {
          if (defaults.queryTimeout !== undefined && typeof defaults.queryTimeout === "number") {
            fileConfig.defaults.queryTimeout = defaults.queryTimeout;
          }
          if (defaults.maxResultRows !== undefined && typeof defaults.maxResultRows === "number") {
            fileConfig.defaults.maxResultRows = defaults.maxResultRows;
          }
          if (defaults.defaultConnection !== undefined && typeof defaults.defaultConnection === "string") {
            fileConfig.defaults.defaultConnection = defaults.defaultConnection.toLowerCase();
          }
        }
      }
    } catch (validationError) {
      if (validationError instanceof ConfigValidationError) {
        logger.error("[config] Config validation failed", validationError.message);
        throw new Error(`Invalid config.json: ${validationError.message}`);
      }
      throw validationError;
    }

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
      key !== "USQL_BINARY_PATH" &&
      key !== "USQL_BACKGROUND_THRESHOLD_MS" &&
      key !== "USQL_JOB_RESULT_TTL_MS" &&
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

  if (process.env.USQL_BACKGROUND_THRESHOLD_MS) {
    const threshold = parseInt(process.env.USQL_BACKGROUND_THRESHOLD_MS, 10);
    if (!isNaN(threshold) && config.defaults) {
      config.defaults.backgroundThresholdMs = threshold;
      logger.debug("[config] Set background threshold from env var", { threshold });
    }
  }

  if (process.env.USQL_JOB_RESULT_TTL_MS) {
    const ttl = parseInt(process.env.USQL_JOB_RESULT_TTL_MS, 10);
    if (!isNaN(ttl) && config.defaults) {
      config.defaults.jobResultTtlMs = ttl;
      logger.debug("[config] Set job result TTL from env var", { ttl });
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

export function getBackgroundThresholdMs(): number {
  const config = loadConfig();
  return config.defaults?.backgroundThresholdMs ?? 30000;
}

export function getJobResultTtlMs(): number {
  const config = loadConfig();
  return config.defaults?.jobResultTtlMs ?? 3600000;
}

export function getSafetyConfig(): {
  allowDestructiveOperations: boolean;
  blockHighRiskQueries: boolean;
  blockCriticalRiskQueries: boolean;
  requireWhereClauseForDelete: boolean;
} {
  const config = loadConfig();
  return {
    allowDestructiveOperations: config.defaults?.allowDestructiveOperations ?? true,
    blockHighRiskQueries: config.defaults?.blockHighRiskQueries ?? false,
    blockCriticalRiskQueries: config.defaults?.blockCriticalRiskQueries ?? false,
    requireWhereClauseForDelete: config.defaults?.requireWhereClauseForDelete ?? false,
  };
}

export function getMaxResultBytes(): number {
  const config = loadConfig();
  return config.defaults?.maxResultBytes ?? 10485760; // 10MB default
}

export function getRateLimitRpm(): number | null {
  const config = loadConfig();
  const rpm = config.defaults?.rateLimitRpm;
  return rpm !== undefined ? rpm : null; // null means no rate limiting
}

export function getMaxConcurrentRequests(): number {
  const config = loadConfig();
  return config.defaults?.maxConcurrentRequests ?? 10;
}

export function getSchemaCacheTtl(): number | null {
  const config = loadConfig();
  const ttl = config.defaults?.schemaCacheTtl;
  return ttl !== undefined ? ttl : null; // null means no caching
}

export function resolveConnectionStringOrDefault(nameOrUri?: string): string {
  if (nameOrUri && typeof nameOrUri === "string" && nameOrUri.trim().length > 0) {
    return resolveConnectionString(nameOrUri);
  }

  const defaultConnection = getDefaultConnectionName();
  if (!defaultConnection) {
    const availableConnections = Object.keys(loadConfig().connections);
    const availableStr =
      availableConnections.length > 0
        ? `Available connections: ${availableConnections.join(", ")}. `
        : "No named connections are configured. ";
    throw new Error(
      `No connection string provided and no default connection configured. ${availableStr}` +
        `Set USQL_DEFAULT_CONNECTION environment variable or provide a connection_string parameter to the tool. ` +
        `Use get_server_info to see available options.`
    );
  }

  return resolveConnectionString(defaultConnection);
}

// Test-only helper to clear cached configuration
export function resetConfigCache(): void {
  cachedConfig = null;
}
