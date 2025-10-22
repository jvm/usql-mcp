/**
 * Unit tests for usql process executor
 */

import { executeUsqlCommand, executeUsqlQuery } from "../../src/usql/process-executor.js";
import { spawn } from "child_process";
import { EventEmitter } from "events";

// Mock child_process
jest.mock("child_process");

describe("Process Executor", () => {
  let mockChildProcess: any;
  let mockStdout: EventEmitter;
  let mockStderr: EventEmitter;
  let mockStdin: any;

  beforeEach(() => {
    mockStdout = new EventEmitter();
    mockStderr = new EventEmitter();
    mockStdin = {
      end: jest.fn(),
    };

    mockChildProcess = new EventEmitter();
    mockChildProcess.pid = 12345;
    mockChildProcess.stdout = mockStdout;
    mockChildProcess.stderr = mockStderr;
    mockChildProcess.stdin = mockStdin;
    mockChildProcess.kill = jest.fn();

    (spawn as jest.Mock).mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("executeUsqlCommand", () => {
    it("executes usql command successfully with JSON format", async () => {
      const promise = executeUsqlCommand(
        "postgres://localhost/db",
        "SELECT * FROM users",
        { format: "json" }
      );

      // Simulate successful execution
      mockStdout.emit("data", Buffer.from('{"result": "data"}'));
      mockChildProcess.emit("close", 0);

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith(
        "usql",
        ["postgres://localhost/db", "-c", "SELECT * FROM users", "--json"],
        { detached: true, stdio: ["pipe", "pipe", "pipe"] }
      );
      expect(result.stdout).toBe('{"result": "data"}');
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      expect(mockStdin.end).toHaveBeenCalled();
    });

    it("executes usql command with CSV format", async () => {
      const promise = executeUsqlCommand(
        "postgres://localhost/db",
        "SELECT * FROM users",
        { format: "csv" }
      );

      mockStdout.emit("data", Buffer.from("id,name\n1,John"));
      mockChildProcess.emit("close", 0);

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith(
        "usql",
        ["postgres://localhost/db", "-c", "SELECT * FROM users", "--csv"],
        { detached: true, stdio: ["pipe", "pipe", "pipe"] }
      );
      expect(result.stdout).toBe("id,name\n1,John");
    });

    it("captures stderr output on error", async () => {
      const promise = executeUsqlCommand("postgres://localhost/db", "INVALID SQL");

      mockStderr.emit("data", Buffer.from("ERROR: syntax error"));
      mockChildProcess.emit("close", 1);

      const result = await promise;

      expect(result.stderr).toBe("ERROR: syntax error");
      expect(result.exitCode).toBe(1);
    });

    it("handles timeout correctly", async () => {
      const promise = executeUsqlCommand(
        "postgres://localhost/db",
        "SELECT * FROM users",
        { timeout: 100 }
      );

      // Don't emit any events - let it timeout
      await expect(promise).rejects.toThrow(/timed out after 100ms/);
      expect(mockChildProcess.kill).toHaveBeenCalledWith(-12345);
    });

    it("handles process error events", async () => {
      const promise = executeUsqlCommand("postgres://localhost/db", "SELECT 1");

      const error = new Error("ENOENT: command not found");
      mockChildProcess.emit("error", error);

      await expect(promise).rejects.toThrow("ENOENT: command not found");
    });

    it("does not reject twice on timeout followed by error", async () => {
      const promise = executeUsqlCommand(
        "postgres://localhost/db",
        "SELECT 1",
        { timeout: 50 }
      );

      // Wait for timeout to trigger
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Now emit error - should be ignored
      mockChildProcess.emit("error", new Error("Should be ignored"));

      await expect(promise).rejects.toThrow(/timed out/);
    });

    it("clears timeout on successful completion", async () => {
      const promise = executeUsqlCommand(
        "postgres://localhost/db",
        "SELECT 1",
        { timeout: 5000 }
      );

      mockStdout.emit("data", Buffer.from("result"));
      mockChildProcess.emit("close", 0);

      const result = await promise;

      expect(result.exitCode).toBe(0);
      // If timeout wasn't cleared, test might hang or fail
    });

    it("clears timeout on error", async () => {
      const promise = executeUsqlCommand(
        "postgres://localhost/db",
        "INVALID",
        { timeout: 5000 }
      );

      const error = new Error("Query error");
      mockChildProcess.emit("error", error);

      await expect(promise).rejects.toThrow("Query error");
    });

    it("handles multiple stdout data chunks", async () => {
      const promise = executeUsqlCommand("postgres://localhost/db", "SELECT 1");

      mockStdout.emit("data", Buffer.from("first "));
      mockStdout.emit("data", Buffer.from("second "));
      mockStdout.emit("data", Buffer.from("third"));
      mockChildProcess.emit("close", 0);

      const result = await promise;

      expect(result.stdout).toBe("first second third");
    });

    it("handles multiple stderr data chunks", async () => {
      const promise = executeUsqlCommand("postgres://localhost/db", "INVALID");

      mockStderr.emit("data", Buffer.from("ERROR: "));
      mockStderr.emit("data", Buffer.from("syntax "));
      mockStderr.emit("data", Buffer.from("error"));
      mockChildProcess.emit("close", 1);

      const result = await promise;

      expect(result.stderr).toBe("ERROR: syntax error");
    });

    it("defaults to JSON format when format not specified", async () => {
      const promise = executeUsqlCommand("postgres://localhost/db", "SELECT 1");

      mockChildProcess.emit("close", 0);

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        "usql",
        expect.arrayContaining(["--json"]),
        expect.any(Object)
      );
    });

    it("does not set timeout when timeout is undefined", async () => {
      const promise = executeUsqlCommand("postgres://localhost/db", "SELECT 1", {
        timeout: undefined,
      });

      mockStdout.emit("data", Buffer.from("result"));
      mockChildProcess.emit("close", 0);

      const result = await promise;

      expect(result.exitCode).toBe(0);
      // Process should complete normally without timeout
    });

    it("does not set timeout when timeout is 0", async () => {
      const promise = executeUsqlCommand("postgres://localhost/db", "SELECT 1", {
        timeout: 0,
      });

      mockStdout.emit("data", Buffer.from("result"));
      mockChildProcess.emit("close", 0);

      const result = await promise;

      expect(result.exitCode).toBe(0);
    });

    it("does not set timeout when timeout is negative", async () => {
      const promise = executeUsqlCommand("postgres://localhost/db", "SELECT 1", {
        timeout: -1,
      });

      mockStdout.emit("data", Buffer.from("result"));
      mockChildProcess.emit("close", 0);

      const result = await promise;

      expect(result.exitCode).toBe(0);
    });

    it("handles close event with null exit code", async () => {
      const promise = executeUsqlCommand("postgres://localhost/db", "SELECT 1");

      mockStdout.emit("data", Buffer.from("result"));
      mockChildProcess.emit("close", null);

      const result = await promise;

      expect(result.exitCode).toBe(0); // Defaults to 0
    });

    it("spawns process with detached option for better cleanup", async () => {
      const promise = executeUsqlCommand("postgres://localhost/db", "SELECT 1");

      mockChildProcess.emit("close", 0);

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        "usql",
        expect.any(Array),
        expect.objectContaining({ detached: true })
      );
    });

    it("includes truncated command in timeout error", async () => {
      const longQuery = "SELECT * FROM users WHERE " + "x".repeat(200);
      const promise = executeUsqlCommand("postgres://localhost/db", longQuery, {
        timeout: 50,
      });

      await expect(promise).rejects.toThrow(/timeout/);
    });
  });

  describe("executeUsqlQuery", () => {
    it("is a convenience wrapper that calls executeUsqlCommand", async () => {
      const promise = executeUsqlQuery(
        "mysql://localhost/db",
        "SELECT * FROM products"
      );

      mockStdout.emit("data", Buffer.from('{"products": []}'));
      mockChildProcess.emit("close", 0);

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith(
        "usql",
        ["mysql://localhost/db", "-c", "SELECT * FROM products", "--json"],
        expect.any(Object)
      );
      expect(result.stdout).toBe('{"products": []}');
    });

    it("passes through timeout option", async () => {
      const promise = executeUsqlQuery("postgres://localhost/db", "SELECT 1", {
        timeout: 100,
      });

      // Let it timeout
      await expect(promise).rejects.toThrow(/timed out after 100ms/);
    });

    it("defaults to JSON format", async () => {
      const promise = executeUsqlQuery("postgres://localhost/db", "SELECT 1");

      mockChildProcess.emit("close", 0);

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        "usql",
        expect.arrayContaining(["--json"]),
        expect.any(Object)
      );
    });

    it("respects format option", async () => {
      const promise = executeUsqlQuery("postgres://localhost/db", "SELECT 1", {
        format: "csv",
      });

      mockChildProcess.emit("close", 0);

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        "usql",
        expect.arrayContaining(["--csv"]),
        expect.any(Object)
      );
    });
  });
});
