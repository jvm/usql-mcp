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

  it("falls back to the first non-empty line", () => {
    const stderr = `\nwarning: something odd\nadditional context`;

    const result = parseUsqlError(stderr);

    expect(result).toBe("warning: something odd");
  });

  it("returns a default message for empty stderr", () => {
    const result = parseUsqlError("");

    expect(result).toBe("Unknown error");
  });
});
