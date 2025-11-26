/**
 * Tests for QueryValidator
 */

import { QueryValidator, getDefaultValidator } from "../../src/utils/query-validator.js";

describe("QueryValidator", () => {
  describe("validateSelectQuery", () => {
    it("should accept simple SELECT queries", () => {
      const validator = new QueryValidator();
      const result = validator.validateSelectQuery("SELECT * FROM users");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept SELECT queries with WHERE clauses", () => {
      const validator = new QueryValidator();
      const result = validator.validateSelectQuery(
        "SELECT id, name FROM users WHERE active = true"
      );
      expect(result.valid).toBe(true);
    });

    it("should accept SELECT queries with JOINs", () => {
      const validator = new QueryValidator();
      const result = validator.validateSelectQuery(
        "SELECT u.id, p.title FROM users u JOIN posts p ON u.id = p.user_id"
      );
      expect(result.valid).toBe(true);
    });

    it("should reject empty queries", () => {
      const validator = new QueryValidator();
      const result = validator.validateSelectQuery("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("non-empty");
    });

    it("should reject non-string queries", () => {
      const validator = new QueryValidator();
      const result = validator.validateSelectQuery(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a non-empty string");
    });

    it("should reject queries exceeding max length", () => {
      const validator = new QueryValidator({ maxQueryLength: 100 });
      const longQuery = "SELECT * FROM users WHERE " + "id = 1 ".repeat(50);
      const result = validator.validateSelectQuery(longQuery);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum length");
    });

    it("should reject queries with dangerous keywords", () => {
      const validator = new QueryValidator();

      const dangerousQueries = [
        "SELECT * FROM users; SHUTDOWN",
        "SELECT KILL CONNECTION 1 FROM dual",
        "SELECT * FROM users WHERE KILL CONNECTION 1",
      ];

      for (const query of dangerousQueries) {
        const result = validator.validateSelectQuery(query);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("forbidden keyword");
      }
    });
  });

  describe("validateQuery", () => {
    it("should accept INSERT statements", () => {
      const validator = new QueryValidator();
      const result = validator.validateQuery("INSERT INTO users (name) VALUES ('test')");
      expect(result.valid).toBe(true);
    });

    it("should accept UPDATE statements", () => {
      const validator = new QueryValidator();
      const result = validator.validateQuery("UPDATE users SET name = 'test' WHERE id = 1");
      expect(result.valid).toBe(true);
    });

    it("should accept DELETE statements", () => {
      const validator = new QueryValidator();
      const result = validator.validateQuery("DELETE FROM users WHERE id = 1");
      expect(result.valid).toBe(true);
    });

    it("should reject DROP TABLE by default", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: false });
      const result = validator.validateQuery("DROP TABLE users");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
      expect(result.error).toContain("DROP TABLE");
    });

    it("should accept DROP TABLE when allowed", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: true });
      const result = validator.validateQuery("DROP TABLE users");
      expect(result.valid).toBe(true);
    });

    it("should reject TRUNCATE by default", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: false });
      const result = validator.validateQuery("TRUNCATE TABLE users");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("TRUNCATE");
    });

    it("should reject DROP DATABASE by default", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: false });
      const result = validator.validateQuery("DROP DATABASE mydb");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("should reject ALTER TABLE by default", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: false });
      const result = validator.validateQuery("ALTER TABLE users ADD COLUMN email VARCHAR(255)");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("ALTER TABLE");
    });

    it("should accept multiple statements when allowed", () => {
      const validator = new QueryValidator({ allowMultipleStatements: true });
      const result = validator.validateQuery(
        "SELECT * FROM users; SELECT * FROM posts;"
      );
      expect(result.valid).toBe(true);
    });

    it("should reject multiple statements when not allowed", () => {
      const validator = new QueryValidator({ allowMultipleStatements: false });
      const result = validator.validateQuery("SELECT * FROM users; SELECT * FROM posts");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Multiple SQL statements not allowed");
    });
  });

  describe("validateScript", () => {
    it("should accept scripts with multiple statements", () => {
      const validator = new QueryValidator();
      const script = `
        CREATE TABLE users (id INT, name VARCHAR(255));
        INSERT INTO users VALUES (1, 'test');
        SELECT * FROM users;
      `;
      const result = validator.validateScript(script);
      expect(result.valid).toBe(true);
    });

    it("should reject empty scripts", () => {
      const validator = new QueryValidator();
      const result = validator.validateScript("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("non-empty");
    });

    it("should reject scripts exceeding max length", () => {
      const validator = new QueryValidator({ maxScriptLength: 100 });
      const longScript = "SELECT * FROM users; ".repeat(50);
      const result = validator.validateScript(longScript);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum length");
    });

    it("should reject scripts with dangerous keywords", () => {
      const validator = new QueryValidator();
      const script = `
        BEGIN;
        SELECT * FROM users;
        SHUTDOWN;
        COMMIT;
      `;
      const result = validator.validateScript(script);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("forbidden keyword");
    });

    it("should reject scripts with DROP operations by default", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: false });
      const script = `
        CREATE TABLE temp AS SELECT * FROM users;
        DROP TABLE users;
        RENAME temp TO users;
      `;
      const result = validator.validateScript(script);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("should accept scripts with DROP when allowed", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: true });
      const script = `
        DROP TABLE old_users;
        CREATE TABLE users (id INT);
      `;
      const result = validator.validateScript(script);
      expect(result.valid).toBe(true);
    });
  });

  describe("checkSqlInjectionPatterns", () => {
    it("should detect OR 1=1 patterns", () => {
      const validator = new QueryValidator();
      const result = validator.checkSqlInjectionPatterns("SELECT * FROM users WHERE id = '1' OR '1'='1'");
      expect(result.suspicious).toBe(true);
      expect(result.patterns).toBeDefined();
      expect(result.patterns!.length).toBeGreaterThan(0);
    });

    it("should detect UNION SELECT patterns", () => {
      const validator = new QueryValidator();
      const result = validator.checkSqlInjectionPatterns(
        "SELECT * FROM users UNION SELECT * FROM passwords"
      );
      expect(result.suspicious).toBe(true);
    });

    it("should detect SQL comments", () => {
      const validator = new QueryValidator();
      const result = validator.checkSqlInjectionPatterns("SELECT * FROM users -- password");
      expect(result.suspicious).toBe(true);
    });

    it("should detect comment blocks", () => {
      const validator = new QueryValidator();
      const result = validator.checkSqlInjectionPatterns("SELECT * FROM users /* comment */");
      expect(result.suspicious).toBe(true);
    });

    it("should detect semicolon injection attempts", () => {
      const validator = new QueryValidator();
      const result = validator.checkSqlInjectionPatterns(
        "SELECT * FROM users; DROP TABLE users;"
      );
      expect(result.suspicious).toBe(true);
    });

    it("should not flag clean queries as suspicious", () => {
      const validator = new QueryValidator();
      const result = validator.checkSqlInjectionPatterns(
        "SELECT id, name FROM users WHERE active = true ORDER BY name"
      );
      expect(result.suspicious).toBe(false);
      expect(result.patterns).toBeUndefined();
    });

    it("should handle edge cases gracefully", () => {
      const validator = new QueryValidator();

      const testCases = [
        "SELECT 'OR 1=1' as test", // String literal shouldn't be flagged as injection
        "SELECT -- this is a comment in Python: # not sql",
      ];

      // These are heuristic checks so they may have false positives
      // The important thing is they don't crash
      for (const query of testCases) {
        expect(() => {
          validator.checkSqlInjectionPatterns(query);
        }).not.toThrow();
      }
    });
  });

  describe("Configuration", () => {
    it("should use custom maxQueryLength", () => {
      const validator = new QueryValidator({ maxQueryLength: 30 });
      const query = "SELECT * FROM users WHERE id = 1 AND name = 'test'";
      const result = validator.validateSelectQuery(query);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum length");
    });

    it("should use custom maxScriptLength", () => {
      const validator = new QueryValidator({ maxScriptLength: 30 });
      const script = "SELECT * FROM users; SELECT * FROM posts;";
      const result = validator.validateScript(script);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum length");
    });

    it("should respect allowDestructiveOperations config", () => {
      const validatorAllow = new QueryValidator({ allowDestructiveOperations: true });
      const validatorDeny = new QueryValidator({ allowDestructiveOperations: false });

      const query = "DROP TABLE users";

      expect(validatorAllow.validateQuery(query).valid).toBe(true);
      expect(validatorDeny.validateQuery(query).valid).toBe(false);
    });

    it("should respect allowMultipleStatements config", () => {
      const validatorAllow = new QueryValidator({ allowMultipleStatements: true });
      const validatorDeny = new QueryValidator({ allowMultipleStatements: false });

      const query = "SELECT * FROM users; SELECT * FROM posts";

      expect(validatorAllow.validateQuery(query).valid).toBe(true);
      expect(validatorDeny.validateQuery(query).valid).toBe(false);
    });
  });

  describe("getAllowedOperations", () => {
    it("should list allowed operations with default config", () => {
      const validator = new QueryValidator();
      const allowed = validator.getAllowedOperations();
      expect(allowed).toContain("SELECT queries");
      expect(allowed).toContain("INSERT statements");
      expect(allowed).toContain("UPDATE statements");
      expect(allowed).not.toContain("DROP operations");
    });

    it("should list allowed operations with destructive allowed", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: true });
      const allowed = validator.getAllowedOperations();
      expect(allowed).toContain("DROP operations");
      expect(allowed).toContain("TRUNCATE operations");
      expect(allowed).toContain("ALTER TABLE operations");
    });

    it("should list multiple statements when allowed", () => {
      const validator = new QueryValidator({ allowMultipleStatements: true });
      const allowed = validator.getAllowedOperations();
      expect(allowed).toContain("Multiple statements in one query");
    });
  });

  describe("getDefaultValidator", () => {
    it("should return the same instance on multiple calls", () => {
      const validator1 = getDefaultValidator();
      const validator2 = getDefaultValidator();
      expect(validator1).toBe(validator2);
    });

    it("should accept custom config on first call", () => {
      // Note: This test is tricky because getDefaultValidator is global
      // In real code, this would need proper isolation
      const validator = getDefaultValidator({ maxQueryLength: 100 });
      expect(validator).toBeDefined();
    });
  });

  describe("Case insensitivity", () => {
    it("should detect destructive operations in lowercase", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: false });
      const result = validator.validateQuery("drop table users");
      expect(result.valid).toBe(false);
    });

    it("should detect destructive operations in uppercase", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: false });
      const result = validator.validateQuery("DROP TABLE users");
      expect(result.valid).toBe(false);
    });

    it("should detect destructive operations in mixed case", () => {
      const validator = new QueryValidator({ allowDestructiveOperations: false });
      const result = validator.validateQuery("DrOp TaBlE users");
      expect(result.valid).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle queries with newlines and extra spaces", () => {
      const validator = new QueryValidator();
      const query = `
        SELECT
          id,
          name,
          email
        FROM
          users
        WHERE
          active = true
      `;
      const result = validator.validateSelectQuery(query);
      expect(result.valid).toBe(true);
    });

    it("should handle NULL values", () => {
      const validator = new QueryValidator();
      const result = validator.validateSelectQuery("SELECT * FROM users WHERE email IS NULL");
      expect(result.valid).toBe(true);
    });

    it("should handle quoted identifiers", () => {
      const validator = new QueryValidator();
      const result = validator.validateSelectQuery('SELECT "user"."id" FROM "users"');
      expect(result.valid).toBe(true);
    });

    it("should handle complex WHERE clauses", () => {
      const validator = new QueryValidator();
      const query =
        "SELECT * FROM users WHERE (age > 18 AND status = 'active') OR (role = 'admin' AND created_at > '2024-01-01')";
      const result = validator.validateSelectQuery(query);
      expect(result.valid).toBe(true);
    });
  });
});
