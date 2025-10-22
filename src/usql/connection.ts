/**
 * Connection string validation and parsing
 * Supports dburl format: https://github.com/xo/dburl
 */

import { createLogger } from "../utils/logger.js";
import { createUsqlError } from "../utils/error-handler.js";

const logger = createLogger("usql-mcp:connection");

interface ParsedConnection {
  scheme: string;
  driver: string;
  host?: string;
  port?: string;
  database?: string;
  username?: string;
  password?: string;
  originalUri: string;
}

const SUPPORTED_SCHEMES = new Set([
  "postgres",
  "postgresql",
  "mysql",
  "mariadb",
  "sqlite",
  "sqlserver",
  "oracle",
  "cockroachdb",
  "csv",
  "tsv",
  "file",
  "presto",
  "mongodb",
  "cassandra",
  "clickhouse",
  "duckdb",
  "firebird",
  "sybase",
  "server",
  "mssql",
  "oci",
  "odbc",
]);

export function parseConnectionString(uri: string): ParsedConnection {
  logger.debug("[connection] Parsing connection string", { uri });

  if (!uri || typeof uri !== "string") {
    throw createUsqlError("InvalidConnection", "Connection string must be a non-empty string");
  }

  // Parse basic URI structure
  const uriRegex = /^([a-z0-9]+):\/\/(.*)$/i;
  const match = uri.match(uriRegex);

  if (!match) {
    throw createUsqlError("InvalidConnection", `Invalid connection string format: ${uri}`);
  }

  const scheme = match[1].toLowerCase();
  const rest = match[2];

  if (!SUPPORTED_SCHEMES.has(scheme)) {
    throw createUsqlError(
      "UnsupportedDatabase",
      `Unsupported database scheme: ${scheme}. Supported: ${Array.from(SUPPORTED_SCHEMES).join(", ")}`
    );
  }

  // Parse authority and path
  let authority = rest;
  let pathPart = "";

  const slashIndex = rest.indexOf("/");
  if (slashIndex !== -1) {
    authority = rest.substring(0, slashIndex);
    pathPart = rest.substring(slashIndex + 1);
  }

  // Parse authority (user:password@host:port)
  let userInfo = "";
  let hostInfo = authority;

  const atIndex = authority.lastIndexOf("@");
  if (atIndex !== -1) {
    userInfo = authority.substring(0, atIndex);
    hostInfo = authority.substring(atIndex + 1);
  }

  let username: string | undefined;
  let password: string | undefined;

  if (userInfo) {
    const colonIndex = userInfo.indexOf(":");
    if (colonIndex !== -1) {
      username = userInfo.substring(0, colonIndex);
      password = userInfo.substring(colonIndex + 1);
    } else {
      username = userInfo;
    }
  }

  // Parse host and port
  let host: string | undefined;
  let port: string | undefined;

  if (hostInfo) {
    // Handle IPv6 addresses
    if (hostInfo.startsWith("[")) {
      const bracketIndex = hostInfo.indexOf("]");
      if (bracketIndex !== -1) {
        host = hostInfo.substring(0, bracketIndex + 1);
        const rest2 = hostInfo.substring(bracketIndex + 1);
        if (rest2.startsWith(":")) {
          port = rest2.substring(1);
        }
      }
    } else {
      const colonIndex = hostInfo.lastIndexOf(":");
      if (colonIndex !== -1) {
        host = hostInfo.substring(0, colonIndex);
        port = hostInfo.substring(colonIndex + 1);
      } else {
        host = hostInfo;
      }
    }
  }

  // For file-based databases, pathPart might be the database
  const database = scheme === "sqlite" || scheme === "file" ? pathPart : pathPart || undefined;

  const parsed: ParsedConnection = {
    scheme,
    driver: getDriver(scheme),
    host,
    port,
    database,
    username,
    password,
    originalUri: uri,
  };

  logger.debug("[connection] Parsed connection", {
    scheme: parsed.scheme,
    driver: parsed.driver,
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
  });

  return parsed;
}

function getDriver(scheme: string): string {
  // Map scheme to usql driver name
  const driverMap: Record<string, string> = {
    postgres: "postgres",
    postgresql: "postgres",
    mysql: "mysql",
    mariadb: "mysql",
    sqlite: "sqlite3",
    sqlserver: "mssql",
    mssql: "mssql",
    server: "mssql",
    oracle: "oracle",
    oci: "oracle",
    cockroachdb: "postgres",
    csv: "csvq",
    tsv: "csvq",
    file: "csvq",
    presto: "presto",
    mongodb: "mongo",
    cassandra: "cassandra",
    clickhouse: "clickhouse",
    duckdb: "duckdb",
    firebird: "firebird",
    sybase: "sybase",
    odbc: "odbc",
  };

  return driverMap[scheme] || scheme;
}

export function validateConnectionString(uri: string): boolean {
  try {
    parseConnectionString(uri);
    return true;
  } catch {
    return false;
  }
}

export function formatConnectionStringForLogging(uri: string): string {
  try {
    const parsed = parseConnectionString(uri);
    const parts = [];

    if (parsed.scheme) parts.push(parsed.scheme + "://");
    if (parsed.username) parts.push(parsed.username + ":***");
    if (parsed.host) {
      if (parsed.username) parts.push("@");
      parts.push(parsed.host);
    }
    if (parsed.port) parts.push(":" + parsed.port);
    if (parsed.database) parts.push("/" + parsed.database);

    return parts.join("");
  } catch {
    return uri.replace(/:([^@/]*?)@/, ":***@");
  }
}
