/**
 * Query validation utilities to prevent SQL injection and resource exhaustion
 */

import { createLogger } from "./logger.js";

const logger = createLogger("usql-mcp:query-validator");

/**
 * Configuration for query validation
 */
export interface QueryValidationConfig {
  maxQueryLength?: number; // Maximum query length in characters
  maxScriptLength?: number; // Maximum script length in characters
  allowDestructiveOperations?: boolean; // Allow DROP, TRUNCATE, DELETE, ALTER
  allowMultipleStatements?: boolean; // Allow multiple SQL statements separated by semicolons
}

const DEFAULT_CONFIG: Required<QueryValidationConfig> = {
  maxQueryLength: 1000000, // 1MB
  maxScriptLength: 10000000, // 10MB
  allowDestructiveOperations: false,
  allowMultipleStatements: true,
};

/**
 * Destructive SQL keywords that require explicit approval
 * Note: DELETE FROM is allowed by default (it's data modification, not schema destruction)
 */
const DESTRUCTIVE_KEYWORDS = [
  "DROP DATABASE",
  "DROP TABLE",
  "DROP SCHEMA",
  "TRUNCATE",
  "ALTER TABLE",
  "GRANT",
  "REVOKE",
];

/**
 * Dangerous keywords that should be completely blocked
 */
const DANGEROUS_KEYWORDS = ["SHUTDOWN", "KILL", "KILL CONNECTION", "DISABLE KEYS", "ENABLE KEYS"];

/**
 * Query validator for preventing SQL injection and resource exhaustion
 */
export class QueryValidator {
  private config: Required<QueryValidationConfig>;

  constructor(config: QueryValidationConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    logger.debug("[query-validator] Initialized with config", this.config);
  }

  /**
   * Validate a SELECT query (read-only)
   */
  validateSelectQuery(query: string): { valid: boolean; error?: string } {
    if (!query || typeof query !== "string") {
      return { valid: false, error: "Query must be a non-empty string" };
    }

    // Check length
    if (query.length > this.config.maxQueryLength) {
      return {
        valid: false,
        error: `Query exceeds maximum length of ${this.config.maxQueryLength} characters`,
      };
    }

    const upperQuery = query.toUpperCase().trim();

    // Check for dangerous keywords
    for (const keyword of DANGEROUS_KEYWORDS) {
      if (upperQuery.includes(keyword)) {
        return { valid: false, error: `Query contains forbidden keyword: ${keyword}` };
      }
    }

    return { valid: true };
  }

  /**
   * Validate a general SQL query (may include INSERT, UPDATE, DELETE, etc.)
   */
  validateQuery(query: string): { valid: boolean; error?: string } {
    const selectCheck = this.validateSelectQuery(query);
    if (!selectCheck.valid) {
      return selectCheck;
    }

    const upperQuery = query.toUpperCase().trim();

    // Check for destructive operations
    const destructiveOp = DESTRUCTIVE_KEYWORDS.find((keyword) => upperQuery.includes(keyword));

    if (destructiveOp && !this.config.allowDestructiveOperations) {
      return {
        valid: false,
        error:
          `Destructive operation not allowed: ${destructiveOp}. ` +
          "To allow destructive operations, set allow_destructive=true.",
      };
    }

    // Check for multiple statements if not allowed
    if (!this.config.allowMultipleStatements) {
      const statementCount = this.countStatements(query);
      if (statementCount > 1) {
        return {
          valid: false,
          error: `Multiple SQL statements not allowed. Found ${statementCount} statements.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate a script (multiple statements allowed)
   */
  validateScript(script: string): { valid: boolean; error?: string } {
    if (!script || typeof script !== "string") {
      return { valid: false, error: "Script must be a non-empty string" };
    }

    if (script.length > this.config.maxScriptLength) {
      return {
        valid: false,
        error: `Script exceeds maximum length of ${this.config.maxScriptLength} characters`,
      };
    }

    const upperScript = script.toUpperCase();

    // Check for dangerous keywords
    for (const keyword of DANGEROUS_KEYWORDS) {
      if (upperScript.includes(keyword)) {
        return { valid: false, error: `Script contains forbidden keyword: ${keyword}` };
      }
    }

    // Check for destructive operations
    const destructiveOp = DESTRUCTIVE_KEYWORDS.find((keyword) => upperScript.includes(keyword));

    if (destructiveOp && !this.config.allowDestructiveOperations) {
      return {
        valid: false,
        error:
          `Destructive operation not allowed: ${destructiveOp}. ` +
          "To allow destructive operations, set allow_destructive=true.",
      };
    }

    return { valid: true };
  }

  /**
   * Check if a query appears to have any SQL injection patterns
   * Note: This is a basic heuristic check, not foolproof
   */
  checkSqlInjectionPatterns(query: string): { suspicious: boolean; patterns?: string[] } {
    const patterns: string[] = [];

    // Check for common SQL injection patterns
    const suspiciousPatterns = [
      /('.*'.*OR.*'.*'.*=.*')/i, // OR 1=1 variants
      /(;\s*DROP)/i, // ; DROP
      /(--\s*|#\s*|\*\/)/i, // SQL comments
      /(\bUNION\b.*\bSELECT\b)/i, // UNION SELECT
      /(\/\*.*\*\/)/i, // /* */ comments
      /(xp_|sp_|xp-|sp-)/i, // Stored procedures (SQL Server)
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(query)) {
        patterns.push(pattern.source);
      }
    }

    return {
      suspicious: patterns.length > 0,
      patterns: patterns.length > 0 ? patterns : undefined,
    };
  }

  /**
   * Count the number of SQL statements in a query
   * Simple heuristic: count semicolons (can have false positives)
   */
  private countStatements(query: string): number {
    // Remove strings to avoid counting semicolons in string literals
    const cleaned = query
      .replace(/'([^'\\]|\\.)*'/g, "''") // Single quoted strings
      .replace(/"([^"\\]|\\.)*"/g, '""'); // Double quoted strings

    // Count non-empty statements
    const statements = cleaned.split(";").filter((stmt) => stmt.trim().length > 0);
    return statements.length;
  }

  /**
   * Get a human-readable summary of what operations are allowed
   */
  getAllowedOperations(): string[] {
    const allowed: string[] = ["SELECT queries", "INSERT statements", "UPDATE statements"];

    if (this.config.allowDestructiveOperations) {
      allowed.push("DROP operations", "TRUNCATE operations", "ALTER TABLE operations");
    }

    if (this.config.allowMultipleStatements) {
      allowed.push("Multiple statements in one query");
    }

    return allowed;
  }
}

/**
 * Create a global instance with default config
 */
let defaultValidator: QueryValidator | null = null;

export function getDefaultValidator(config?: QueryValidationConfig): QueryValidator {
  if (!defaultValidator) {
    defaultValidator = new QueryValidator(config);
  }
  return defaultValidator;
}
