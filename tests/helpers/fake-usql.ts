import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export function createFakeUsqlBinary(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "usql-fake-"));
  const binaryPath = join(dir, "usql");

  const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
const conn = args[0] || "";
const cmdIdx = args.indexOf("-c");
const query = cmdIdx >= 0 ? args[cmdIdx + 1] : "";
const json = args.includes("--json");
const csv = args.includes("--csv");
const delay = parseInt(process.env.FAKE_USQL_DELAY_MS || "0", 10);
const exitCode = process.env.FAKE_USQL_EXIT_CODE ? parseInt(process.env.FAKE_USQL_EXIT_CODE, 10) : 0;
const stderrText = process.env.FAKE_USQL_STDERR || "";

async function main() {
  if (delay > 0) {
    await new Promise((r) => setTimeout(r, delay));
  }
  if (stderrText) {
    process.stderr.write(stderrText);
  }
  if (exitCode && exitCode !== 0) {
    process.exit(exitCode);
  }
  if (json) {
    process.stdout.write(JSON.stringify({ connection: conn, query }));
  } else if (csv) {
    process.stdout.write("col\\nval");
  } else {
    process.stdout.write("ok");
  }
}

main();
`;

  writeFileSync(binaryPath, script, { encoding: "utf8" });
  chmodSync(binaryPath, 0o755);

  return {
    path: binaryPath,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors in tests
      }
    },
  };
}
