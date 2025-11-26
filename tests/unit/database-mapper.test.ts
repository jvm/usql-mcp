/**
 * Tests for database mapper utility
 */

import {
  detectDatabaseType,
  getListTablesCommand,
  getListDatabasesCommand,
  getDescribeTableCommand,
  getDatabaseInfo,
} from "../../src/utils/database-mapper.js";

describe("detectDatabaseType", () => {
  it("should detect PostgreSQL from URI", () => {
    expect(detectDatabaseType("postgres://localhost")).toBe("postgres");
    expect(detectDatabaseType("postgresql://user:pass@host:5432/db")).toBe("postgres");
  });

  it("should detect MySQL from URI", () => {
    expect(detectDatabaseType("mysql://localhost")).toBe("mysql");
    expect(detectDatabaseType("mysql://user:pass@host:3306/db")).toBe("mysql");
  });

  it("should detect SQLite from URI", () => {
    expect(detectDatabaseType("sqlite:///path/to/db.db")).toBe("sqlite");
    expect(detectDatabaseType("sqlite3://memory")).toBe("sqlite");
  });

  it("should detect Oracle from URI", () => {
    expect(detectDatabaseType("oracle://localhost")).toBe("oracle");
    expect(detectDatabaseType("oracledb://user:pass@host")).toBe("oracle");
  });

  it("should detect SQL Server from URI", () => {
    expect(detectDatabaseType("sqlserver://localhost")).toBe("sqlserver");
    expect(detectDatabaseType("mssql://user:pass@host")).toBe("sqlserver");
  });

  it("should detect MongoDB from URI", () => {
    expect(detectDatabaseType("mongodb://localhost")).toBe("mongodb");
  });

  it("should detect CockroachDB from URI", () => {
    expect(detectDatabaseType("cockroachdb://localhost")).toBe("cockroach");
    expect(detectDatabaseType("crdb://localhost")).toBe("cockroach");
  });

  it("should fallback to generic for unknown URIs", () => {
    expect(detectDatabaseType("unknown://localhost")).toBe("unknown");
  });

  it("should handle case-insensitive detection", () => {
    expect(detectDatabaseType("POSTGRES://localhost")).toBe("postgres");
    expect(detectDatabaseType("MySQL://localhost")).toBe("mysql");
    expect(detectDatabaseType("SqLiTe:///db.db")).toBe("sqlite");
  });
});

describe("getListTablesCommand", () => {
  it("should return \\dt for PostgreSQL", () => {
    expect(getListTablesCommand("postgres")).toBe("\\dt");
  });

  it("should return SHOW TABLES for MySQL", () => {
    expect(getListTablesCommand("mysql")).toContain("SHOW TABLES");
  });

  it("should return sqlite_master query for SQLite", () => {
    expect(getListTablesCommand("sqlite")).toContain("sqlite_master");
    expect(getListTablesCommand("sqlite")).toContain("type='table'");
  });

  it("should return user_tables query for Oracle", () => {
    expect(getListTablesCommand("oracle")).toContain("user_tables");
  });

  it("should return INFORMATION_SCHEMA query for SQL Server", () => {
    expect(getListTablesCommand("sqlserver")).toContain("INFORMATION_SCHEMA");
  });

  it("should return MongoDB collection command", () => {
    expect(getListTablesCommand("mongodb")).toContain("listCollections");
  });

  it("should handle case-insensitive input", () => {
    expect(getListTablesCommand("POSTGRES")).toBe("\\dt");
    expect(getListTablesCommand("MySQL")).toContain("SHOW TABLES");
  });

  it("should fallback to PostgreSQL style for unknown", () => {
    expect(getListTablesCommand("unknown")).toBe("\\dt");
  });
});

describe("getListDatabasesCommand", () => {
  it("should return \\l for PostgreSQL", () => {
    expect(getListDatabasesCommand("postgres")).toBe("\\l");
  });

  it("should return SHOW DATABASES for MySQL", () => {
    expect(getListDatabasesCommand("mysql")).toContain("SHOW DATABASES");
  });

  it("should return PRAGMA for SQLite", () => {
    expect(getListDatabasesCommand("sqlite")).toContain("PRAGMA");
  });

  it("should return dba_tablespaces query for Oracle", () => {
    expect(getListDatabasesCommand("oracle")).toContain("dba_tablespaces");
  });

  it("should return sys.databases query for SQL Server", () => {
    expect(getListDatabasesCommand("sqlserver")).toContain("sys.databases");
  });

  it("should return show dbs for MongoDB", () => {
    expect(getListDatabasesCommand("mongodb")).toContain("show dbs");
  });
});

