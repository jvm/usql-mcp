import { createLogger } from "../utils/logger.js";

const logger = createLogger("usql-mcp:parser");

/**
 * Maximum length for extracted error messages (chars)
 * This prevents returning massive multi-line error traces
 */
const MAX_ERROR_MESSAGE_LENGTH = 500;

/**
 * Regular expressions to detect error lines
 */
const ERROR_PATTERN =
  /^.*\b(?:error|ERROR|Error|failed|FAILED|Failed|fatal|FATAL|Fatal|exception|EXCEPTION|Exception)\b/i;

/**
 * Patterns for lines that should be skipped (usually not helpful)
 */
const SKIP_PATTERNS = [
  /^Context:/i,
  /^Hint:/i,
  /^Statement:/i,
  /^\s*\^/i, // Caret lines pointing to errors
  /^Position:/i,
  /^Line \d+:/i,
  /^\d+ \|/i, // Line numbers from context
  /^[a-z_]+=.*$/i, // Variable assignments
  /^\s*$/i, // Empty lines
];

/**
 * Check if a line should be skipped in error parsing
 */
function shouldSkipLine(line: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Parse error messages from usql stderr.
 * Extracts the first meaningful error line, handling multi-line errors and context.
 * Returns a concise, informative error message.
 */
export function parseUsqlError(stderr: string): string {
  logger.debug("[parser] Parsing usql error");

  if (!stderr || typeof stderr !== "string") {
    return "Unknown error";
  }

  // Split into lines and filter out empty/skip lines
  const lines = stderr.split("\n").filter((line) => !shouldSkipLine(line));

  if (lines.length === 0) {
    return "Unknown error";
  }

  // First pass: find a line matching error pattern
  for (const line of lines) {
    if (ERROR_PATTERN.test(line)) {
      const trimmed = line.trim();
      // Limit message length
      return trimmed.length > MAX_ERROR_MESSAGE_LENGTH
        ? trimmed.substring(0, MAX_ERROR_MESSAGE_LENGTH) + "..."
        : trimmed;
    }
  }

  // Second pass: return first non-empty, non-skipped line
  const firstMeaningfulLine = lines[0]?.trim();
  if (firstMeaningfulLine) {
    return firstMeaningfulLine.length > MAX_ERROR_MESSAGE_LENGTH
      ? firstMeaningfulLine.substring(0, MAX_ERROR_MESSAGE_LENGTH) + "..."
      : firstMeaningfulLine;
  }

  // Fallback: return original stderr up to max length
  const fallback = stderr.trim();
  return fallback.length > MAX_ERROR_MESSAGE_LENGTH
    ? fallback.substring(0, MAX_ERROR_MESSAGE_LENGTH) + "..."
    : fallback;
}
