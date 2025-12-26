/**
 * Tests for resource listing
 */

import { listResources, listResourceTemplates } from "../../../src/resources/list-resources";
import * as config from "../../../src/usql/config";

// Mock the config module
jest.mock("../../../src/usql/config");

describe("listResources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should list connections resource and per-connection databases resources", async () => {
    // Mock config with two connections
    (config.loadConfig as jest.Mock).mockReturnValue({
      connections: {
        postgres: { uri: "postgres://localhost" },
        mysql: { uri: "mysql://localhost" },
      },
      defaults: {},
    });

    const resources = await listResources();

    expect(resources).toHaveLength(3); // 1 connections + 2 databases resources

    // Check connections resource
    expect(resources[0]).toEqual({
      uri: "sql://connections",
      name: "Available Database Connections",
      description: "List of all configured database connections",
      mimeType: "application/json",
    });

    // Check postgres databases resource
    expect(resources[1]).toEqual({
      uri: "sql://postgres/databases",
      name: "Databases on postgres",
      description: "List of databases available on the postgres connection",
      mimeType: "application/json",
    });

    // Check mysql databases resource
    expect(resources[2]).toEqual({
      uri: "sql://mysql/databases",
      name: "Databases on mysql",
      description: "List of databases available on the mysql connection",
      mimeType: "application/json",
    });
  });

  it("should handle config with no connections", async () => {
    (config.loadConfig as jest.Mock).mockReturnValue({
      connections: {},
      defaults: {},
    });

    const resources = await listResources();

    expect(resources).toHaveLength(1); // Only connections resource
    expect(resources[0].uri).toBe("sql://connections");
  });

  it("should handle config with single connection", async () => {
    (config.loadConfig as jest.Mock).mockReturnValue({
      connections: {
        postgres: { uri: "postgres://localhost" },
      },
      defaults: {},
    });

    const resources = await listResources();

    expect(resources).toHaveLength(2); // connections + postgres databases
    expect(resources[0].uri).toBe("sql://connections");
    expect(resources[1].uri).toBe("sql://postgres/databases");
  });
});

describe("listResourceTemplates", () => {
  it("should return all resource templates", () => {
    const templates = listResourceTemplates();

    expect(templates).toHaveLength(4);

    // Verify template structure
    expect(templates[0]).toEqual({
      uriTemplate: "sql://connections",
      name: "Database Connections",
      description: "List of all configured database connections",
      mimeType: "application/json",
    });

    expect(templates[1]).toEqual({
      uriTemplate: "sql://{connection}/databases",
      name: "Databases",
      description: "List of databases on a specific connection",
      mimeType: "application/json",
    });

    expect(templates[2]).toEqual({
      uriTemplate: "sql://{connection}/{database}/tables",
      name: "Tables",
      description: "List of tables in a specific database",
      mimeType: "application/json",
    });

    expect(templates[3]).toEqual({
      uriTemplate: "sql://{connection}/{database}/table/{table}",
      name: "Table Schema",
      description: "Detailed schema information for a specific table",
      mimeType: "application/json",
    });
  });

  it("should have consistent mimeType across all templates", () => {
    const templates = listResourceTemplates();
    expect(templates.every((t) => t.mimeType === "application/json")).toBe(true);
  });

  it("should have all required fields", () => {
    const templates = listResourceTemplates();
    templates.forEach((template) => {
      expect(template.uriTemplate).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.description).toBeDefined();
      expect(template.mimeType).toBeDefined();
    });
  });
});
