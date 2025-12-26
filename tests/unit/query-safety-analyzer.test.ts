/**
 * Tests for query safety analyzer
 */

import {
  analyzeQuerySafety,
  shouldBlockQuery,
  getDefaultSafetyConfig,
  type SafetyConfig,
} from "../../src/utils/query-safety-analyzer";

describe("analyzeQuerySafety", () => {
  describe("dangerous operations detection", () => {
    it("should detect DROP TABLE statements", () => {
      const analysis = analyzeQuerySafety("DROP TABLE users");

      expect(analysis.riskLevel).toBe("critical");
      expect(analysis.dangerousOperations).toContain("DROP statement detected");
      expect(analysis.details.hasDropStatement).toBe(true);
    });

    it("should detect DROP DATABASE statements", () => {
      const analysis = analyzeQuerySafety("DROP DATABASE test_db");

      expect(analysis.riskLevel).toBe("critical");
      expect(analysis.dangerousOperations).toContain("DROP statement detected");
      expect(analysis.details.hasDropStatement).toBe(true);
    });

    it("should detect TRUNCATE statements", () => {
      const analysis = analyzeQuerySafety("TRUNCATE TABLE users");

      expect(analysis.riskLevel).toBe("critical");
      expect(analysis.dangerousOperations).toContain("TRUNCATE statement detected");
      expect(analysis.details.hasTruncateStatement).toBe(true);
    });

    it("should detect DELETE without WHERE clause", () => {
      const analysis = analyzeQuerySafety("DELETE FROM users");

      expect(analysis.riskLevel).toBe("critical");
      expect(analysis.dangerousOperations).toContain("DELETE without WHERE clause");
      expect(analysis.details.hasDeleteWithoutWhere).toBe(true);
    });

    it("should NOT flag DELETE with WHERE clause", () => {
      const analysis = analyzeQuerySafety("DELETE FROM users WHERE id = 1");

      expect(analysis.details.hasDeleteWithoutWhere).toBe(false);
    });

    it("should detect UPDATE without WHERE clause", () => {
      const analysis = analyzeQuerySafety("UPDATE users SET active = true");

      expect(analysis.riskLevel).toBe("critical");
      expect(analysis.dangerousOperations).toContain("UPDATE without WHERE clause");
      expect(analysis.details.hasUpdateWithoutWhere).toBe(true);
    });

    it("should NOT flag UPDATE with WHERE clause", () => {
      const analysis = analyzeQuerySafety("UPDATE users SET active = true WHERE id = 1");

      expect(analysis.details.hasUpdateWithoutWhere).toBe(false);
    });

    it("should detect transaction control statements", () => {
      const analysis = analyzeQuerySafety("BEGIN TRANSACTION; UPDATE users SET active = true WHERE id = 1; COMMIT;");

      expect(analysis.details.hasTransactionControl).toBe(true);
      expect(analysis.warnings.some(w => w.includes("Transaction control statements"))).toBe(true);
    });
  });

  describe("complexity analysis", () => {
    it("should count JOIN operations", () => {
      const analysis = analyzeQuerySafety(
        "SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id"
      );

      expect(analysis.details.joinCount).toBe(1);
    });

    it("should count multiple JOINs", () => {
      const analysis = analyzeQuerySafety(
        "SELECT * FROM users " +
          "JOIN orders ON users.id = orders.user_id " +
          "LEFT JOIN products ON orders.product_id = products.id " +
          "RIGHT JOIN categories ON products.category_id = categories.id"
      );

      expect(analysis.details.joinCount).toBe(3);
    });

    it("should warn about many JOINs", () => {
      const analysis = analyzeQuerySafety(
        "SELECT * FROM users " +
          "JOIN orders ON users.id = orders.user_id " +
          "JOIN products ON orders.product_id = products.id " +
          "JOIN categories ON products.category_id = categories.id " +
          "JOIN suppliers ON products.supplier_id = suppliers.id"
      );

      expect(analysis.details.joinCount).toBe(4);
      expect(analysis.warnings.some(w => w.includes("4 JOINs"))).toBe(true);
    });

    it("should count subqueries", () => {
      const analysis = analyzeQuerySafety(
        "SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)"
      );

      expect(analysis.details.subqueryCount).toBe(1);
    });

    it("should count multiple subqueries", () => {
      const analysis = analyzeQuerySafety(
        "SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE product_id IN (SELECT id FROM products))"
      );

      expect(analysis.details.subqueryCount).toBe(2);
    });

    it("should detect SELECT *", () => {
      const analysis = analyzeQuerySafety("SELECT * FROM users");

      expect(analysis.details.hasSelectStar).toBe(true);
      expect(analysis.warnings.some(w => w.includes("SELECT * detected"))).toBe(true);
    });

    it("should detect UNION ALL", () => {
      const analysis = analyzeQuerySafety(
        "SELECT id FROM users UNION ALL SELECT id FROM deleted_users"
      );

      expect(analysis.details.hasUnionAll).toBe(true);
    });

    it("should calculate complexity score based on query features", () => {
      // Complex query with many features
      const complexAnalysis = analyzeQuerySafety(
        "SELECT * FROM users " +
          "JOIN orders ON users.id = orders.user_id " +
          "JOIN products ON orders.product_id = products.id " +
          "WHERE id IN (SELECT user_id FROM premium_users)"
      );

      expect(complexAnalysis.complexityScore).toBeGreaterThan(30);

      // Simple query
      const simpleAnalysis = analyzeQuerySafety("SELECT id, name FROM users WHERE id = 1");

      expect(simpleAnalysis.complexityScore).toBeLessThan(10);
    });
  });

  describe("risk level determination", () => {
    it("should assign critical risk to DROP statements", () => {
      const analysis = analyzeQuerySafety("DROP TABLE users");
      expect(analysis.riskLevel).toBe("critical");
    });

    it("should assign critical risk to DELETE without WHERE", () => {
      const analysis = analyzeQuerySafety("DELETE FROM users");
      expect(analysis.riskLevel).toBe("critical");
    });

    it("should assign high risk to very complex queries", () => {
      const analysis = analyzeQuerySafety(
        "SELECT * FROM users " +
          "JOIN orders ON users.id = orders.user_id " +
          "JOIN products ON orders.product_id = products.id " +
          "JOIN categories ON products.category_id = categories.id " +
          "JOIN suppliers ON products.supplier_id = suppliers.id " +
          "WHERE id IN (SELECT user_id FROM premium_users WHERE status IN (SELECT id FROM statuses))"
      );

      expect(analysis.riskLevel).toBe("high");
    });

    it("should assign medium risk to moderately complex queries", () => {
      const analysis = analyzeQuerySafety(
        "SELECT * FROM users JOIN orders ON users.id = orders.user_id JOIN products ON orders.product_id = products.id"
      );

      expect(analysis.riskLevel).toBe("medium");
    });

    it("should assign low risk to simple queries", () => {
      const analysis = analyzeQuerySafety("SELECT id, name, email FROM users WHERE id = 1");

      expect(analysis.riskLevel).toBe("low");
    });
  });

  describe("warnings and recommendations", () => {
    it("should provide warnings for dangerous operations", () => {
      const analysis = analyzeQuerySafety("DROP TABLE users");

      expect(analysis.warnings.length).toBeGreaterThan(0);
      expect(analysis.warnings.some(w => w.includes("permanently delete database objects"))).toBe(true);
    });

    it("should provide recommendations for improvements", () => {
      const analysis = analyzeQuerySafety("SELECT * FROM users");

      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations.some(r => r.includes("Select only the columns you need"))).toBe(true);
    });

    it("should provide specific recommendations for complex queries", () => {
      const analysis = analyzeQuerySafety(
        "SELECT * FROM users " +
          "JOIN orders ON users.id = orders.user_id " +
          "JOIN products ON orders.product_id = products.id " +
          "JOIN categories ON products.category_id = categories.id " +
          "JOIN suppliers ON products.supplier_id = suppliers.id " +
          "WHERE id IN (SELECT user_id FROM premium_users WHERE status IN (SELECT id FROM statuses))"
      );

      // Should have multiple recommendations for this complex query
      expect(analysis.recommendations.length).toBeGreaterThan(1);
      // Should recommend something about joins or performance
      expect(analysis.recommendations.some(r =>
        r.includes("join") || r.includes("subquer") || r.includes("column")
      )).toBe(true);
    });
  });

  describe("query normalization", () => {
    it("should handle queries with comments", () => {
      const analysis = analyzeQuerySafety(
        "-- This is a comment\nDROP TABLE users; -- Another comment"
      );

      expect(analysis.details.hasDropStatement).toBe(true);
    });

    it("should handle queries with multi-line comments", () => {
      const analysis = analyzeQuerySafety(
        "/* This is a\n   multi-line comment */\nDROP TABLE users"
      );

      expect(analysis.details.hasDropStatement).toBe(true);
    });

    it("should be case-insensitive", () => {
      const upperAnalysis = analyzeQuerySafety("DROP TABLE users");
      const lowerAnalysis = analyzeQuerySafety("drop table users");
      const mixedAnalysis = analyzeQuerySafety("DrOp TaBlE users");

      expect(upperAnalysis.details.hasDropStatement).toBe(true);
      expect(lowerAnalysis.details.hasDropStatement).toBe(true);
      expect(mixedAnalysis.details.hasDropStatement).toBe(true);
    });
  });
});

