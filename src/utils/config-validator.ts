/**
 * Configuration validation schema and utilities
 * Uses Zod for robust, typed validation with helpful error messages
 */

import { z } from "zod";

/**
 * Zod schema for configuration validation
 * Accepts both string and numeric inputs with automatic coercion
 * Allows additional connection name properties
 */
const configSchema = z
  .object({
    queryTimeoutMs: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        const num = typeof val === "string" ? parseInt(val, 10) : val;
        return num;
      })
      .refine(
        (val) => val === undefined || (Number.isFinite(val) && val > 0),
        "queryTimeoutMs must be a positive number"
      ),
    jobResultTtlMs: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        const num = typeof val === "string" ? parseInt(val, 10) : val;
        return num;
      })
      .refine(
        (val) => val === undefined || (Number.isFinite(val) && val > 0),
        "jobResultTtlMs must be a positive number"
      ),
    allowDestructiveOperations: z
      .union([z.boolean(), z.string(), z.null()])
      .optional()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (typeof val === "boolean") return val;
        const lower = (val as string).toLowerCase();
        if (lower === "true") return true;
        if (lower === "false") return false;
        return val; // Return invalid value to be caught by refine
      })
      .refine(
        (val) =>
          val === undefined || typeof val === "boolean",
        'allowDestructiveOperations must be "true" or "false"'
      ),
  })
  .passthrough() // Allow additional properties (connection names)
  .superRefine((data, ctx) => {
    // Validate unknown keys - provide helpful suggestions for typos
    const validKeys = [
      "queryTimeoutMs",
      "jobResultTtlMs",
      "allowDestructiveOperations",
    ];
    const knownConnectionPattern = /^[A-Z][A-Z0-9_]*$/;

    for (const key of Object.keys(data)) {
      if (!validKeys.includes(key) && !knownConnectionPattern.test(key)) {
        const suggestion = findSimilarKey(key, validKeys);
        ctx.addIssue({
          code: z.ZodIssueCode.unrecognized_keys,
          keys: [key],
          message: suggestion
            ? `Unknown option "${key}". Did you mean "${suggestion}"?`
            : `Unknown configuration option "${key}"`,
          path: [key],
        });
      }
    }
  });

export type ConfigSchema = z.infer<typeof configSchema>;

/**
 * Custom error class for configuration validation
 * Bridges between Zod errors and our error format
 */
export class ConfigValidationError extends Error {
  public errors: Record<string, string>;

  constructor(zodErrorOrMap: z.ZodError | Record<string, string>) {
    let errors: Record<string, string>;
    let message: string;

    if (zodErrorOrMap instanceof z.ZodError) {
      errors = {};
      zodErrorOrMap.issues.forEach((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "config";
        errors[path] = issue.message;
      });
      message = `Config validation failed:\n${Object.entries(errors)
        .map(([key, msg]) => `  ${key}: ${msg}`)
        .join("\n")}`;
    } else {
      errors = zodErrorOrMap;
      message = `Config validation failed:\n${Object.entries(errors)
        .map(([key, msg]) => `  ${key}: ${msg}`)
        .join("\n")}`;
    }

    super(message);
    this.name = "ConfigValidationError";
    this.errors = errors;
  }
}

/**
 * Validates a configuration object using Zod schema
 * Supports string and numeric type coercion
 * Provides helpful error messages with typo suggestions
 */
export function validateConfig(config: unknown): ConfigSchema {
  try {
    const validated = configSchema.parse(config);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConfigValidationError(error);
    }
    throw error;
  }
}

/**
 * Find a similar key using Levenshtein distance
 * Helps users catch typos in configuration keys
 */
function findSimilarKey(input: string, candidates: string[]): string | null {
  const normalized = input.toLowerCase();
  let best: { key: string; distance: number } | null = null;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(normalized, candidate.toLowerCase());
    // Only suggest if distance is small (typo-like, not completely different)
    if (distance <= 3 && (!best || distance < best.distance)) {
      best = { key: candidate, distance };
    }
  }

  return best?.key ?? null;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching typos in configuration keys
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
