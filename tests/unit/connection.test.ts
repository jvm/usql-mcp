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

    it("should handle malformed strings gracefully", () => {
      const result = formatConnectionStringForLogging("postgres://user:pass@localhost/db");
      expect(result).toContain("***");
      expect(result).not.toContain("pass");
    });
  });
});
