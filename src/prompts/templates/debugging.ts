/**
 * Query debugging and optimization prompts
 */

import { PromptMessage } from "@modelcontextprotocol/sdk/types.js";
import { PromptTemplate, registerPrompt } from "../prompt-registry.js";

export const optimizeQueryPrompt: PromptTemplate = {
  name: "optimize_query",
  description:
    "Optimize a SQL query for better performance. Analyzes the query structure and suggests improvements.",
  arguments: [
    {
      name: "connection",
      description: "Database connection string",
      required: true,
    },
    {
      name: "query",
      description: "SQL query to optimize",
      required: true,
    },
  ],
  getMessages: (args: Record<string, string>): PromptMessage[] => {
    const { connection, query } = args;

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `I need help optimizing this SQL query on connection '${connection}':

\`\`\`sql
${query}
\`\`\`

Please:
1. Analyze the current query structure
2. Check the execution plan (EXPLAIN)
3. Identify performance issues:
   - Missing indexes
   - Inefficient JOINs
   - Suboptimal WHERE clauses
   - SELECT * usage
   - N+1 query patterns
4. Provide an optimized version of the query
5. Explain the improvements and expected performance gains
6. Suggest any schema changes (indexes, etc.) that would help`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I'll analyze this query and provide optimization recommendations. Let me start by examining the query execution plan and the schema of the tables involved.

First, let me check the database type and run EXPLAIN on this query.`,
        },
      },
    ];
  },
};

export const debugSlowQueryPrompt: PromptTemplate = {
  name: "debug_slow_query",
  description:
    "Debug a slow-running query. Provides a systematic approach to identifying and resolving performance issues.",
  arguments: [
    {
      name: "connection",
      description: "Database connection string",
      required: true,
    },
    {
      name: "query",
      description: "The slow query to debug",
      required: true,
    },
    {
      name: "expected_duration",
      description: "Expected query duration (e.g., '100ms', '2s') - optional",
      required: false,
    },
  ],
  getMessages: (args: Record<string, string>): PromptMessage[] => {
    const { connection, query, expected_duration } = args;

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `I have a slow-running query that needs debugging on connection '${connection}':

\`\`\`sql
${query}
\`\`\`
${expected_duration ? `\nExpected duration: ${expected_duration}\n` : ""}
Please help me debug this by:
1. Running EXPLAIN ANALYZE to see actual execution time and plan
2. Identifying the slowest operations in the query plan
3. Checking table statistics and index usage
4. Looking for common slow query patterns:
   - Full table scans on large tables
   - Missing or unused indexes
   - Inefficient joins
   - Expensive aggregations
   - Lock contention
5. Provide step-by-step recommendations to fix the performance issue
6. If possible, test the optimized query and compare results`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I'll help you systematically debug this slow query. Let me start by analyzing the execution plan and gathering relevant database statistics to pinpoint the performance bottleneck.

First, let me check the database type and run a detailed EXPLAIN ANALYZE.`,
        },
      },
    ];
  },
};

// Register prompts
registerPrompt(optimizeQueryPrompt);
registerPrompt(debugSlowQueryPrompt);