describe("getDescribeTableCommand", () => {
  it("should return \\d command for PostgreSQL", () => {
    expect(getDescribeTableCommand("postgres", "users")).toBe('\\d "users"');
  });

  it("should return DESCRIBE command for MySQL", () => {
    expect(getDescribeTableCommand("mysql", "users")).toBe("DESCRIBE `users`;");
  });

  it("should return PRAGMA for SQLite", () => {
    const cmd = getDescribeTableCommand("sqlite", "users");
    expect(cmd).toContain("PRAGMA");
    expect(cmd).toContain("users");
  });

  it("should return all_tab_columns query for Oracle", () => {
    const cmd = getDescribeTableCommand("oracle", "USERS");
    expect(cmd).toContain("all_tab_columns");
    expect(cmd).toContain("USERS");
  });

  it("should return INFORMATION_SCHEMA query for SQL Server", () => {
    const cmd = getDescribeTableCommand("sqlserver", "users");
    expect(cmd).toContain("INFORMATION_SCHEMA.COLUMNS");
    expect(cmd).toContain("users");
  });

  it("should handle schema-qualified table names", () => {
    const cmd = getDescribeTableCommand("postgres", "public.users");
    expect(cmd).toContain('"public"."users"');
  });

  it("should escape table names appropriately", () => {
    // PostgreSQL uses double quotes
    expect(getDescribeTableCommand("postgres", "my_table")).toContain('"my_table"');

    // MySQL uses backticks
    expect(getDescribeTableCommand("mysql", "my_table")).toContain("`my_table`");

    // SQL Server uses single quotes for string values (parameter in WHERE clause)
    const sqlServerCmd = getDescribeTableCommand("sqlserver", "my_table");
    expect(sqlServerCmd).toContain("'my_table'");
  });

  it("should reject invalid table names", () => {
    expect(() => getDescribeTableCommand("postgres", "users; DROP TABLE users")).toThrow();
    expect(() => getDescribeTableCommand("postgres", "users' OR '1'='1")).toThrow();
    expect(() => getDescribeTableCommand("postgres", "123invalid")).toThrow();
  });

  it("should handle MongoDB collections", () => {
    const cmd = getDescribeTableCommand("mongodb", "users");
    expect(cmd).toContain("stats");
    expect(cmd).toContain("users");
  });
});

describe("getDatabaseInfo", () => {
  it("should return info for PostgreSQL", () => {
    const info = getDatabaseInfo("postgres");
    expect(info.name).toBe("PostgreSQL");
    expect(info.supportsListDatabases).toBe(true);
    expect(info.supportsListTables).toBe(true);
    expect(info.supportsDescribeTable).toBe(true);
  });

  it("should return info for MySQL", () => {
    const info = getDatabaseInfo("mysql");
    expect(info.name).toBe("MySQL");
    expect(info.supportsListDatabases).toBe(true);
  });

  it("should return info for MariaDB", () => {
    const info = getDatabaseInfo("mariadb");
    expect(info.name).toBe("MariaDB");
  });

  it("should return info for SQLite", () => {
    const info = getDatabaseInfo("sqlite");
    expect(info.name).toBe("SQLite");
    expect(info.supportsListDatabases).toBe(false);
    expect(info.notes).toContain("SQLite is single-database only");
  });

  it("should return info for Oracle", () => {
    const info = getDatabaseInfo("oracle");
    expect(info.name).toBe("Oracle");
    expect(info.notes.length).toBeGreaterThan(0);
  });

  it("should return info for SQL Server", () => {
    const info = getDatabaseInfo("sqlserver");
    expect(info.name).toBe("SQL Server");
  });

  it("should return info for MongoDB", () => {
    const info = getDatabaseInfo("mongodb");
    expect(info.name).toBe("MongoDB");
    expect(info.notes.some((n) => n.includes("collections"))).toBe(true);
  });

  it("should return generic info for unknown database", () => {
    const info = getDatabaseInfo("unknown");
    expect(info.name).toBe("unknown");
    expect(info.notes.some((n) => n.includes("fallback"))).toBe(true);
  });

  it("should handle case-insensitive input", () => {
    const info1 = getDatabaseInfo("POSTGRES");
    const info2 = getDatabaseInfo("postgres");
    expect(info1.name).toBe(info2.name);
  });
});

describe("Edge cases", () => {
  it("should handle empty database type gracefully", () => {
    const info = getDatabaseInfo("");
    expect(info.supportsListDatabases).toBe(true);
  });

  it("should handle special characters in connection strings", () => {
    expect(detectDatabaseType("postgres://user%40domain:p%40ss@host")).toBe("postgres");
  });

  it("should handle connection strings with complex URLs", () => {
    expect(
      detectDatabaseType("postgres://user:password@host:5432/database?sslmode=require")
    ).toBe("postgres");
  });

  it("should handle table names with underscores and numbers", () => {
    const cmd = getDescribeTableCommand("postgres", "table_123");
    expect(cmd).toContain("table_123");
  });

  it("should handle schema.table notation", () => {
    const cmd = getDescribeTableCommand("postgres", "public.users");
    expect(cmd).toContain('public');
    expect(cmd).toContain('users');
  });
});
