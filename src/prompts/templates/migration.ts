/**
 * Schema migration prompts
 */

import { PromptMessage } from "@modelcontextprotocol/sdk/types.js";
import { PromptTemplate, registerPrompt } from "../prompt-registry.js";

export const generateMigrationPrompt: PromptTemplate = {
  name: "generate_migration",
  description:
    "Generate a database migration script for schema changes. Provides templates for common migrations like adding columns, creating indexes, or modifying constraints.",
  arguments: [
    {
      name: "connection",
      description: "Database connection string",
      required: true,
    },
    {
      name: "description",
      description: "Description of the migration (e.g., 'add email column to users table')",
      required: true,
    },
    {
      name: "table",
      description: "Target table name (optional)",
      required: false,
    },
  ],
  getMessages: (args: Record<string, string>): PromptMessage[] => {
    const { connection, description, table } = args;

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `I need to generate a database migration for: "${description}"
${table ? `\nTarget table: ${table}` : ""}
Connection: ${connection}

Please help me:
1. First, examine the current schema ${table ? `for table '${table}'` : ""}
2. Generate both UP (migration) and DOWN (rollback) SQL scripts
3. Include appropriate safety checks (IF NOT EXISTS, etc.)
4. Consider database-specific syntax for the target database type
5. Add comments explaining each step
6. Suggest any related indexes or constraints that should be updated`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I'll help you generate a safe migration script for this change. Let me start by examining the current schema to understand the database structure and ensure the migration is compatible with your database type.

First, let me check the database type and ${table ? `the structure of table '${table}'` : "relevant tables"}.`,
        },
      },
    ];
  },
};

export const explainSchemaPrompt: PromptTemplate = {
  name: "explain_schema",
  description:
    "Generate comprehensive documentation for database schema. Creates markdown documentation with table descriptions, column definitions, and relationships.",
  arguments: [
    {
      name: "connection",
      description: "Database connection string",
      required: true,
    },
    {
      name: "table",
      description: "Specific table to document (optional - documents entire schema if omitted)",
      required: false,
    },
    {
      name: "database",
      description: "Database name (optional)",
      required: false,
    },
  ],
  getMessages: (args: Record<string, string>): PromptMessage[] => {
    const { connection, table, database } = args;
    const scope = table
      ? `table '${database ? database + "." : ""}${table}'`
      : database
        ? `database '${database}'`
        : "the entire schema";

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `I need comprehensive documentation for ${scope} on connection '${connection}'.

Please create documentation that includes:
1. Overview and purpose
2. Table list with descriptions
3. For each table:
   - Column names, types, and constraints
   - Primary keys and foreign keys
   - Indexes
   - Estimated row counts
4. Relationship diagram (ER diagram in text/markdown)
5. Common query patterns
6. Notes on data sensitivity or important business logic

Format the output as clean markdown suitable for a README or wiki.`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I'll create comprehensive schema documentation for ${scope}. Let me start by examining the database structure, tables, columns, and relationships.

First, let me gather the schema information from the database.`,
        },
      },
    ];
  },
};

// Register prompts
registerPrompt(generateMigrationPrompt);
registerPrompt(explainSchemaPrompt);
