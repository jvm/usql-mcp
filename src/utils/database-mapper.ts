/**
 * Database-specific command mapper
 * Maps generic usql commands to database-native equivalents
 */

/**
 * Detect the database type from a connection string or URI
 */
export function detectDatabaseType(connectionString: string): string {
  const lower = connectionString.toLowerCase();

  // Extract scheme from connection string (e.g., "postgres://" -> "postgres")
  const schemeMatch = /^([a-z][a-z0-9+]*):\/\//i.exec(connectionString);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();

    // Normalize scheme names
    if (scheme === "postgresql" || scheme === "postgres") return "postgres";
    if (scheme === "mysql" || scheme === "mariadb") return "mysql";
    if (scheme === "sqlite" || scheme === "sqlite3") return "sqlite";
    if (scheme === "oracle" || scheme === "oracledb") return "oracle";
    if (scheme === "mssql" || scheme === "sqlserver") return "sqlserver";
    if (scheme === "mongodb") return "mongodb";
    if (scheme === "cockroachdb" || scheme === "crdb") return "cockroach";

    return scheme;
  }

  // Fallback: try to detect from common patterns
  if (lower.includes("postgres")) return "postgres";
  if (lower.includes("mysql")) return "mysql";
  if (lower.includes("sqlite")) return "sqlite";
  if (lower.includes("oracle")) return "oracle";
  if (lower.includes("mssql") || lower.includes("sqlserver")) return "sqlserver";
  if (lower.includes("mongodb")) return "mongodb";
  if (lower.includes("cockroach")) return "cockroach";

  // Default to generic if unknown
  return "generic";
}

/**
 * Get the command to list all tables in a database
 */
export function getListTablesCommand(dbType: string): string {
  const db = dbType.toLowerCase();

  switch (db) {
    case "postgres":
    case "cockroach":
      // PostgreSQL-style
      return "\\dt";

    case "mysql":
    case "mariadb":
      // MySQL-style
      return "SHOW TABLES;";

    case "sqlite":
      // SQLite-style
      return "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;";

    case "oracle":
      // Oracle-style
      return "SELECT table_name FROM user_tables ORDER BY table_name;";

    case "sqlserver":
      // SQL Server-style
      return "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;";

    case "mongodb":
      // MongoDB doesn't have tables, but collections
      return "db.listCollections();";

    default:
      // Fallback to generic (PostgreSQL-style)
      return "\\dt";
  }
}

/**
 * Get the command to list all databases
 */
export function getListDatabasesCommand(dbType: string): string {
  const db = dbType.toLowerCase();

  switch (db) {
    case "postgres":
    case "cockroach":
      // PostgreSQL-style
      return "\\l";

    case "mysql":
    case "mariadb":
      // MySQL-style
      return "SHOW DATABASES;";

    case "sqlite":
      // SQLite doesn't support database listing in the traditional sense
      // Return a query that shows attached databases
      return "PRAGMA database_list;";

    case "oracle":
      // Oracle doesn't have user-facing database listing
      // Return tablespaces instead
      return "SELECT tablespace_name FROM dba_tablespaces ORDER BY tablespace_name;";

    case "sqlserver":
      // SQL Server-style
      return "SELECT name FROM sys.databases ORDER BY name;";

    case "mongodb":
      // MongoDB-style
      return "show dbs;";

    default:
      // Fallback to generic (PostgreSQL-style)
      return "\\l";
  }
}

/**
 * Get the command to describe a table structure
 */
export function getDescribeTableCommand(dbType: string, tableName: string): string {
  const db = dbType.toLowerCase();
  const escaped = escapeTableName(dbType, tableName);

  switch (db) {
    case "postgres":
    case "cockroach":
      // PostgreSQL-style
      return `\\d ${escaped}`;

    case "mysql":
    case "mariadb":
      // MySQL-style
      return `DESCRIBE ${escaped};`;

    case "sqlite":
      // SQLite-style
      return `PRAGMA table_info(${escaped});`;

    case "oracle":
      // Oracle-style
      return `SELECT column_name, data_type, nullable FROM all_tab_columns WHERE table_name = ${escapeSqlString(tableName)} ORDER BY column_id;`;

    case "sqlserver":
      // SQL Server-style
      return `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ${escapeSqlString(tableName)} ORDER BY ORDINAL_POSITION;`;

    case "mongodb":
      // MongoDB doesn't have traditional schema, show collection stats
      return `db.${escaped}.stats();`;

    default:
      // Fallback to generic (PostgreSQL-style)
      return `\\d ${escaped}`;
  }
}

/**
 * Escape table name for use in SQL queries
 * Uses double quotes for standard SQL, backticks for MySQL
 */
function escapeTableName(dbType: string, tableName: string): string {
  const db = dbType.toLowerCase();

  // Validate table name (prevent injection)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }

  if (db === "mysql" || db === "mariadb") {
    // MySQL uses backticks
    return tableName.split(".").map((part) => `\`${part}\``).join(".");
  }

  if (db === "sqlserver") {
    // SQL Server uses square brackets
    return tableName.split(".").map((part) => `[${part}]`).join(".");
  }

  // Standard SQL uses double quotes
  return tableName.split(".").map((part) => `"${part}"`).join(".");
}

/**
 * Escape string literal for use in SQL queries
 * Single quote escaping for standard SQL
 */
function escapeSqlString(value: string): string {
  // Escape single quotes by doubling them
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Get information about supported commands for a database type
 */
export function getDatabaseInfo(dbType: string): {
  name: string;
  supportsListDatabases: boolean;
  supportsListTables: boolean;
  supportsDescribeTable: boolean;
  notes: string[];
} {
  const db = dbType.toLowerCase();

  switch (db) {
    case "postgres":
      return {
        name: "PostgreSQL",
        supportsListDatabases: true,
        supportsListTables: true,
        supportsDescribeTable: true,
        notes: [],
      };

    case "mysql":
    case "mariadb":
      return {
        name: db === "mariadb" ? "MariaDB" : "MySQL",
        supportsListDatabases: true,
        supportsListTables: true,
        supportsDescribeTable: true,
        notes: [],
      };

    case "sqlite":
      return {
        name: "SQLite",
        supportsListDatabases: false,
        supportsListTables: true,
        supportsDescribeTable: true,
        notes: ["SQLite is single-database only", "list_databases shows attached databases"],
      };

    case "oracle":
      return {
        name: "Oracle",
        supportsListDatabases: true,
        supportsListTables: true,
        supportsDescribeTable: true,
        notes: [
          "Requires appropriate permissions (DBA_TABLES view)",
          "list_databases shows tablespaces instead",
        ],
      };

    case "sqlserver":
      return {
        name: "SQL Server",
        supportsListDatabases: true,
        supportsListTables: true,
        supportsDescribeTable: true,
        notes: ["Requires appropriate permissions (sys.databases)"],
      };

    case "mongodb":
      return {
        name: "MongoDB",
        supportsListDatabases: true,
        supportsListTables: true,
        supportsDescribeTable: true,
        notes: [
          "MongoDB uses collections instead of tables",
          "describe_table shows collection statistics instead of schema",
        ],
      };

    case "cockroach":
      return {
        name: "CockroachDB",
        supportsListDatabases: true,
        supportsListTables: true,
        supportsDescribeTable: true,
        notes: ["CockroachDB is PostgreSQL-compatible"],
      };

    default:
      return {
        name: dbType,
        supportsListDatabases: true,
        supportsListTables: true,
        supportsDescribeTable: true,
        notes: ["Using generic/fallback commands"],
      };
  }
}
