/**
 * Tests for resource URI parsing
 */

import { parseResourceUri, buildResourceUri, ResourceUriError, validateConnectionName } from "../../../src/resources/uri-parser";

describe("parseResourceUri", () => {
  describe("valid URIs", () => {
    it("should parse sql://connections", () => {
      const result = parseResourceUri("sql://connections");
      expect(result).toEqual({
        scheme: "sql",
        resourceType: "connections",
      });
    });

    it("should parse sql://{connection}/databases", () => {
      const result = parseResourceUri("sql://mydb/databases");
      expect(result).toEqual({
        scheme: "sql",
        connection: "mydb",
        resourceType: "databases",
      });
    });

    it("should parse sql://{connection}/{database}/tables", () => {
      const result = parseResourceUri("sql://mydb/testdb/tables");
      expect(result).toEqual({
        scheme: "sql",
        connection: "mydb",
        database: "testdb",
        resourceType: "tables",
      });
    });

    it("should parse sql://{connection}/{database}/table/{table}", () => {
      const result = parseResourceUri("sql://mydb/testdb/table/users");
      expect(result).toEqual({
        scheme: "sql",
        connection: "mydb",
        database: "testdb",
        resourceType: "table",
        table: "users",
      });
    });

    it("should handle URIs with trailing slashes", () => {
      const result = parseResourceUri("sql://connections/");
      expect(result).toEqual({
        scheme: "sql",
        resourceType: "connections",
      });
    });

    it("should handle URIs with multiple trailing slashes", () => {
      const result = parseResourceUri("sql://connections///");
      expect(result).toEqual({
        scheme: "sql",
        resourceType: "connections",
      });
    });
  });

  describe("invalid URIs", () => {
    it("should reject empty URI", () => {
      expect(() => parseResourceUri("")).toThrow(ResourceUriError);
      expect(() => parseResourceUri("")).toThrow("URI must be a non-empty string");
    });

    it("should reject null/undefined", () => {
      expect(() => parseResourceUri(null as any)).toThrow(ResourceUriError);
      expect(() => parseResourceUri(undefined as any)).toThrow(ResourceUriError);
    });

    it("should reject wrong scheme", () => {
      expect(() => parseResourceUri("http://connections")).toThrow(ResourceUriError);
      expect(() => parseResourceUri("http://connections")).toThrow('Invalid URI scheme');
    });

    it("should reject URI with no path", () => {
      expect(() => parseResourceUri("sql://")).toThrow(ResourceUriError);
      expect(() => parseResourceUri("sql://")).toThrow("URI path cannot be empty");
    });

    it("should reject invalid patterns", () => {
      expect(() => parseResourceUri("sql://invalid")).toThrow(ResourceUriError);
      expect(() => parseResourceUri("sql://invalid")).toThrow("Invalid URI pattern");
    });

    it("should reject partial patterns", () => {
      expect(() => parseResourceUri("sql://mydb")).toThrow(ResourceUriError);
      expect(() => parseResourceUri("sql://mydb/testdb")).toThrow(ResourceUriError);
      expect(() => parseResourceUri("sql://mydb/testdb/wrongkeyword")).toThrow(ResourceUriError);
    });
  });
});

describe("buildResourceUri", () => {
  it("should build connections URI", () => {
    const uri = buildResourceUri({
      scheme: "sql",
      resourceType: "connections",
    });
    expect(uri).toBe("sql://connections");
  });

  it("should build databases URI", () => {
    const uri = buildResourceUri({
      scheme: "sql",
      connection: "mydb",
      resourceType: "databases",
    });
    expect(uri).toBe("sql://mydb/databases");
  });

  it("should build tables URI", () => {
    const uri = buildResourceUri({
      scheme: "sql",
      connection: "mydb",
      database: "testdb",
      resourceType: "tables",
    });
    expect(uri).toBe("sql://mydb/testdb/tables");
  });

  it("should build table URI", () => {
    const uri = buildResourceUri({
      scheme: "sql",
      connection: "mydb",
      database: "testdb",
      resourceType: "table",
      table: "users",
    });
    expect(uri).toBe("sql://mydb/testdb/table/users");
  });

  it("should throw error for databases URI without connection", () => {
    expect(() =>
      buildResourceUri({
        scheme: "sql",
        resourceType: "databases",
      })
    ).toThrow(ResourceUriError);
  });

  it("should throw error for tables URI without database", () => {
    expect(() =>
      buildResourceUri({
        scheme: "sql",
        connection: "mydb",
        resourceType: "tables",
      })
    ).toThrow(ResourceUriError);
  });

  it("should throw error for table URI without table name", () => {
    expect(() =>
      buildResourceUri({
        scheme: "sql",
        connection: "mydb",
        database: "testdb",
        resourceType: "table",
      })
    ).toThrow(ResourceUriError);
  });
});

describe("validateConnectionName", () => {
  it("should not throw for valid connection", () => {
    expect(() => validateConnectionName("postgres", ["postgres", "mysql"])).not.toThrow();
  });

  it("should throw for unknown connection", () => {
    expect(() => validateConnectionName("unknown", ["postgres", "mysql"])).toThrow(ResourceUriError);
    expect(() => validateConnectionName("unknown", ["postgres", "mysql"])).toThrow("Unknown connection");
  });

  it("should list available connections in error", () => {
    expect(() => validateConnectionName("bad", ["a", "b", "c"])).toThrow("Available connections: a, b, c");
  });
});

describe("roundtrip parsing", () => {
  it("should parse and rebuild connections URI", () => {
    const original = "sql://connections";
    const parsed = parseResourceUri(original);
    const rebuilt = buildResourceUri(parsed);
    expect(rebuilt).toBe(original);
  });

  it("should parse and rebuild databases URI", () => {
    const original = "sql://mydb/databases";
    const parsed = parseResourceUri(original);
    const rebuilt = buildResourceUri(parsed);
    expect(rebuilt).toBe(original);
  });

  it("should parse and rebuild tables URI", () => {
    const original = "sql://mydb/testdb/tables";
    const parsed = parseResourceUri(original);
    const rebuilt = buildResourceUri(parsed);
    expect(rebuilt).toBe(original);
  });

  it("should parse and rebuild table URI", () => {
    const original = "sql://mydb/testdb/table/users";
    const parsed = parseResourceUri(original);
    const rebuilt = buildResourceUri(parsed);
    expect(rebuilt).toBe(original);
  });
});
