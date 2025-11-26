/**
 * Tests for config validator
 */

import { validateConfig, ConfigValidationError } from "../../src/utils/config-validator.js";

describe("validateConfig", () => {
  describe("Valid configurations", () => {
    it("should accept an empty config", () => {
      const result = validateConfig({});
      expect(result).toEqual({});
    });

    it("should accept valid queryTimeoutMs as number", () => {
      const result = validateConfig({ queryTimeoutMs: 30000 });
      expect(result.queryTimeoutMs).toBe(30000);
    });

    it("should accept valid queryTimeoutMs as string", () => {
      const result = validateConfig({ queryTimeoutMs: "30000" });
      expect(result.queryTimeoutMs).toBe(30000);
    });

    it("should accept valid jobResultTtlMs", () => {
      const result = validateConfig({ jobResultTtlMs: 3600000 });
      expect(result.jobResultTtlMs).toBe(3600000);
    });

    it("should accept valid allowDestructiveOperations as boolean", () => {
      const result = validateConfig({ allowDestructiveOperations: true });
      expect(result.allowDestructiveOperations).toBe(true);
    });

    it("should accept allowDestructiveOperations as string", () => {
      const result = validateConfig({ allowDestructiveOperations: "true" });
      expect(result.allowDestructiveOperations).toBe(true);

      const result2 = validateConfig({ allowDestructiveOperations: "false" });
      expect(result2.allowDestructiveOperations).toBe(false);
    });

    it("should accept null values (optional fields)", () => {
      const result = validateConfig({
        queryTimeoutMs: null,
        jobResultTtlMs: null,
        allowDestructiveOperations: null,
      });
      expect(result).toEqual({});
    });

    it("should accept connection name keys", () => {
      const result = validateConfig({
        POSTGRES: "postgres://localhost",
        MYSQL: "mysql://localhost",
        ORACLE: "oracle://localhost",
      });
      expect(result.POSTGRES).toBe("postgres://localhost");
      expect(result.MYSQL).toBe("mysql://localhost");
      expect(result.ORACLE).toBe("oracle://localhost");
    });

    it("should accept mixed valid config", () => {
      const result = validateConfig({
        queryTimeoutMs: 60000,
        jobResultTtlMs: 7200000,
        allowDestructiveOperations: false,
        POSTGRES: "postgres://localhost",
        MYSQL: "mysql://user:pass@host",
      });
      expect(result.queryTimeoutMs).toBe(60000);
      expect(result.jobResultTtlMs).toBe(7200000);
      expect(result.allowDestructiveOperations).toBe(false);
      expect(result.POSTGRES).toBe("postgres://localhost");
    });
  });

  describe("Invalid configurations", () => {
    it("should reject non-object config", () => {
      expect(() => validateConfig(null)).toThrow(ConfigValidationError);
      expect(() => validateConfig("string")).toThrow(ConfigValidationError);
      expect(() => validateConfig(123)).toThrow(ConfigValidationError);
      expect(() => validateConfig([])).toThrow(ConfigValidationError);
    });

    it("should reject negative queryTimeoutMs", () => {
      expect(() => validateConfig({ queryTimeoutMs: -1000 })).toThrow(
        ConfigValidationError
      );
    });

    it("should reject zero queryTimeoutMs", () => {
      expect(() => validateConfig({ queryTimeoutMs: 0 })).toThrow(
        ConfigValidationError
      );
    });

    it("should reject non-numeric queryTimeoutMs", () => {
      expect(() => validateConfig({ queryTimeoutMs: "not a number" })).toThrow(
        ConfigValidationError
      );
      expect(() => validateConfig({ queryTimeoutMs: {} })).toThrow(
        ConfigValidationError
      );
    });

    it("should reject negative jobResultTtlMs", () => {
      expect(() => validateConfig({ jobResultTtlMs: -100 })).toThrow(
        ConfigValidationError
      );
    });

    it("should reject non-numeric jobResultTtlMs", () => {
      expect(() => validateConfig({ jobResultTtlMs: "abc" })).toThrow(
        ConfigValidationError
      );
    });

    it("should reject invalid allowDestructiveOperations string", () => {
      expect(() => validateConfig({ allowDestructiveOperations: "maybe" })).toThrow(
        ConfigValidationError
      );
      expect(() => validateConfig({ allowDestructiveOperations: 1 })).toThrow(
        ConfigValidationError
      );
    });

    it("should provide helpful typo suggestions", () => {
      try {
        validateConfig({ queryTimeOut: 5000 });
        fail("Should have thrown");
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          expect(error.errors.queryTimeOut).toContain("Did you mean");
          expect(error.errors.queryTimeOut).toContain("queryTimeoutMs");
        }
      }
    });

    it("should detect multiple errors at once", () => {
      try {
        validateConfig({
          queryTimeoutMs: "invalid",
          jobResultTtlMs: -5000,
          allowDestructivOperations: "yes", // typo
        });
        fail("Should have thrown");
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          expect(Object.keys(error.errors).length).toBeGreaterThanOrEqual(2);
        }
      }
    });
  });

  describe("Type coercion", () => {
    it("should coerce numeric strings to numbers", () => {
      const result = validateConfig({
        queryTimeoutMs: "45000",
        jobResultTtlMs: "7200000",
      });
      expect(typeof result.queryTimeoutMs).toBe("number");
      expect(typeof result.jobResultTtlMs).toBe("number");
      expect(result.queryTimeoutMs).toBe(45000);
      expect(result.jobResultTtlMs).toBe(7200000);
    });

    it("should coerce boolean strings to booleans", () => {
      const result1 = validateConfig({ allowDestructiveOperations: "true" });
      const result2 = validateConfig({ allowDestructiveOperations: "false" });
      const result3 = validateConfig({ allowDestructiveOperations: "True" });
      const result4 = validateConfig({ allowDestructiveOperations: "FALSE" });

      expect(result1.allowDestructiveOperations).toBe(true);
      expect(result2.allowDestructiveOperations).toBe(false);
      expect(result3.allowDestructiveOperations).toBe(true);
      expect(result4.allowDestructiveOperations).toBe(false);
    });
  });

  describe("Connection names", () => {
    it("should accept uppercase connection names", () => {
      const result = validateConfig({
        POSTGRES: "postgresql://localhost",
        MYSQL_PROD: "mysql://prod.example.com",
        ORACLE_BACKUP: "oracle://backup.example.com",
      });
      expect(result.POSTGRES).toBe("postgresql://localhost");
      expect(result.MYSQL_PROD).toBe("mysql://prod.example.com");
      expect(result.ORACLE_BACKUP).toBe("oracle://backup.example.com");
    });

    it("should not accept lowercase as connection names (ambiguous)", () => {
      try {
        validateConfig({
          postgres: "postgresql://localhost",
        });
        fail("Should have thrown");
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          expect(error.errors.postgres).toBeDefined();
        }
      }
    });
  });

  describe("Error messages", () => {
    it("should provide clear error messages", () => {
      try {
        validateConfig({ queryTimeoutMs: "abc" });
        fail("Should have thrown");
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          expect(error.message).toContain("Config validation failed");
          expect(error.message).toContain("queryTimeoutMs");
        }
      }
    });

    it("should have structured errors property", () => {
      try {
        validateConfig({
          queryTimeoutMs: -100,
          jobResultTtlMs: "invalid",
        });
        fail("Should have thrown");
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          expect(error.errors).toHaveProperty("queryTimeoutMs");
          expect(error.errors).toHaveProperty("jobResultTtlMs");
        }
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle very large timeout values", () => {
      const result = validateConfig({ queryTimeoutMs: 999999999 });
      expect(result.queryTimeoutMs).toBe(999999999);
    });

    it("should handle minimal valid config", () => {
      const result = validateConfig({ queryTimeoutMs: 1 });
      expect(result.queryTimeoutMs).toBe(1);
    });

    it("should handle config with many connection names", () => {
      const config: Record<string, unknown> = {};
      for (let i = 0; i < 10; i++) {
        config[`DB_${i}`] = `connection://${i}`;
      }
      const result = validateConfig(config);
      expect(Object.keys(result).length).toBe(10);
    });
  });
});
