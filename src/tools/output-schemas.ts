/**
 * Output schemas for all MCP tools
 * These schemas define the structure of tool responses for better LLM understanding
 */

export const executeQueryOutputSchema = {
  type: "object",
  properties: {
    format: {
      type: "string",
      enum: ["json", "csv"],
      description: "Format of the query results",
    },
    content: {
      type: "string",
      description: "Query results in the specified format",
    },
  },
  required: ["format", "content"],
};

export const backgroundJobOutputSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      const: "background",
      description: "Indicates the job is running in the background",
    },
    job_id: {
      type: "string",
      description: "Unique identifier for the background job",
    },
    message: {
      type: "string",
      description: "Human-readable message about the background job",
    },
    started_at: {
      type: "string",
      format: "date-time",
      description: "ISO 8601 timestamp when the job started",
    },
  },
  required: ["status", "job_id", "message", "started_at"],
};

export const listDatabasesOutputSchema = {
  type: "object",
  properties: {
    format: {
      type: "string",
      enum: ["json", "csv"],
      description: "Format of the database list",
    },
    content: {
      type: "string",
      description: "List of databases in the specified format",
    },
  },
  required: ["format", "content"],
};

export const listTablesOutputSchema = {
  type: "object",
  properties: {
    format: {
      type: "string",
      enum: ["json", "csv"],
      description: "Format of the table list",
    },
    content: {
      type: "string",
      description: "List of tables in the specified format",
    },
  },
  required: ["format", "content"],
};

export const describeTableOutputSchema = {
  type: "object",
  properties: {
    format: {
      type: "string",
      enum: ["json", "csv"],
      description: "Format of the table schema description",
    },
    content: {
      type: "string",
      description: "Table schema information including columns, types, and constraints",
    },
  },
  required: ["format", "content"],
};

export const executeScriptOutputSchema = {
  type: "object",
  properties: {
    format: {
      type: "string",
      enum: ["json", "csv"],
      description: "Format of the script results",
    },
    content: {
      type: "string",
      description: "Script execution results in the specified format",
    },
  },
  required: ["format", "content"],
};

export const getJobStatusOutputSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["running", "completed", "failed", "cancelled"],
      description: "Current status of the background job",
    },
    job_id: {
      type: "string",
      description: "Unique identifier for the job",
    },
    started_at: {
      type: "string",
      format: "date-time",
      description: "ISO 8601 timestamp when the job started",
    },
    elapsed_ms: {
      type: "number",
      description: "Milliseconds elapsed since job started",
    },
    progress: {
      type: "number",
      description: "Progress percentage (0-100) for running jobs",
      minimum: 0,
      maximum: 100,
    },
    result: {
      description: "Job result (only present if status is 'completed')",
    },
    error: {
      type: "object",
      description: "Error details (only present if status is 'failed')",
      properties: {
        error: {
          type: "string",
          description: "Error code",
        },
        message: {
          type: "string",
          description: "Error message",
        },
        details: {
          type: "object",
          description: "Additional error context",
        },
      },
    },
  },
  required: ["status", "job_id", "started_at", "elapsed_ms"],
};

export const getServerInfoOutputSchema = {
  type: "object",
  properties: {
    connections: {
      type: "object",
      description: "Available database connections",
      additionalProperties: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Connection name",
          },
          type: {
            type: "string",
            description: "Database type (postgres, mysql, oracle, etc.)",
          },
        },
      },
    },
    defaults: {
      type: "object",
      description: "Default configuration settings",
      properties: {
        defaultConnection: {
          type: "string",
          description: "Default connection name used when none specified",
        },
        queryTimeout: {
          type: "number",
          description: "Default query timeout in milliseconds",
        },
        backgroundThresholdMs: {
          type: "number",
          description: "Threshold for background execution in milliseconds",
        },
        jobResultTtlMs: {
          type: "number",
          description: "Time-to-live for job results in milliseconds",
        },
      },
    },
  },
  required: ["connections"],
};

export const cancelJobOutputSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["cancelled", "not_found", "not_running"],
      description: "Result of the cancellation attempt",
    },
    job_id: {
      type: "string",
      description: "Job identifier that was requested for cancellation",
    },
    message: {
      type: "string",
      description: "Human-readable message about the cancellation result",
    },
  },
  required: ["status", "job_id", "message"],
};
