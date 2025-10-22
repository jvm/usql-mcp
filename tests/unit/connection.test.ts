/**
 * Unit tests for connection string parsing
 */

import {
  parseConnectionString,
  validateConnectionString,
  formatConnectionStringForLogging,
} from "../../src/usql/connection.js";

describe("Connection String Parsing", () => {
  describe("parseConnectionString", () => {
    it("should parse PostgreSQL connection strings", () => {
      const result = parseConnectionString("postgres://user:pass@localhost:5432/mydb");
      expect(result.scheme).toBe("postgres");
      expect(result.driver).toBe("postgres");
      expect(result.username).toBe("user");
      expect(result.password).toBe("pass");
      expect(result.host).toBe("localhost");
      expect(result.port).toBe("5432");
      expect(result.database).toBe("mydb");
    });

    it("should parse MySQL connection strings", () => {
      const result = parseConnectionString("mysql://root@localhost:3306/testdb");
      expect(result.scheme).toBe("mysql");
      expect(result.driver).toBe("mysql");
      expect(result.username).toBe("root");
      expect(result.host).toBe("localhost");
      expect(result.port).toBe("3306");
      expect(result.database).toBe("testdb");
    });

    it("should parse SQLite file paths", () => {
      const result = parseConnectionString("sqlite:///path/to/database.db");
      expect(result.scheme).toBe("sqlite");
      expect(result.driver).toBe("sqlite3");
      expect(result.database).toBe("path/to/database.db");
    });

    it("should handle connection strings without port", () => {
      const result = parseConnectionString("postgres://user:pass@localhost/mydb");
      expect(result.host).toBe("localhost");
      expect(result.port).toBeUndefined();
      expect(result.database).toBe("mydb");
    });

    it("should handle connection strings without credentials", () => {
      const result = parseConnectionString("postgres://localhost/mydb");
      expect(result.username).toBeUndefined();
      expect(result.password).toBeUndefined();
      expect(result.host).toBe("localhost");
    });

    it("should throw on invalid connection strings", () => {
      expect(() => parseConnectionString("not-a-connection-string")).toThrow();
      expect(() => parseConnectionString("")).toThrow();
      expect(() => parseConnectionString("sql://localhost/db")).toThrow();
    });
  });

  describe("validateConnectionString", () => {
    it("should return true for valid connection strings", () => {
      expect(validateConnectionString("postgres://localhost/db")).toBe(true);
      expect(validateConnectionString("mysql://localhost/db")).toBe(true);
      expect(validateConnectionString("sqlite:///db.db")).toBe(true);
    });

    it("should return false for invalid connection strings", () => {
      expect(validateConnectionString("not-valid")).toBe(false);
      expect(validateConnectionString("")).toBe(false);
      expect(validateConnectionString("sql://localhost/db")).toBe(false);
    });
  });

  describe("formatConnectionStringForLogging", () => {
    it("should redact passwords in connection strings", () => {
      const result = formatConnectionStringForLogging(
        "postgres://user:mypassword@localhost:5432/db"
      );
      expect(result).toContain("***");
      expect(result).not.toContain("mypassword");
    });

    it("should preserve other connection details", () => {
      const result = formatConnectionStringForLogging(
        "postgres://user:pass@localhost:5432/mydb"
      );
      expect(result).toContain("postgres://");
      expect(result).toContain("user");
      expect(result).toContain("localhost");
      expect(result).toContain("5432");
      expect(result).toContain("mydb");
    });

    it("should handle connection strings without port", () => {
      const result = formatConnectionStringForLogging("postgres://user:pass@localhost/db");
      expect(result).toContain("***");
      expect(result).not.toContain("pass");
      expect(result).toBe("postgres://user:***@localhost/db");
    });

    it("should handle connection strings without credentials", () => {
      const result = formatConnectionStringForLogging("postgres://localhost:5432/db");
      expect(result).not.toContain("***");
      expect(result).toBe("postgres://localhost:5432/db");
    });

    it("should handle SQLite file paths", () => {
      const result = formatConnectionStringForLogging("sqlite:///path/to/database.db");
      expect(result).toBe("sqlite:///path/to/database.db");
    });

    it("should handle malformed strings gracefully with fallback", () => {
      const result = formatConnectionStringForLogging("not-a-valid-connection-string");
      // Falls back to simple regex replacement
      expect(result).toBe("not-a-valid-connection-string");
    });
  });

  describe("parseConnectionString - IPv6 support", () => {
    it("should parse IPv6 addresses with port", () => {
      const result = parseConnectionString("postgres://user:pass@[::1]:5432/db");
      expect(result.scheme).toBe("postgres");
      expect(result.host).toBe("[::1]");
      expect(result.port).toBe("5432");
      expect(result.database).toBe("db");
      expect(result.username).toBe("user");
      expect(result.password).toBe("pass");
    });

    it("should parse IPv6 addresses without port", () => {
      const result = parseConnectionString("postgres://user:pass@[::1]/db");
      expect(result.host).toBe("[::1]");
      expect(result.port).toBeUndefined();
      expect(result.database).toBe("db");
    });

    it("should parse full IPv6 addresses", () => {
      const result = parseConnectionString(
        "postgres://user:pass@[2001:db8::1]:5432/db"
      );
      expect(result.host).toBe("[2001:db8::1]");
      expect(result.port).toBe("5432");
    });
  });

  describe("parseConnectionString - additional drivers", () => {
    it("should parse Oracle connections", () => {
      const result = parseConnectionString("oracle://user:pass@localhost:1521/orcl");
      expect(result.scheme).toBe("oracle");
      expect(result.driver).toBe("oracle");
      expect(result.port).toBe("1521");
    });

    it("should parse SQL Server connections", () => {
      const result = parseConnectionString("sqlserver://sa:pass@localhost:1433/master");
      expect(result.scheme).toBe("sqlserver");
      expect(result.driver).toBe("mssql");
    });

    it("should parse CockroachDB connections (uses postgres driver)", () => {
      const result = parseConnectionString("cockroachdb://user:pass@localhost:26257/db");
      expect(result.scheme).toBe("cockroachdb");
      expect(result.driver).toBe("postgres");
    });

    it("should parse DuckDB connections", () => {
      const result = parseConnectionString("duckdb:///path/to/db.duckdb");
      expect(result.scheme).toBe("duckdb");
      expect(result.driver).toBe("duckdb");
    });

    it("should parse ClickHouse connections", () => {
      const result = parseConnectionString("clickhouse://user:pass@localhost:9000/db");
      expect(result.scheme).toBe("clickhouse");
      expect(result.driver).toBe("clickhouse");
    });
  });

  describe("parseConnectionString - edge cases", () => {
    it("should handle username without password", () => {
      const result = parseConnectionString("postgres://user@localhost/db");
      expect(result.username).toBe("user");
      expect(result.password).toBeUndefined();
    });

    it("should handle complex passwords with special characters", () => {
      const result = parseConnectionString("postgres://user:p@ss:w0rd!@localhost/db");
      expect(result.username).toBe("user");
      expect(result.password).toBe("p@ss:w0rd!");
      expect(result.host).toBe("localhost");
    });

    it("should handle database names with path separators", () => {
      const result = parseConnectionString("postgres://localhost/my/database");
      expect(result.database).toBe("my/database");
    });

    it("should throw for null or undefined input", () => {
      expect(() => parseConnectionString(null as any)).toThrow(/must be a non-empty string/);
      expect(() => parseConnectionString(undefined as any)).toThrow(/must be a non-empty string/);
    });

    it("should throw for non-string input", () => {
      expect(() => parseConnectionString(123 as any)).toThrow(/must be a non-empty string/);
      expect(() => parseConnectionString({} as any)).toThrow(/must be a non-empty string/);
    });
  });

  describe("validateConnectionString - additional validation", () => {
    it("should validate Oracle connections", () => {
      expect(validateConnectionString("oracle://user:pass@host:1521/service")).toBe(true);
    });

    it("should validate SQL Server connections", () => {
      expect(validateConnectionString("sqlserver://sa:pass@host/db")).toBe(true);
      expect(validateConnectionString("mssql://sa:pass@host/db")).toBe(true);
    });

    it("should validate file-based database paths", () => {
      expect(validateConnectionString("sqlite:///tmp/test.db")).toBe(true);
      expect(validateConnectionString("duckdb:///data/analytics.duckdb")).toBe(true);
    });

    it("should reject completely malformed input", () => {
      expect(validateConnectionString("just some text")).toBe(false);
      expect(validateConnectionString("ftp://not-a-database")).toBe(false);
      expect(validateConnectionString("")).toBe(false);
    });

    it("should reject null and undefined", () => {
      expect(validateConnectionString(null as any)).toBe(false);
      expect(validateConnectionString(undefined as any)).toBe(false);
    });
  });
});
