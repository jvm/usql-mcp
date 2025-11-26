import { executeUsqlCommand } from "../../src/usql/process-executor.js";
import { createFakeUsqlBinary } from "../helpers/fake-usql.js";

describe("executeUsqlCommand with fake usql binary", () => {
  const originalEnv = { ...process.env };
  let cleanupFn: () => void;

  beforeAll(() => {
    const fake = createFakeUsqlBinary();
    cleanupFn = fake.cleanup;
    process.env.USQL_BINARY_PATH = fake.path;
    process.env.USQL_BACKGROUND_THRESHOLD_MS = "30000"; // avoid backgrounding
  });

  afterAll(() => {
    cleanupFn?.();
    process.env = { ...originalEnv };
  });

  it("returns stdout for json format", async () => {
    const result = await executeUsqlCommand("postgres://local/db", "SELECT 1", { format: "json" });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("SELECT 1");
    expect(result.stderr).toBe("");
  });

  it("returns stdout for csv format", async () => {
    const result = await executeUsqlCommand("postgres://local/db", "SELECT 1", { format: "csv" });
    expect(result.stdout.trim()).toBe("col\nval");
  });

  it("honors timeout by throwing QueryTimeout when fake usql stalls", async () => {
    process.env.FAKE_USQL_DELAY_MS = "20";
    await expect(
      executeUsqlCommand("postgres://local/db", "SELECT pg_sleep(1)", { timeout: 10 })
    ).rejects.toThrow(/timed out/i);
    delete process.env.FAKE_USQL_DELAY_MS;
  });

  it("propagates non-zero exit codes from fake usql", async () => {
    process.env.FAKE_USQL_EXIT_CODE = "2";
    process.env.FAKE_USQL_STDERR = "boom";
    const result = await executeUsqlCommand("postgres://local/db", "SELECT 1", { format: "json" });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("boom");
    delete process.env.FAKE_USQL_EXIT_CODE;
    delete process.env.FAKE_USQL_STDERR;
  });
});
