/**
 * Unit tests for all tool handlers
 */

import { handleExecuteQuery } from "../../src/tools/execute-query.js";
import { handleListDatabases } from "../../src/tools/list-databases.js";
import { handleListTables } from "../../src/tools/list-tables.js";
import { handleDescribeTable } from "../../src/tools/describe-table.js";
import { handleExecuteScript } from "../../src/tools/execute-script.js";
import * as processExecutor from "../../src/usql/process-executor.js";
import * as config from "../../src/usql/config.js";
import * as connection from "../../src/usql/connection.js";

// Mock dependencies
jest.mock("../../src/usql/process-executor.js");
jest.mock("../../src/usql/config.js");
jest.mock("../../src/usql/connection.js");

describe("Tool Handlers", () => {
  const mockExecuteUsqlQuery = processExecutor.executeUsqlQuery as jest.MockedFunction<
    typeof processExecutor.executeUsqlQuery
  >;
  const mockResolveConnectionStringOrDefault =
    config.resolveConnectionStringOrDefault as jest.MockedFunction<
      typeof config.resolveConnectionStringOrDefault
    >;
  const mockGetQueryTimeout = config.getQueryTimeout as jest.MockedFunction<
    typeof config.getQueryTimeout
  >;
  const mockValidateConnectionString = connection.validateConnectionString as jest.MockedFunction<
    typeof connection.validateConnectionString
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveConnectionStringOrDefault.mockReturnValue("postgres://localhost/testdb");
    mockGetQueryTimeout.mockReturnValue(undefined);
    mockValidateConnectionString.mockReturnValue(true);
  });

  describe("handleExecuteQuery", () => {
    it("executes a valid query successfully", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: '{"rows": [{"id": 1}]}',
        stderr: "",
        exitCode: 0,
      });

      const result = await handleExecuteQuery({
        query: "SELECT * FROM users",
        connection_string: "postgres://localhost/db",
      });

      expect(result.format).toBe("json");
      expect(result.content).toBe('{"rows": [{"id": 1}]}');
      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        "postgres://localhost/testdb",
        "SELECT * FROM users",
        { timeout: undefined, format: "json" }
      );
    });

    it("respects output_format parameter", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "id,name\n1,John",
        stderr: "",
        exitCode: 0,
      });

      const result = await handleExecuteQuery({
        query: "SELECT * FROM users",
        output_format: "csv",
      });

      expect(result.format).toBe("csv");
      expect(result.content).toBe("id,name\n1,John");
      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ format: "csv" })
      );
    });

    it("throws error when query is missing", async () => {
      await expect(
        handleExecuteQuery({ query: "" } as any)
      ).rejects.toMatchObject({
        error: "InvalidInput",
        message: expect.stringContaining("query is required"),
      });
    });

    it("throws error when query is not a string", async () => {
      await expect(
        handleExecuteQuery({ query: 123 } as any)
      ).rejects.toMatchObject({
        error: "InvalidInput",
        message: expect.stringContaining("query is required"),
      });
    });

    it("throws error when connection string is invalid", async () => {
      mockValidateConnectionString.mockReturnValue(false);

      await expect(
        handleExecuteQuery({
          query: "SELECT 1",
          connection_string: "invalid",
        })
      ).rejects.toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining("Invalid connection string"),
      });
    });

    it("throws error when connection resolution fails", async () => {
      mockResolveConnectionStringOrDefault.mockImplementation(() => {
        throw new Error("No connection configured");
      });

      await expect(
        handleExecuteQuery({ query: "SELECT 1" })
      ).rejects.toMatchObject({
        error: "InvalidConnection",
        message: expect.stringContaining("Failed to resolve connection"),
      });
    });

    it("handles query execution errors", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "",
        stderr: "ERROR: syntax error at or near SELECT",
        exitCode: 1,
      });

      await expect(
        handleExecuteQuery({ query: "SELCT * FROM users" })
      ).rejects.toMatchObject({
        error: "QueryExecutionError",
        message: expect.stringContaining("ERROR: syntax error"),
      });
    });

    it("respects timeout_ms parameter", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "{}",
        stderr: "",
        exitCode: 0,
      });

      await handleExecuteQuery({
        query: "SELECT 1",
        timeout_ms: 5000,
      });

      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it("uses unlimited timeout when timeout_ms is null", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "{}",
        stderr: "",
        exitCode: 0,
      });

      await handleExecuteQuery({
        query: "SELECT 1",
        timeout_ms: null,
      });

      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ timeout: undefined })
      );
    });

    it("falls back to default timeout when timeout_ms not provided", async () => {
      mockGetQueryTimeout.mockReturnValue(30000);
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "{}",
        stderr: "",
        exitCode: 0,
      });

      await handleExecuteQuery({ query: "SELECT 1" });

      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it("sanitizes connection string in error details", async () => {
      mockExecuteUsqlQuery.mockRejectedValue(new Error("Connection failed"));

      await expect(
        handleExecuteQuery({
          query: "SELECT 1",
          connection_string: "postgres://user:password@host/db",
        })
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          connectionString: expect.stringContaining("***"),
        }),
      });
    });
  });

  describe("handleListDatabases", () => {
    it("lists databases successfully", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: '{"databases": ["db1", "db2"]}',
        stderr: "",
        exitCode: 0,
      });

      const result = await handleListDatabases({});

      expect(result.format).toBe("json");
      expect(result.content).toBe('{"databases": ["db1", "db2"]}');
      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        "postgres://localhost/testdb",
        "\\l",
        expect.objectContaining({ format: "json" })
      );
    });

    it("respects output_format parameter", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "name,owner\ndb1,admin\ndb2,user",
        stderr: "",
        exitCode: 0,
      });

      const result = await handleListDatabases({ output_format: "csv" });

      expect(result.format).toBe("csv");
      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        expect.any(String),
        "\\l",
        expect.objectContaining({ format: "csv" })
      );
    });

    it("throws error when connection string is invalid", async () => {
      mockValidateConnectionString.mockReturnValue(false);

      await expect(
        handleListDatabases({ connection_string: "invalid" })
      ).rejects.toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining("Invalid connection string"),
      });
    });

    it("handles list databases errors", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "",
        stderr: "ERROR: permission denied",
        exitCode: 1,
      });

      await expect(handleListDatabases({})).rejects.toMatchObject({
        error: "ListDatabasesError",
        message: expect.stringContaining("permission denied"),
      });
    });

    it("respects timeout_ms parameter", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "{}",
        stderr: "",
        exitCode: 0,
      });

      await handleListDatabases({ timeout_ms: 10000 });

      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ timeout: 10000 })
      );
    });
  });

  describe("handleListTables", () => {
    it("lists tables successfully", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: '{"tables": ["users", "orders"]}',
        stderr: "",
        exitCode: 0,
      });

      const result = await handleListTables({});

      expect(result.format).toBe("json");
      expect(result.content).toBe('{"tables": ["users", "orders"]}');
      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        "postgres://localhost/testdb",
        "\\dt",
        expect.objectContaining({ format: "json" })
      );
    });

    it("respects output_format parameter", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "table_name\nusers\norders",
        stderr: "",
        exitCode: 0,
      });

      const result = await handleListTables({ output_format: "csv" });

      expect(result.format).toBe("csv");
    });

    it("handles list tables errors", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "",
        stderr: "ERROR: database not found",
        exitCode: 1,
      });

      await expect(handleListTables({})).rejects.toMatchObject({
        error: "ListTablesError",
        message: expect.stringContaining("database not found"),
      });
    });

    it("includes database parameter in error context", async () => {
      mockExecuteUsqlQuery.mockRejectedValue(new Error("Connection failed"));

      await expect(
        handleListTables({ database: "mydb" })
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          database: "mydb",
        }),
      });
    });
  });

  describe("handleDescribeTable", () => {
    it("describes a table successfully", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: '{"columns": [{"name": "id", "type": "integer"}]}',
        stderr: "",
        exitCode: 0,
      });

      const result = await handleDescribeTable({ table: "users" });

      expect(result.format).toBe("json");
      expect(result.content).toContain("columns");
      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        "postgres://localhost/testdb",
        "\\d users",
        expect.objectContaining({ format: "json" })
      );
    });

    it("throws error when table parameter is missing", async () => {
      await expect(
        handleDescribeTable({ table: "" } as any)
      ).rejects.toMatchObject({
        error: "InvalidInput",
        message: expect.stringContaining("table is required"),
      });
    });

    it("throws error when table parameter is not a string", async () => {
      await expect(
        handleDescribeTable({ table: 123 } as any)
      ).rejects.toMatchObject({
        error: "InvalidInput",
        message: expect.stringContaining("table is required"),
      });
    });

    it("throws TableNotFound when output is empty with exitCode 0", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "",
        stderr: "",
        exitCode: 0,
      });

      await expect(
        handleDescribeTable({ table: "nonexistent" })
      ).rejects.toMatchObject({
        error: "TableNotFound",
        message: expect.stringContaining("nonexistent"),
      });
    });

    it("throws TableNotFound when output is whitespace only", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "   \n\n  ",
        stderr: "",
        exitCode: 0,
      });

      await expect(
        handleDescribeTable({ table: "missing" })
      ).rejects.toMatchObject({
        error: "TableNotFound",
        message: expect.stringContaining("missing"),
      });
    });

    it("handles describe table errors with stderr", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "",
        stderr: "ERROR: relation does not exist",
        exitCode: 1,
      });

      await expect(
        handleDescribeTable({ table: "users" })
      ).rejects.toMatchObject({
        error: "DescribeTableError",
        message: expect.stringContaining("relation does not exist"),
      });
    });

    it("includes table and database in error context", async () => {
      mockExecuteUsqlQuery.mockRejectedValue(new Error("Connection failed"));

      await expect(
        handleDescribeTable({ table: "users", database: "mydb" })
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          table: "users",
          database: "mydb",
        }),
      });
    });

    it("respects output_format parameter", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "column,type\nid,integer",
        stderr: "",
        exitCode: 0,
      });

      const result = await handleDescribeTable({
        table: "users",
        output_format: "csv",
      });

      expect(result.format).toBe("csv");
    });
  });

  describe("handleExecuteScript", () => {
    it("executes a script successfully", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: '{"result": "success"}',
        stderr: "",
        exitCode: 0,
      });

      const result = await handleExecuteScript({
        script: "CREATE TABLE test (id INT); INSERT INTO test VALUES (1);",
      });

      expect(result.format).toBe("json");
      expect(result.content).toBe('{"result": "success"}');
      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        "postgres://localhost/testdb",
        "CREATE TABLE test (id INT); INSERT INTO test VALUES (1);",
        expect.objectContaining({ format: "json" })
      );
    });

    it("throws error when script is missing", async () => {
      await expect(
        handleExecuteScript({ script: "" } as any)
      ).rejects.toMatchObject({
        error: "InvalidInput",
        message: expect.stringContaining("script is required"),
      });
    });

    it("throws error when script is not a string", async () => {
      await expect(
        handleExecuteScript({ script: null } as any)
      ).rejects.toMatchObject({
        error: "InvalidInput",
        message: expect.stringContaining("script is required"),
      });
    });

    it("throws error when script is empty after trimming", async () => {
      await expect(
        handleExecuteScript({ script: "   \n\n  " })
      ).rejects.toMatchObject({
        error: "InvalidInput",
        message: expect.stringContaining("script cannot be empty"),
      });
    });

    it("logs warning for DROP TABLE statements", async () => {
      const consoleWarnSpy = jest.spyOn(console, "error").mockImplementation();
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "{}",
        stderr: "",
        exitCode: 0,
      });

      await handleExecuteScript({
        script: "DROP TABLE users; CREATE TABLE users (id INT);",
      });

      // Script should still execute (warning only)
      expect(mockExecuteUsqlQuery).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it("logs warning for DROP DATABASE statements", async () => {
      const consoleWarnSpy = jest.spyOn(console, "error").mockImplementation();
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "{}",
        stderr: "",
        exitCode: 0,
      });

      await handleExecuteScript({
        script: "DROP DATABASE old_db; CREATE DATABASE new_db;",
      });

      expect(mockExecuteUsqlQuery).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it("handles script execution errors", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "",
        stderr: "ERROR: syntax error in statement 2",
        exitCode: 1,
      });

      await expect(
        handleExecuteScript({ script: "SELECT 1; SELCT 2;" })
      ).rejects.toMatchObject({
        error: "ScriptExecutionError",
        message: expect.stringContaining("syntax error"),
      });
    });

    it("respects output_format parameter", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "result\nsuccess",
        stderr: "",
        exitCode: 0,
      });

      const result = await handleExecuteScript({
        script: "SELECT 1",
        output_format: "csv",
      });

      expect(result.format).toBe("csv");
    });

    it("respects timeout_ms parameter", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "{}",
        stderr: "",
        exitCode: 0,
      });

      await handleExecuteScript({
        script: "SELECT 1",
        timeout_ms: 15000,
      });

      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ timeout: 15000 })
      );
    });

    it("includes script length in error context", async () => {
      mockExecuteUsqlQuery.mockRejectedValue(new Error("Execution failed"));

      const longScript = "SELECT * FROM users;".repeat(100);
      await expect(
        handleExecuteScript({ script: longScript })
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          scriptLength: longScript.length,
        }),
      });
    });

    it("trims whitespace from script before execution", async () => {
      mockExecuteUsqlQuery.mockResolvedValue({
        stdout: "{}",
        stderr: "",
        exitCode: 0,
      });

      await handleExecuteScript({
        script: "\n\n  SELECT 1;  \n\n",
      });

      expect(mockExecuteUsqlQuery).toHaveBeenCalledWith(
        expect.any(String),
        "SELECT 1;",
        expect.any(Object)
      );
    });
  });
});
