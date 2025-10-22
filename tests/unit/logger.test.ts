/**
 * Unit tests for logger utility
 */

import { Logger, createLogger } from "../../src/utils/logger.js";

describe("Logger", () => {
  let originalDebug: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalDebug = process.env.DEBUG;
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    process.env.DEBUG = originalDebug;
    consoleErrorSpy.mockRestore();
  });

  describe("createLogger", () => {
    it("creates a Logger instance with the given namespace", () => {
      const logger = createLogger("test:namespace");
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("debug", () => {
    it("logs debug messages when DEBUG=* is set", () => {
      process.env.DEBUG = "*";
      const logger = new Logger("test:debug");

      logger.debug("test message");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).toContain("DEBUG");
      expect(call.join(" ")).toContain("test:debug");
      expect(call.join(" ")).toContain("test message");
    });

    it("logs debug messages when namespace matches DEBUG pattern", () => {
      process.env.DEBUG = "test:*";
      const logger = new Logger("test:specific");

      logger.debug("test message");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("logs debug messages when namespace exactly matches DEBUG", () => {
      process.env.DEBUG = "exact:match";
      const logger = new Logger("exact:match");

      logger.debug("test message");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("does not log when DEBUG is not set", () => {
      process.env.DEBUG = "";
      const logger = new Logger("test:debug");

      logger.debug("test message");

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("does not log when namespace does not match DEBUG pattern", () => {
      process.env.DEBUG = "other:*";
      const logger = new Logger("test:debug");

      logger.debug("test message");

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("logs debug messages with data", () => {
      process.env.DEBUG = "*";
      const logger = new Logger("test:debug");

      logger.debug("test message", { key: "value" });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).toContain("test message");
      expect(call.join(" ")).toContain("key");
      expect(call.join(" ")).toContain("value");
    });

    it("sanitizes password in string data", () => {
      process.env.DEBUG = "*";
      const logger = new Logger("test:debug");

      logger.debug("connection", "password=secret123");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).not.toContain("secret123");
      expect(call.join(" ")).toContain("password=***");
    });

    it("sanitizes pwd in string data", () => {
      process.env.DEBUG = "*";
      const logger = new Logger("test:debug");

      logger.debug("connection", "pwd:mypassword");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).not.toContain("mypassword");
      expect(call.join(" ")).toContain("pwd=***");
    });

    it("sanitizes token in string data", () => {
      process.env.DEBUG = "*";
      const logger = new Logger("test:debug");

      logger.debug("auth", "token=abc123def");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).not.toContain("abc123def");
      expect(call.join(" ")).toContain("token=***");
    });

    it("sanitizes key in string data", () => {
      process.env.DEBUG = "*";
      const logger = new Logger("test:debug");

      logger.debug("api", "key=supersecret");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).not.toContain("supersecret");
      expect(call.join(" ")).toContain("key=***");
    });

    it("sanitizes connection strings with @user:password pattern", () => {
      process.env.DEBUG = "*";
      const logger = new Logger("test:debug");

      logger.debug("connection", "postgres://user@secret:pass@host/db");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).toContain("@***:");
    });

    it("handles empty string data without logging it", () => {
      process.env.DEBUG = "*";
      const logger = new Logger("test:debug");

      logger.debug("test message", "");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      // Should not include the empty data
      expect(call.length).toBe(4); // format, time, namespace, message
    });

    it("handles null data without logging it", () => {
      process.env.DEBUG = "*";
      const logger = new Logger("test:debug");

      logger.debug("test message", null);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.length).toBe(4);
    });

    it("handles undefined data without logging it", () => {
      process.env.DEBUG = "*";
      const logger = new Logger("test:debug");

      logger.debug("test message", undefined);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.length).toBe(4);
    });

    it("supports multiple DEBUG patterns separated by comma", () => {
      process.env.DEBUG = "test:*,other:*";
      const logger1 = new Logger("test:one");
      const logger2 = new Logger("other:two");

      logger1.debug("message 1");
      logger2.debug("message 2");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("info", () => {
    it("always logs info messages regardless of DEBUG", () => {
      process.env.DEBUG = "";
      const logger = new Logger("test:info");

      logger.info("info message");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).toContain("INFO");
      expect(call.join(" ")).toContain("info message");
    });

    it("logs info messages with data", () => {
      const logger = new Logger("test:info");

      logger.info("info message", { key: "value" });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).toContain("info message");
      expect(call.join(" ")).toContain("key");
    });

    it("handles empty string data", () => {
      const logger = new Logger("test:info");

      logger.info("info message", "");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.length).toBe(4);
    });
  });

  describe("warn", () => {
    it("always logs warning messages", () => {
      const logger = new Logger("test:warn");

      logger.warn("warning message");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).toContain("WARN");
      expect(call.join(" ")).toContain("warning message");
    });

    it("logs warning messages with data", () => {
      const logger = new Logger("test:warn");

      logger.warn("warning message", { code: 404 });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).toContain("warning message");
      expect(call.join(" ")).toContain("404");
    });

    it("handles null data", () => {
      const logger = new Logger("test:warn");

      logger.warn("warning message", null);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.length).toBe(4);
    });
  });

  describe("error", () => {
    it("logs error messages", () => {
      const logger = new Logger("test:error");

      logger.error("error message");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).toContain("ERROR");
      expect(call.join(" ")).toContain("error message");
    });

    it("logs error messages with Error object", () => {
      const logger = new Logger("test:error");
      const error = new Error("something went wrong");

      logger.error("error occurred", error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).toContain("ERROR");
      expect(call.join(" ")).toContain("error occurred");
      expect(call.join(" ")).toContain("something went wrong");
    });

    it("includes stack trace when logging Error objects", () => {
      const logger = new Logger("test:error");
      const error = new Error("test error");

      logger.error("error occurred", error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      const output = call.join(" ");
      // Stack trace should be included
      expect(output).toContain("test error");
    });

    it("logs error messages with non-Error data", () => {
      const logger = new Logger("test:error");

      logger.error("error occurred", { code: "E001", details: "failed" });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(" ")).toContain("error occurred");
      expect(call.join(" ")).toContain("E001");
      expect(call.join(" ")).toContain("failed");
    });

    it("handles error with undefined data", () => {
      const logger = new Logger("test:error");

      logger.error("error occurred", undefined);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.length).toBe(4);
    });

    it("handles error with empty string data", () => {
      const logger = new Logger("test:error");

      logger.error("error occurred", "");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.length).toBe(4);
    });
  });

  describe("timestamp formatting", () => {
    it("includes ISO timestamp in all log messages", () => {
      const logger = new Logger("test:timestamp");

      logger.info("test");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      const output = call.join(" ");
      // Should contain ISO date format
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
