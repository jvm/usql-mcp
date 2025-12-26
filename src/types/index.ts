/**
 * Shared TypeScript interfaces for usql-mcp
 */

export interface RawOutput {
  format: "json" | "csv";
  content: string;
  safety_analysis?: {
    risk_level: "low" | "medium" | "high" | "critical";
    warnings: string[];
    dangerous_operations: string[];
    complexity_score: number;
    recommendations: string[];
  };
}

export interface ExecuteQueryInput {
  connection_string?: string;
  query: string;
  parameters?: unknown[];
  output_format?: "json" | "csv";
  timeout_ms?: number | null;
}

export interface ListDatabasesInput {
  connection_string?: string;
  output_format?: "json" | "csv";
  timeout_ms?: number | null;
}

export interface ListTablesInput {
  connection_string?: string;
  database?: string;
  output_format?: "json" | "csv";
  timeout_ms?: number | null;
}

export interface DescribeTableInput {
  connection_string?: string;
  table: string;
  database?: string;
  output_format?: "json" | "csv";
  timeout_ms?: number | null;
}

export interface ExecuteScriptInput {
  connection_string?: string;
  script: string;
  output_format?: "json" | "csv";
  timeout_ms?: number | null;
}

export interface UsqlExecutorOptions {
  timeout?: number;
  format?: "json" | "table" | "csv";
  signal?: AbortSignal;
}

export interface UsqlConfig {
  connections: Record<string, ConnectionConfig>;
  defaults?: {
    queryTimeout?: number;
    maxResultRows?: number;
    defaultConnection?: string;
    backgroundThresholdMs?: number;
    jobResultTtlMs?: number;
    allowDestructiveOperations?: boolean;
    blockHighRiskQueries?: boolean;
    blockCriticalRiskQueries?: boolean;
    requireWhereClauseForDelete?: boolean;
    maxResultBytes?: number;
    rateLimitRpm?: number;
    maxConcurrentRequests?: number;
    schemaCacheTtl?: number;
  };
}

export interface ConnectionConfig {
  uri: string;
  description?: string;
}

export interface McpError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface JobStatusResponse {
  status: "running" | "completed" | "failed" | "cancelled";
  job_id: string;
  started_at: string;
  elapsed_ms: number;
  progress?: number; // Progress percentage (0-100) for running jobs
  result?: unknown;
  error?: McpError;
}

export interface BackgroundJobResponse {
  status: "background";
  job_id: string;
  message: string;
  started_at: string;
}