describe("shouldBlockQuery", () => {
  const defaultConfig = getDefaultSafetyConfig();

  it("should NOT block by default with default config", () => {
    const analysis = analyzeQuerySafety("DROP TABLE users");
    expect(shouldBlockQuery(analysis, defaultConfig)).toBe(false);
  });

  it("should block critical queries when blockCriticalRiskQueries is true", () => {
    const config: SafetyConfig = {
      ...defaultConfig,
      blockCriticalRiskQueries: true,
    };
    const analysis = analyzeQuerySafety("DROP TABLE users");

    expect(shouldBlockQuery(analysis, config)).toBe(true);
  });

  it("should block high risk queries when blockHighRiskQueries is true", () => {
    const config: SafetyConfig = {
      ...defaultConfig,
      blockHighRiskQueries: true,
    };
    const analysis = analyzeQuerySafety(
      "SELECT * FROM users " +
        "JOIN orders ON users.id = orders.user_id " +
        "JOIN products ON orders.product_id = products.id " +
        "JOIN categories ON products.category_id = categories.id " +
        "JOIN suppliers ON products.supplier_id = suppliers.id"
    );

    expect(shouldBlockQuery(analysis, config)).toBe(true);
  });

  it("should block DELETE without WHERE when requireWhereClauseForDelete is true", () => {
    const config: SafetyConfig = {
      ...defaultConfig,
      requireWhereClauseForDelete: true,
    };
    const analysis = analyzeQuerySafety("DELETE FROM users");

    expect(shouldBlockQuery(analysis, config)).toBe(true);
  });

  it("should NOT block DELETE with WHERE when requireWhereClauseForDelete is true", () => {
    const config: SafetyConfig = {
      ...defaultConfig,
      requireWhereClauseForDelete: true,
    };
    const analysis = analyzeQuerySafety("DELETE FROM users WHERE id = 1");

    expect(shouldBlockQuery(analysis, config)).toBe(false);
  });

  it("should block destructive operations when allowDestructiveOperations is false", () => {
    const config: SafetyConfig = {
      ...defaultConfig,
      allowDestructiveOperations: false,
    };
    const dropAnalysis = analyzeQuerySafety("DROP TABLE users");
    const truncateAnalysis = analyzeQuerySafety("TRUNCATE TABLE users");

    expect(shouldBlockQuery(dropAnalysis, config)).toBe(true);
    expect(shouldBlockQuery(truncateAnalysis, config)).toBe(true);
  });

  it("should NOT block safe queries regardless of config", () => {
    const strictConfig: SafetyConfig = {
      allowDestructiveOperations: false,
      blockHighRiskQueries: true,
      blockCriticalRiskQueries: true,
      requireWhereClauseForDelete: true,
    };
    const analysis = analyzeQuerySafety("SELECT id, name FROM users WHERE id = 1");

    expect(shouldBlockQuery(analysis, strictConfig)).toBe(false);
  });
});

describe("getDefaultSafetyConfig", () => {
  it("should return permissive defaults", () => {
    const config = getDefaultSafetyConfig();

    expect(config.allowDestructiveOperations).toBe(true);
    expect(config.blockHighRiskQueries).toBe(false);
    expect(config.blockCriticalRiskQueries).toBe(false);
    expect(config.requireWhereClauseForDelete).toBe(false);
  });
});
