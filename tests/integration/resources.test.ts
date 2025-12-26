/**
 * Integration tests for resources capability
 * Tests reading actual database metadata via resources
 */

import { readResource } from "../../src/resources/read-resource";
import { listResources, listResourceTemplates } from "../../src/resources/list-resources";
import * as config from "../../src/usql/config";
import { promises as fs } from "fs";
import { join } from "path";
import { executeUsqlQuery } from "../../src/usql/process-executor";

describe("Resources Integration Tests", () => {
  const testDbPath = join(process.cwd(), "tests/integration/test-resources.db");
  const connectionString = `sqlite://${testDbPath}`;

  beforeAll(async () => {
    // Create a test SQLite database with tables
    const createTablesScript = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE
      );
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        title TEXT,
        content TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `;

    await executeUsqlQuery(connectionString, createTablesScript, {
      format: "json",
      timeout: 5000,
    });
  });

  afterAll(async () => {
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  beforeEach(() => {
    // Mock config to include our test connection
    jest.spyOn(config, "loadConfig").mockReturnValue({
      connections: {
        "test-sqlite": { uri: connectionString },
      },
      defaults: {},
    });

    jest.spyOn(config, "resolveConnectionString").mockImplementation((name?: string) => {
      if (name === "test-sqlite" || !name) {
        return connectionString;
      }
      throw new Error(`Unknown connection: ${name}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("listResources", () => {
    it("should list available resources including test connection", async () => {
      const resources = await listResources();

      expect(resources.length).toBeGreaterThanOrEqual(2);
      expect(resources[0].uri).toBe("sql://connections");
      expect(resources.some((r) => r.uri === "sql://test-sqlite/databases")).toBe(true);
    });
  });

  describe("listResourceTemplates", () => {
    it("should list all resource templates", () => {
      const templates = listResourceTemplates();

      expect(templates).toHaveLength(4);
      expect(templates.map((t) => t.uriTemplate)).toEqual([
        "sql://connections",
        "sql://{connection}/databases",
        "sql://{connection}/{database}/tables",
        "sql://{connection}/{database}/table/{table}",
      ]);
    });
  });

  describe("readResource - connections", () => {
    it("should read connections list", async () => {
      const result = await readResource("sql://connections");

      expect(result.uri).toBe("sql://connections");
      expect(result.mimeType).toBe("application/json");
      expect(result.text).toBeDefined();

      const data = JSON.parse(result.text!);
      expect(data.connections).toBeDefined();
      expect(Array.isArray(data.connections)).toBe(true);
      expect(data.connections.some((c: any) => c.name === "test-sqlite")).toBe(true);
    });
  });

  describe("readResource - databases", () => {
    it("should read databases list for SQLite connection", async () => {
      const result = await readResource("sql://test-sqlite/databases");

      expect(result.uri).toBe("sql://test-sqlite/databases");
      expect(result.mimeType).toBe("application/json");
      expect(result.text).toBeDefined();

      // Parse and verify it's valid JSON
      const data = JSON.parse(result.text!);
      expect(Array.isArray(data) || typeof data === "object").toBe(true);
    });
  });

  describe.skip("readResource - tables", () => {
    // TODO: These tests need a database that supports multiple schemas (PostgreSQL/MySQL)
    // SQLite doesn't have separate databases in the same way
    it("should read tables list for SQLite database", async () => {
      // For SQLite, use "main" as the database name (SQLite's default schema name)
      const result = await readResource("sql://test-sqlite/main/tables");

      expect(result.uri).toBe("sql://test-sqlite/main/tables");
      expect(result.mimeType).toBe("application/json");
      expect(result.text).toBeDefined();

      const data = JSON.parse(result.text!);
      expect(Array.isArray(data) || typeof data === "object").toBe(true);
    });
  });

  describe.skip("readResource - table schema", () => {
    // TODO: These tests need a database that supports multiple schemas (PostgreSQL/MySQL)
    it("should read schema for users table", async () => {
      const result = await readResource("sql://test-sqlite/main/table/users");

      expect(result.uri).toBe("sql://test-sqlite/main/table/users");
      expect(result.mimeType).toBe("application/json");
      expect(result.text).toBeDefined();

      const data = JSON.parse(result.text!);
      expect(Array.isArray(data) || typeof data === "object").toBe(true);
    });

    it("should read schema for posts table", async () => {
      const result = await readResource("sql://test-sqlite/main/table/posts");

      expect(result.uri).toBe("sql://test-sqlite/main/table/posts");
      expect(result.mimeType).toBe("application/json");
      expect(result.text).toBeDefined();

      const data = JSON.parse(result.text!);
      expect(Array.isArray(data) || typeof data === "object").toBe(true);
    });

    it("should throw error for non-existent table", async () => {
      await expect(
        readResource("sql://test-sqlite/main/table/nonexistent")
      ).rejects.toThrow();
    });
  });

  describe("error handling", () => {
    it("should reject invalid URI", async () => {
      await expect(readResource("invalid://uri")).rejects.toThrow();
    });

    it("should reject unknown connection", async () => {
      await expect(readResource("sql://unknown-connection/databases")).rejects.toThrow();
    });

    it("should handle malformed URIs gracefully", async () => {
      await expect(readResource("sql://")).rejects.toThrow();
      await expect(readResource("sql://just-one-segment")).rejects.toThrow();
    });
  });
});
