/**
 * cancel_job tool - Cancel a running background job
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createLogger } from "../utils/logger.js";
import { createUsqlError, formatMcpError } from "../utils/error-handler.js";
import { getJobManager } from "../usql/job-manager.js";

const logger = createLogger("usql-mcp:tools:cancel-job");

interface CancelJobInput {
  job_id: string;
  reason?: string;
}

interface CancelJobResponse {
  status: "cancelled" | "not_found" | "not_running";
  job_id: string;
  message: string;
}

export const cancelJobSchema: Tool = {
  name: "cancel_job",
  description:
    "Cancel a running background job and stop its underlying query execution. The query will be terminated gracefully.",
  inputSchema: {
    type: "object",
    properties: {
      job_id: {
        type: "string",
        description: "Job ID of the background job to cancel",
      },
      reason: {
        type: "string",
        description: "(Optional) Reason for cancellation (for logging purposes)",
      },
    },
    required: ["job_id"],
  },
};

export async function handleCancelJob(input: CancelJobInput): Promise<CancelJobResponse> {
  logger.debug("[cancel-job] Handling request", {
    jobId: input.job_id,
    reason: input.reason,
  });

  try {
    if (!input.job_id || typeof input.job_id !== "string") {
      throw createUsqlError("InvalidInput", "job_id is required and must be a string");
    }

    const jobManager = getJobManager();

    // Attempt to cancel the job
    const cancelResult = jobManager.cancelJob(input.job_id);

    if (!cancelResult.success) {
      logger.warn("[cancel-job] Failed to cancel job", {
        jobId: input.job_id,
        reason: cancelResult.message,
      });

      // Determine the appropriate status to return
      const job = jobManager.getJob(input.job_id);
      if (!job) {
        return {
          status: "not_found",
          job_id: input.job_id,
          message: cancelResult.message,
        };
      }

      return {
        status: "not_running",
        job_id: input.job_id,
        message: cancelResult.message,
      };
    }

    logger.info("[cancel-job] Job cancelled successfully", {
      jobId: input.job_id,
      reason: input.reason,
    });

    return {
      status: "cancelled",
      job_id: input.job_id,
      message: cancelResult.message,
    };
  } catch (error) {
    const mcpError = formatMcpError(error, input.job_id ? { jobId: input.job_id } : undefined);

    logger.error("[cancel-job] Error cancelling job", error);
    throw mcpError;
  }
}
