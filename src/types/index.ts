/**
 * Shared TypeScript interfaces for usql-mcp
 */

export interface RawOutput {
  format: "json" | "csv";
  content: string;
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
}

export interface UsqlConfig {
  connections: Record<string, ConnectionConfig>;
  defaults?: {
    queryTimeout?: number;
    maxResultRows?: number;
    defaultConnection?: string;
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
