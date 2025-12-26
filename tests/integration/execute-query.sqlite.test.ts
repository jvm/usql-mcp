/**
 * Minimal integration test for execute_query against SQLite via usql.
 * Skips gracefully if usql is not installed.
 */

import { execSync } from "child_process";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { handleExecuteQuery } from "../../src/tools/execute-query.js";
import { resolveConnectionStringOrDefault, resetConfigCache } from "../../src/usql/config.js";

// Skip if usql binary is unavailable
function hasUsql(): boolean {
  try {
    execSync("usql --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("Integration: execute_query with SQLite", () => {
  if (!hasUsql()) {
    it("skips because usql is not installed", () => {
      expect(true).toBe(true);
    });
    return;
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "usql-mcp-"));
  const dbPath = join(tmpDir, "test.db");
  const conn = `sqlite://${dbPath}`;

  beforeAll(() => {
    // Initialize a simple schema using sqlite3 CLI
    execSync(`sqlite3 "${dbPath}" "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO users (name) VALUES ('alice'), ('bob');"`);

    // Patch config to include our temp connection
    resetConfigCache();
    process.env.USQL_SQLITE = conn;
    process.env.USQL_DEFAULT_CONNECTION = "sqlite";

    // Validate the resolution works
    expect(resolveConnectionStringOrDefault()).toBe(conn);
  });

  afterAll(() => {
    delete process.env.USQL_SQLITE;
    delete process.env.USQL_DEFAULT_CONNECTION;
    resetConfigCache();
  });

  it("returns rows from sqlite via usql", async () => {
    const raw = await handleExecuteQuery({
      query: "SELECT name FROM users ORDER BY id",
    });

    if ("status" in raw && raw.status === "background") {
      throw new Error("Integration test should not background");
    }

    const result = raw as Awaited<ReturnType<typeof handleExecuteQuery>>;
    if ("status" in result) {
      throw new Error("Unexpected background status");
    }

    expect(result.format).toBe("json");
    expect(result.content).toContain("alice");
    expect(result.content).toContain("bob");
  });
});
