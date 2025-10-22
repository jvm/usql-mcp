/**
 * Unit tests for usql stderr parsing utilities
 */

import { parseUsqlError } from "../../src/usql/parser.js";

describe("parseUsqlError", () => {
  it("returns the first error-like line when present", () => {
    const stderr = `INFO: starting query\nERROR: relation "users" does not exist\nHINT: check schema`;

    const result = parseUsqlError(stderr);

    expect(result).toBe('ERROR: relation "users" does not exist');
  });

  it("detects lowercase error keyword", () => {
    const stderr = `INFO: starting\nerror: column not found\nmore info`;

    const result = parseUsqlError(stderr);

    expect(result).toBe("error: column not found");
  });

  it("detects mixed case Error keyword", () => {
    const stderr = `WARNING: deprecated syntax\nError: invalid syntax\nmore info`;

    const result = parseUsqlError(stderr);

    expect(result).toBe("Error: invalid syntax");
  });

  it("prioritizes first error line when multiple errors exist", () => {
    const stderr = `ERROR: first error\nERROR: second error\nERROR: third error`;

    const result = parseUsqlError(stderr);

    expect(result).toBe("ERROR: first error");
  });

  it("falls back to the first non-empty line when no error keyword found", () => {
    const stderr = `\nwarning: something odd\nadditional context`;

    const result = parseUsqlError(stderr);

    expect(result).toBe("warning: something odd");
  });

  it("skips leading empty lines when finding first non-empty line", () => {
    const stderr = `\n\n\nConnection timeout\nAdditional info`;

    const result = parseUsqlError(stderr);

    expect(result).toBe("Connection timeout");
  });

  it("returns raw stderr when all lines are empty", () => {
    const stderr = "\n\n\n";

    const result = parseUsqlError(stderr);

    expect(result).toBe("\n\n\n");
  });

  it("returns default message for empty stderr", () => {
    const result = parseUsqlError("");

    expect(result).toBe("Unknown error");
  });

  it("trims whitespace from error lines", () => {
    const stderr = `  ERROR: something went wrong  \n  more context  `;

    const result = parseUsqlError(stderr);

    expect(result).toBe("ERROR: something went wrong");
  });

  it("handles stderr with only whitespace", () => {
    const stderr = "    \t\n   \t   \n";

    const result = parseUsqlError(stderr);

    expect(result).toBe("    \t\n   \t   \n");
  });

  it("handles multiline error messages correctly", () => {
    const stderr = `pq: syntax error at or near "SELCT"
LINE 1: SELCT * FROM users
        ^`;

    const result = parseUsqlError(stderr);

    // Should find first non-empty line since no "error"/"Error"/"ERROR" keyword
    expect(result).toBe('pq: syntax error at or near "SELCT"');
  });

  it("detects ERROR in middle of line", () => {
    const stderr = `INFO: Query started\nDatabase ERROR: connection lost\nINFO: Retrying`;

    const result = parseUsqlError(stderr);

    expect(result).toBe("Database ERROR: connection lost");
  });
});
