import {
  resolveConnectionStringOrDefault,
  resetConfigCache,
  loadConfig,
  getConnection,
  resolveConnectionString,
  getQueryTimeout,
  getDefaultConnectionName,
} from "../../src/usql/config.js";
import { writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";

describe("Config Module", () => {
  const originalEnv = { ...process.env };
  const testConfigPath = resolve("./test-config.json");

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.USQL_ORACLE;
    delete process.env.USQL_DEFAULT_CONNECTION;
    delete process.env.USQL_QUERY_TIMEOUT_MS;
    delete process.env.USQL_CONFIG_PATH;
    resetConfigCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfigCache();
    try {
      unlinkSync(testConfigPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe("loadConfig", () => {
    it("loads default config when no file or env vars are present", () => {
      const config = loadConfig();

      expect(config).toBeDefined();
      expect(config.connections).toEqual({});
      expect(config.defaults?.maxResultRows).toBe(10000);
      expect(config.defaults?.queryTimeout).toBeUndefined();
      expect(config.defaults?.defaultConnection).toBeUndefined();
    });

    it("loads config from file when USQL_CONFIG_PATH is set", () => {
      const testConfig = {
        connections: {
          test: {
            uri: "postgres://localhost/testdb",
            description: "Test database",
          },
        },
        defaults: {
          queryTimeout: 5000,
          maxResultRows: 1000,
        },
      };

      writeFileSync(testConfigPath, JSON.stringify(testConfig));
      process.env.USQL_CONFIG_PATH = testConfigPath;
      resetConfigCache();

      const config = loadConfig();

      expect(config.connections.test).toEqual(testConfig.connections.test);
      expect(config.defaults?.queryTimeout).toBe(5000);
      expect(config.defaults?.maxResultRows).toBe(1000);
    });

    it("loads connections from USQL_* environment variables", () => {
      process.env.USQL_POSTGRES = "postgres://localhost/db1";
      process.env.USQL_MYSQL = "mysql://localhost/db2";
      resetConfigCache();

      const config = loadConfig();

      expect(config.connections.postgres?.uri).toBe("postgres://localhost/db1");
      expect(config.connections.mysql?.uri).toBe("mysql://localhost/db2");
    });

    it("ignores special USQL_ environment variables", () => {
      process.env.USQL_CONFIG_PATH = "/some/path";
      process.env.USQL_QUERY_TIMEOUT_MS = "5000";
      process.env.USQL_DEFAULT_CONNECTION = "test";
      resetConfigCache();

      const config = loadConfig();

      // These should not appear as connections
      expect(config.connections.config_path).toBeUndefined();
      expect(config.connections.query_timeout_ms).toBeUndefined();
      expect(config.connections.default_connection).toBeUndefined();
    });

    it("loads query timeout from environment variable", () => {
      process.env.USQL_QUERY_TIMEOUT_MS = "30000";
      resetConfigCache();

      const config = loadConfig();

      expect(config.defaults?.queryTimeout).toBe(30000);
    });

    it("ignores invalid query timeout values", () => {
      process.env.USQL_QUERY_TIMEOUT_MS = "not-a-number";
      resetConfigCache();

      const config = loadConfig();

      expect(config.defaults?.queryTimeout).toBeUndefined();
    });

    it("loads default connection from environment variable", () => {
      process.env.USQL_DEFAULT_CONNECTION = "POSTGRES";
      resetConfigCache();

      const config = loadConfig();

      expect(config.defaults?.defaultConnection).toBe("postgres");
    });

    it("caches config after first load", () => {
      const config1 = loadConfig();
      process.env.USQL_NEW = "postgres://localhost/new";
      const config2 = loadConfig();

      expect(config1).toBe(config2); // Same object reference
      expect(config2.connections.new).toBeUndefined(); // Env var not picked up
    });

    it("handles missing config file gracefully when not explicitly configured", () => {
      process.env.USQL_CONFIG_PATH = undefined;
      resetConfigCache();

      expect(() => loadConfig()).not.toThrow();
    });

    it("warns when explicitly configured config file is missing", () => {
      process.env.USQL_CONFIG_PATH = "/nonexistent/config.json";
      resetConfigCache();

      // Should not throw, but would log warning (we can't easily test console output)
      expect(() => loadConfig()).not.toThrow();
    });

    it("handles malformed config file gracefully", () => {
      writeFileSync(testConfigPath, "{ invalid json ");
      process.env.USQL_CONFIG_PATH = testConfigPath;
      resetConfigCache();

      // Should not throw, falls back to defaults
      expect(() => loadConfig()).not.toThrow();
    });
  });

  describe("getConnection", () => {
    it("returns connection config by name", () => {
      process.env.USQL_POSTGRES = "postgres://localhost/db";
      resetConfigCache();

      const conn = getConnection("postgres");

      expect(conn).toBeDefined();
      expect(conn?.uri).toBe("postgres://localhost/db");
    });

    it("returns connection config for URI directly", () => {
      const uri = "mysql://localhost/db";
      const conn = getConnection(uri);

      expect(conn).toBeDefined();
      expect(conn?.uri).toBe(uri);
    });

    it("returns null for unknown connection name", () => {
      resetConfigCache();

      const conn = getConnection("unknown");

      expect(conn).toBeNull();
    });

    it("is case-insensitive for connection names", () => {
      process.env.USQL_POSTGRES = "postgres://localhost/db";
      resetConfigCache();

      const conn1 = getConnection("postgres");
      const conn2 = getConnection("POSTGRES");
      const conn3 = getConnection("PoStGrEs");

      expect(conn1?.uri).toBe("postgres://localhost/db");
      expect(conn2?.uri).toBe("postgres://localhost/db");
      expect(conn3?.uri).toBe("postgres://localhost/db");
    });
  });

  describe("resolveConnectionString", () => {
    it("resolves connection name to URI", () => {
      process.env.USQL_ORACLE = "oracle://localhost/db";
      resetConfigCache();

      const uri = resolveConnectionString("oracle");

      expect(uri).toBe("oracle://localhost/db");
    });

    it("returns URI directly when provided", () => {
      const uri = "postgres://localhost/db";
      const result = resolveConnectionString(uri);

      expect(result).toBe(uri);
    });

    it("throws error for unknown connection name", () => {
      resetConfigCache();

      expect(() => resolveConnectionString("unknown")).toThrow(
        /Connection not found: unknown/
      );
    });

    it("includes available connections in error message", () => {
      process.env.USQL_POSTGRES = "postgres://localhost/db";
      process.env.USQL_MYSQL = "mysql://localhost/db";
      resetConfigCache();

      expect(() => resolveConnectionString("unknown")).toThrow(/postgres/);
      expect(() => resolveConnectionString("unknown")).toThrow(/mysql/);
    });
  });

  describe("resolveConnectionStringOrDefault", () => {
    it("returns explicitly provided URI", () => {
      const uri = "postgres://user:pass@localhost:5432/app";
      const result = resolveConnectionStringOrDefault(uri);

      expect(result).toBe(uri);
    });

    it("uses default connection when no URI is provided", () => {
      const oracleUri = "oracle://user:pass@db-host:1521/service";
      process.env.USQL_ORACLE = oracleUri;
      process.env.USQL_DEFAULT_CONNECTION = "ORACLE";
      resetConfigCache();

      const result = resolveConnectionStringOrDefault();

      expect(result).toBe(oracleUri);
    });

    it("throws when no connection information is available", () => {
      resetConfigCache();

      expect(() => resolveConnectionStringOrDefault()).toThrow(
        /No connection string provided and no default connection configured/
      );
    });

    it("resolves named connection when provided", () => {
      process.env.USQL_POSTGRES = "postgres://localhost/db";
      resetConfigCache();

      const result = resolveConnectionStringOrDefault("postgres");

      expect(result).toBe("postgres://localhost/db");
    });

    it("handles empty string as no input", () => {
      process.env.USQL_POSTGRES = "postgres://localhost/db";
      process.env.USQL_DEFAULT_CONNECTION = "postgres";
      resetConfigCache();

      const result = resolveConnectionStringOrDefault("");

      expect(result).toBe("postgres://localhost/db");
    });

    it("handles whitespace-only string as no input", () => {
      process.env.USQL_POSTGRES = "postgres://localhost/db";
      process.env.USQL_DEFAULT_CONNECTION = "postgres";
      resetConfigCache();

      const result = resolveConnectionStringOrDefault("   ");

      expect(result).toBe("postgres://localhost/db");
    });
  });

  describe("getQueryTimeout", () => {
    it("returns query timeout from config", () => {
      process.env.USQL_QUERY_TIMEOUT_MS = "15000";
      resetConfigCache();

      const timeout = getQueryTimeout();

      expect(timeout).toBe(15000);
    });

    it("returns undefined when no timeout is configured", () => {
      resetConfigCache();

      const timeout = getQueryTimeout();

      expect(timeout).toBeUndefined();
    });
  });

  describe("getDefaultConnectionName", () => {
    it("returns default connection name from config", () => {
      process.env.USQL_DEFAULT_CONNECTION = "my_db";
      resetConfigCache();

      const name = getDefaultConnectionName();

      expect(name).toBe("my_db");
    });

    it("returns undefined when no default connection is configured", () => {
      resetConfigCache();

      const name = getDefaultConnectionName();

      expect(name).toBeUndefined();
    });
  });
});
