import { createLogger } from "../utils/logger.js";

const logger = createLogger("usql-mcp:parser");

/**
 * Parse error messages from usql stderr.
 * Returns the first line that looks like an error, falling back to
 * the first non-empty line, and ultimately the raw stderr output.
 */
export function parseUsqlError(stderr: string): string {
  logger.debug("[parser] Parsing usql error");

  if (!stderr) {
    return "Unknown error";
  }

  // Extract the most relevant error message
  const lines = stderr.split("\n");
  for (const line of lines) {
    if (line.includes("error") || line.includes("Error") || line.includes("ERROR")) {
      return line.trim();
    }
  }

  // If no error line found, return first non-empty line
  for (const line of lines) {
    if (line.trim()) {
      return line.trim();
    }
  }

  return stderr;
}
