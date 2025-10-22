import { resolveConnectionStringOrDefault, resetConfigCache } from "../../src/usql/config.js";

describe("resolveConnectionStringOrDefault", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.USQL_ORACLE;
    delete process.env.USQL_DEFAULT_CONNECTION;
    resetConfigCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfigCache();
  });

  it("returns an explicitly provided URI", () => {
    const uri = "postgres://user:pass@localhost:5432/app";
    const result = resolveConnectionStringOrDefault(uri);

    expect(result).toBe(uri);
  });

  it("uses the default connection when no URI is provided", () => {
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
});
