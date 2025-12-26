/**
 * Performance analysis prompts
 */

import { PromptMessage } from "@modelcontextprotocol/sdk/types.js";
import { PromptTemplate, registerPrompt } from "../prompt-registry.js";

export const analyzePerformancePrompt: PromptTemplate = {
  name: "analyze_performance",
  description:
    "Analyze query performance and suggest optimizations. Provides a structured workflow for identifying slow queries and improving their execution plans.",
  arguments: [
    {
      name: "connection",
      description: "Database connection string to analyze",
      required: true,
    },
    {
      name: "query",
      description: "SQL query to analyze (optional - will analyze general database performance if omitted)",
      required: false,
    },
  ],
  getMessages: (args: Record<string, string>): PromptMessage[] => {
    const { connection, query } = args;

    if (query) {
      // Query-specific analysis
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `I need help analyzing the performance of this SQL query on connection '${connection}':\n\n\`\`\`sql\n${query}\n\`\`\`\n\nPlease help me:
1. Execute an EXPLAIN or EXPLAIN ANALYZE to see the query plan
2. Identify potential performance bottlenecks (missing indexes, full table scans, etc.)
3. Suggest specific optimizations (indexes, query rewriting, schema changes)
4. Estimate the impact of suggested optimizations`,
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: `I'll help you analyze this query's performance. Let me start by examining the execution plan and database schema to identify optimization opportunities.

First, I'll check what database type we're working with and get the query execution plan.`,
          },
        },
      ];
    } else {
      // General database performance analysis
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `I need help analyzing the overall performance of my database on connection '${connection}'.

Please help me:
1. Identify slow-running queries (if query logs are available)
2. Check for missing indexes on frequently queried tables
3. Identify tables with excessive rows that might need partitioning
4. Review database statistics and cache hit ratios
5. Suggest performance improvements`,
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: `I'll help you analyze your database performance. Let me start by examining the database schema, statistics, and identifying potential performance issues.

First, let me check what database type we're working with and gather basic performance metrics.`,
          },
        },
      ];
    }
  },
};

export const profileDataQualityPrompt: PromptTemplate = {
  name: "profile_data_quality",
  description:
    "Profile data quality for a table or dataset. Analyzes null rates, duplicates, value distributions, and data anomalies.",
  arguments: [
    {
      name: "connection",
      description: "Database connection string",
      required: true,
    },
    {
      name: "table",
      description: "Table name to profile",
      required: true,
    },
    {
      name: "database",
      description: "Database name (optional, if applicable)",
      required: false,
    },
  ],
  getMessages: (args: Record<string, string>): PromptMessage[] => {
    const { connection, table, database } = args;
    const tableRef = database ? `${database}.${table}` : table;

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `I need a data quality profile for table '${tableRef}' on connection '${connection}'.

Please analyze:
1. Row count and table size
2. Null rates for each column
3. Duplicate row detection
4. Cardinality (unique value counts) for each column
5. Data type validation (unexpected formats, out-of-range values)
6. Distribution analysis for numeric/date columns
7. Common data quality issues and recommendations`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I'll create a comprehensive data quality profile for table '${tableRef}'. Let me start by examining the table schema and then run profiling queries to assess data quality across all dimensions.

First, let me get the table structure and basic statistics.`,
        },
      },
    ];
  },
};

// Register prompts
registerPrompt(analyzePerformancePrompt);
registerPrompt(profileDataQualityPrompt);
