/**
 * URI parser for MCP resources
 * Supports URI patterns like:
 * - sql://connections
 * - sql://{connection}/databases
 * - sql://{connection}/{database}/tables
 * - sql://{connection}/{database}/table/{table}
 */

export interface ParsedResourceUri {
  scheme: "sql";
  connection?: string;
  database?: string;
  resourceType: "connections" | "databases" | "tables" | "table";
  table?: string;
}

export class ResourceUriError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceUriError";
  }
}

/**
 * Parse a resource URI into its components
 */
export function parseResourceUri(uri: string): ParsedResourceUri {
  if (!uri || typeof uri !== "string") {
    throw new ResourceUriError("URI must be a non-empty string");
  }

  // Check scheme first
  if (!uri.startsWith("sql://")) {
    throw new ResourceUriError(`Invalid URI scheme. Expected "sql://", got "${uri}"`);
  }

  // Remove trailing slashes after scheme
  const normalizedUri = uri.replace(/\/+$/, "");

  // Remove scheme
  const path = normalizedUri.slice(6); // Remove "sql://"

  if (!path) {
    throw new ResourceUriError("URI path cannot be empty");
  }

  // Split path into segments
  const segments = path.split("/").filter((s) => s.length > 0);

  if (segments.length === 0) {
    throw new ResourceUriError("URI must have at least one path segment");
  }

  // Parse based on pattern
  const firstSegment = segments[0];

  // Pattern: sql://connections
  if (firstSegment === "connections" && segments.length === 1) {
    return {
      scheme: "sql",
      resourceType: "connections",
    };
  }

  // Pattern: sql://{connection}/databases
  if (segments.length === 2 && segments[1] === "databases") {
    return {
      scheme: "sql",
      connection: segments[0],
      resourceType: "databases",
    };
  }

  // Pattern: sql://{connection}/{database}/tables
  if (segments.length === 3 && segments[2] === "tables") {
    return {
      scheme: "sql",
      connection: segments[0],
      database: segments[1],
      resourceType: "tables",
    };
  }

  // Pattern: sql://{connection}/{database}/table/{table}
  if (segments.length === 4 && segments[2] === "table") {
    return {
      scheme: "sql",
      connection: segments[0],
      database: segments[1],
      resourceType: "table",
      table: segments[3],
    };
  }

  throw new ResourceUriError(
    `Invalid URI pattern: "${uri}". Supported patterns:\n` +
      "  - sql://connections\n" +
      "  - sql://{connection}/databases\n" +
      "  - sql://{connection}/{database}/tables\n" +
      "  - sql://{connection}/{database}/table/{table}"
  );
}

/**
 * Build a resource URI from components
 */
export function buildResourceUri(parsed: ParsedResourceUri): string {
  const { resourceType, connection, database, table } = parsed;

  switch (resourceType) {
    case "connections":
      return "sql://connections";

    case "databases":
      if (!connection) {
        throw new ResourceUriError("Connection is required for databases resource");
      }
      return `sql://${connection}/databases`;

    case "tables":
      if (!connection || !database) {
        throw new ResourceUriError("Connection and database are required for tables resource");
      }
      return `sql://${connection}/${database}/tables`;

    case "table":
      if (!connection || !database || !table) {
        throw new ResourceUriError(
          "Connection, database, and table are required for table resource"
        );
      }
      return `sql://${connection}/${database}/table/${table}`;

    default:
      throw new ResourceUriError(`Unknown resource type: ${resourceType}`);
  }
}

/**
 * Validate that a connection name exists in the configuration
 */
export function validateConnectionName(connection: string, availableConnections: string[]): void {
  if (!availableConnections.includes(connection)) {
    throw new ResourceUriError(
      `Unknown connection "${connection}". Available connections: ${availableConnections.join(", ")}`
    );
  }
}
