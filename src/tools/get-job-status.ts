/**
 * get_job_status tool - Get the status of a background job
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createLogger } from "../utils/logger.js";
import { createUsqlError, formatMcpError } from "../utils/error-handler.js";
import { getJobManager } from "../usql/job-manager.js";
import { JobStatusResponse } from "../types/index.js";

const logger = createLogger("usql-mcp:tools:get-job-status");

interface GetJobStatusInput {
  job_id: string;
  wait_seconds: number;
}

export const getJobStatusSchema: Tool = {
  name: "get_job_status",
  description: "Check the status of a background job and retrieve results when available. This tool will wait for the specified duration before checking, preventing inefficient tight polling loops.",
  inputSchema: {
    type: "object",
    properties: {
      job_id: {
        type: "string",
        description:
          'Job ID returned from a tool that exceeded the background execution threshold (e.g., "uuid-string")',
      },
      wait_seconds: {
        type: "number",
        description:
          "Seconds to wait before checking job status. This prevents inefficient tight polling and gives the query time to complete. IMPORTANT: Use a value less than your MCP client timeout. For example, if the client timeout is 60s, use 5-30 seconds. Recommended: 5-10 seconds for quick checks, or 15-30 seconds for longer-running queries.",
        minimum: 1,
        maximum: 55,
      },
    },
    required: ["job_id", "wait_seconds"],
  },
};

export async function handleGetJobStatus(input: GetJobStatusInput): Promise<JobStatusResponse> {
  logger.debug("[get-job-status] Handling request", {
    jobId: input.job_id,
    waitSeconds: input.wait_seconds,
  });

  try {
    if (!input.job_id || typeof input.job_id !== "string") {
      throw createUsqlError("InvalidInput", "job_id is required and must be a string");
    }

    // Validate wait_seconds
    const waitSeconds = input.wait_seconds;
    if (typeof waitSeconds !== "number" || !Number.isFinite(waitSeconds)) {
      throw createUsqlError("InvalidInput", "wait_seconds must be a number");
    }
    if (waitSeconds < 1 || waitSeconds > 55) {
      throw createUsqlError(
        "InvalidInput",
        "wait_seconds must be between 1 and 55 seconds. Use a value less than your MCP client timeout."
      );
    }

    // Wait before checking job status
    logger.debug("[get-job-status] Waiting before checking status", {
      jobId: input.job_id,
      waitSeconds,
    });

    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));

    const jobManager = getJobManager();
    const jobState = jobManager.getJob(input.job_id);

    if (!jobState) {
      logger.warn("[get-job-status] Job not found", { jobId: input.job_id });
      throw createUsqlError(
        "JobNotFound",
        `Job not found: ${input.job_id}. The job may have completed and been cleaned up (default cleanup: 1 hour).`,
        { jobId: input.job_id }
      );
    }

    const now = new Date();
    const elapsedMs = now.getTime() - jobState.startedAt.getTime();

    logger.debug("[get-job-status] Job found", {
      jobId: input.job_id,
      status: jobState.status,
      elapsedMs,
    });

    const response: JobStatusResponse = {
      status: jobState.status,
      job_id: input.job_id,
      started_at: jobState.startedAt.toISOString(),
      elapsed_ms: elapsedMs,
    };

    // Include result/error if job is complete or failed
    if (jobState.status === "completed" && jobState.result) {
      response.result = jobState.result;
    } else if (jobState.status === "failed" && jobState.error) {
      response.error = jobState.error;
    }

    return response;
  } catch (error) {
    const mcpError = formatMcpError(
      error,
      input.job_id ? { jobId: input.job_id } : undefined
    );

    logger.error("[get-job-status] Error getting job status", error);
    throw mcpError;
  }
}
