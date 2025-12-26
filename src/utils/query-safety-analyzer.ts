/**
 * Query Safety Analyzer
 * Analyzes SQL queries for potentially dangerous operations and complexity
 */

import { createLogger } from "./logger.js";

const logger = createLogger("usql-mcp:utils:query-safety-analyzer");

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface SafetyAnalysis {
  riskLevel: RiskLevel;
  warnings: string[];
  dangerousOperations: string[];
  complexityScore: number;
  recommendations: string[];
  details: {
    hasDropStatement: boolean;
    hasTruncateStatement: boolean;
    hasDeleteWithoutWhere: boolean;
    hasUpdateWithoutWhere: boolean;
    hasTransactionControl: boolean;
    joinCount: number;
    subqueryCount: number;
    hasSelectStar: boolean;
    hasUnionAll: boolean;
    affectsMultipleTables: boolean;
  };
}

/**
 * Analyze a SQL query for safety and complexity
 */
export function analyzeQuerySafety(query: string): SafetyAnalysis {
  const normalizedQuery = normalizeQuery(query);

  const details = {
    hasDropStatement: detectDropStatement(normalizedQuery),
    hasTruncateStatement: detectTruncateStatement(normalizedQuery),
    hasDeleteWithoutWhere: detectDeleteWithoutWhere(normalizedQuery),
    hasUpdateWithoutWhere: detectUpdateWithoutWhere(normalizedQuery),
    hasTransactionControl: detectTransactionControl(normalizedQuery),
    joinCount: countJoins(normalizedQuery),
    subqueryCount: countSubqueries(normalizedQuery),
    hasSelectStar: detectSelectStar(normalizedQuery),
    hasUnionAll: detectUnionAll(normalizedQuery),
    affectsMultipleTables: detectMultipleTableOperations(normalizedQuery),
  };

  const warnings: string[] = [];
  const dangerousOperations: string[] = [];
  const recommendations: string[] = [];

  // Analyze dangerous operations
  if (details.hasDropStatement) {
    dangerousOperations.push("DROP statement detected");
    warnings.push("This query will permanently delete database objects (tables, indexes, etc.)");
    recommendations.push("Ensure you have a backup before executing DROP statements");
  }

  if (details.hasTruncateStatement) {
    dangerousOperations.push("TRUNCATE statement detected");
    warnings.push("This query will delete all rows from a table without logging individual row deletions");
    recommendations.push("Consider using DELETE with WHERE clause for safer, recoverable deletions");
  }

  if (details.hasDeleteWithoutWhere) {
    dangerousOperations.push("DELETE without WHERE clause");
    warnings.push("This query will delete ALL rows from the table");
    recommendations.push("Add a WHERE clause to delete specific rows, or use TRUNCATE if intentional");
  }

  if (details.hasUpdateWithoutWhere) {
    dangerousOperations.push("UPDATE without WHERE clause");
    warnings.push("This query will update ALL rows in the table");
    recommendations.push("Add a WHERE clause to update specific rows");
  }

  if (details.hasTransactionControl) {
    warnings.push("Transaction control statements (BEGIN, COMMIT, ROLLBACK) detected");
    recommendations.push("Ensure proper transaction handling to avoid leaving transactions open");
  }

  // Analyze complexity
  if (details.joinCount > 3) {
    warnings.push(`Query has ${details.joinCount} JOINs, which may be slow`);
    recommendations.push("Consider adding indexes on join columns or breaking into multiple queries");
  }

  if (details.subqueryCount > 2) {
    warnings.push(`Query has ${details.subqueryCount} subqueries, which may impact performance`);
    recommendations.push("Consider using JOINs or CTEs (WITH clauses) instead of nested subqueries");
  }

  if (details.hasSelectStar) {
    warnings.push("SELECT * detected - retrieving all columns may be inefficient");
    recommendations.push("Select only the columns you need for better performance");
  }

  if (details.affectsMultipleTables && (normalizedQuery.includes("DELETE") || normalizedQuery.includes("UPDATE"))) {
    warnings.push("Query affects multiple tables");
    recommendations.push("Test carefully in a development environment first");
  }

  // Calculate complexity score (0-100)
  let complexityScore = 0;
  complexityScore += details.joinCount * 10;
  complexityScore += details.subqueryCount * 15;
  if (details.hasSelectStar) complexityScore += 5;
  if (details.hasUnionAll) complexityScore += 10;
  if (details.affectsMultipleTables) complexityScore += 20;
  complexityScore = Math.min(complexityScore, 100);

  // Determine risk level
  const riskLevel = determineRiskLevel(details, complexityScore, dangerousOperations.length);

  const analysis: SafetyAnalysis = {
    riskLevel,
    warnings,
    dangerousOperations,
    complexityScore,
    recommendations,
    details,
  };

  logger.debug("[query-safety-analyzer] Analysis complete", {
    riskLevel,
    warningCount: warnings.length,
    dangerousOpsCount: dangerousOperations.length,
    complexityScore,
  });

  return analysis;
}

/**
 * Normalize query for analysis (uppercase, remove comments, trim whitespace)
 */
function normalizeQuery(query: string): string {
  // Remove single-line comments (-- ...)
  let normalized = query.replace(/--[^\n]*/g, "");

  // Remove multi-line comments (/* ... */)
  normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, "");

  // Convert to uppercase
  normalized = normalized.toUpperCase();

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Detect DROP statements (TABLE, DATABASE, INDEX, etc.)
 */
