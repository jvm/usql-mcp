/**
 * Unit tests for error handling
 */

import { formatMcpError, sanitizeConnectionString, createUsqlError } from "../../src/utils/error-handler.js";

describe("Error Handler", () => {
  describe("formatMcpError", () => {
    it("should format UsqlError correctly", () => {
      const error = createUsqlError("TestError", "Test message", { details: "value" });
      const result = formatMcpError(error);

      expect(result.error).toBe("TestError");
      expect(result.message).toBe("Test message");
      expect(result.details).toEqual({ details: "value" });
    });

    it("should handle generic Error objects", () => {
      const error = new Error("Something went wrong");
      const result = formatMcpError(error);

      expect(result.error).toBe("QueryError");
      expect(result.message).toBe("Something went wrong");
    });

    it("should detect connection refused errors", () => {
      const error = new Error("connection refused ECONNREFUSED");
      const result = formatMcpError(error);

      expect(result.error).toBe("ConnectionError");
      expect(result.message).toContain("connection refused");
    });

    it("should detect timeout errors", () => {
      const error = new Error("Command timeout");
      const result = formatMcpError(error);

      expect(result.error).toBe("TimeoutError");
    });

    it("should detect usql not found errors", () => {
      const error = new Error("ENOENT: no such file or directory, spawn usql");
      const result = formatMcpError(error);

      expect(result.error).toBe("UsqlNotFound");
      expect(result.message).toContain("usql");
    });

    it("should handle unknown error types", () => {
      const result = formatMcpError("unknown error string");

      expect(result.error).toBe("UnknownError");
      expect(result.message).toContain("unexpected error");
    });

    it("should include context in formatted errors", () => {
      const error = new Error("Query failed");
      const context = {
        query: "SELECT * FROM users",
        connectionString: "postgres://user:pass@localhost/db",
      };
      const result = formatMcpError(error, context);

      expect(result.details).toBeDefined();
      expect(result.details?.query).toBe("SELECT * FROM users");
      expect(result.details?.connectionString).toContain("***");
    });
  });

  describe("sanitizeConnectionString", () => {
    it("should redact passwords", () => {
      const result = sanitizeConnectionString("postgres://user:password@localhost/db");
      expect(result).toContain("***");
      expect(result).not.toContain("password");
    });

    it("should work with various formats", () => {
      const testCases = [
        "postgres://user:pass123@host/db",
        "mysql://root:secret@localhost:3306/db",
        "sqlserver://sa:P@ssw0rd@server/db",
      ];

      testCases.forEach((connStr) => {
        const result = sanitizeConnectionString(connStr);
        expect(result).toContain("***");
        // Check that the connection string format is still recognizable
        expect(result).toMatch(/^\w+:\/\/.*@.*\//);
      });
    });

    it("should handle connection strings without passwords", () => {
      const result = sanitizeConnectionString("postgres://localhost/db");
      expect(result).toBe("postgres://localhost/db");
    });
  });

  describe("createUsqlError", () => {
    it("should create error with code, message, and details", () => {
      const error = createUsqlError("TestCode", "Test message", { extra: "data" });

      expect(error.code).toBe("TestCode");
      expect(error.message).toBe("Test message");
      expect(error.details).toEqual({ extra: "data" });
    });

    it("should create error without details", () => {
      const error = createUsqlError("ErrorCode", "Error message");

      expect(error.code).toBe("ErrorCode");
      expect(error.message).toBe("Error message");
    });
  });
});