function detectDropStatement(query: string): boolean {
  return /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW|TRIGGER|PROCEDURE|FUNCTION)/i.test(query);
}

/**
 * Detect TRUNCATE statements
 */
function detectTruncateStatement(query: string): boolean {
  return /\bTRUNCATE\s+TABLE/i.test(query);
}

/**
 * Detect DELETE without WHERE clause
 */
function detectDeleteWithoutWhere(query: string): boolean {
  if (!/\bDELETE\s+FROM/i.test(query)) {
    return false;
  }

  // Check if there's a WHERE clause
  // Simple heuristic: look for WHERE keyword after DELETE
  const deleteMatch = query.match(/\bDELETE\s+FROM\s+[\w.]+(.*)$/i);
  if (!deleteMatch) {
    return false;
  }

  const afterDelete = deleteMatch[1];
  return !/\bWHERE\b/i.test(afterDelete);
}

/**
 * Detect UPDATE without WHERE clause
 */
function detectUpdateWithoutWhere(query: string): boolean {
  if (!/\bUPDATE\s+[\w.]+\s+SET/i.test(query)) {
    return false;
  }

  // Check if there's a WHERE clause
  const updateMatch = query.match(/\bUPDATE\s+[\w.]+\s+SET.*?(.*)$/i);
  if (!updateMatch) {
    return false;
  }

  const afterSet = updateMatch[1];
  return !/\bWHERE\b/i.test(afterSet);
}

/**
 * Detect transaction control statements
 */
function detectTransactionControl(query: string): boolean {
  return /\b(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION|SAVEPOINT)\b/i.test(query);
}

/**
 * Count number of JOIN operations
 */
function countJoins(query: string): number {
  const joinMatches = query.match(/\b(INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|JOIN)\b/gi);
  return joinMatches ? joinMatches.length : 0;
}

/**
 * Count number of subqueries
 */
function countSubqueries(query: string): number {
  // Count SELECT statements (excluding the main one)
  const selectMatches = query.match(/\bSELECT\b/gi);
  const selectCount = selectMatches ? selectMatches.length : 0;

  // Subtract 1 for the main SELECT (if it exists)
  return Math.max(0, selectCount - 1);
}

/**
 * Detect SELECT * usage
 */
function detectSelectStar(query: string): boolean {
  return /\bSELECT\s+\*/i.test(query);
}

/**
 * Detect UNION ALL usage
 */
function detectUnionAll(query: string): boolean {
  return /\bUNION\s+ALL\b/i.test(query);
}

/**
 * Detect operations affecting multiple tables
 */
function detectMultipleTableOperations(query: string): boolean {
  // Look for multiple table names in FROM, JOIN, or UPDATE clauses
  const tableMatches = query.match(/\b(FROM|JOIN|UPDATE)\s+[\w.]+/gi);
  if (!tableMatches) {
    return false;
  }

  // Extract unique table references (simplified)
  const tables = new Set<string>();
  for (const match of tableMatches) {
    const parts = match.split(/\s+/);
    if (parts.length > 1) {
      tables.add(parts[1]);
    }
  }

  return tables.size > 1;
}

/**
 * Determine overall risk level based on analysis
 */
function determineRiskLevel(
  details: SafetyAnalysis["details"],
  complexityScore: number,
  dangerousOpsCount: number
): RiskLevel {
  // Critical: Any destructive operation
  if (details.hasDropStatement || details.hasTruncateStatement) {
    return "critical";
  }

  // Critical: Bulk modification without WHERE
  if (details.hasDeleteWithoutWhere || details.hasUpdateWithoutWhere) {
    return "critical";
  }

  // High: Multiple dangerous operations or very complex
  if (dangerousOpsCount > 0 || complexityScore > 60) {
    return "high";
  }

  // Medium: Moderately complex or some warnings
  if (complexityScore > 30 || details.joinCount > 2 || details.subqueryCount > 1) {
    return "medium";
  }

  // Low: Simple, safe query
  return "low";
}

/**
 * Check if query should be blocked based on configuration
 */
export function shouldBlockQuery(analysis: SafetyAnalysis, config: SafetyConfig): boolean {
  if (config.blockHighRiskQueries && analysis.riskLevel === "high") {
    return true;
  }

  if (config.blockCriticalRiskQueries && analysis.riskLevel === "critical") {
    return true;
  }

  if (config.requireWhereClauseForDelete &&
      (analysis.details.hasDeleteWithoutWhere || analysis.details.hasUpdateWithoutWhere)) {
    return true;
  }

  if (!config.allowDestructiveOperations &&
      (analysis.details.hasDropStatement || analysis.details.hasTruncateStatement)) {
    return true;
  }

  return false;
}

export interface SafetyConfig {
  allowDestructiveOperations: boolean;
  blockHighRiskQueries: boolean;
  blockCriticalRiskQueries: boolean;
  requireWhereClauseForDelete: boolean;
}

/**
 * Get default safety configuration
 */
export function getDefaultSafetyConfig(): SafetyConfig {
  return {
    allowDestructiveOperations: true,  // Warn but allow
    blockHighRiskQueries: false,       // Don't block by default
    blockCriticalRiskQueries: false,   // Don't block by default
    requireWhereClauseForDelete: false, // Don't require by default
  };
}
