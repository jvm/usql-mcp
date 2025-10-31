/**
 * Wrapper for tools to support background execution
 * If a tool takes longer than the configured threshold, it returns a job ID
 * and continues execution in the background
 */

import { createLogger } from "../utils/logger.js";
import { getJobManager } from "../usql/job-manager.js";
import { getBackgroundThresholdMs } from "../usql/config.js";
import { BackgroundJobResponse } from "../types/index.js";
import { formatMcpError } from "../utils/error-handler.js";

const logger = createLogger("usql-mcp:background-wrapper");

/**
 * Wraps a tool handler to support background execution
 * Returns immediately after threshold with job ID, continues execution in background
 */
export function withBackgroundSupport<T, R>(
  toolName: string,
  handler: (input: T) => Promise<R>
): (input: T) => Promise<R | BackgroundJobResponse> {
  return async (input: T): Promise<R | BackgroundJobResponse> => {
    const threshold = getBackgroundThresholdMs();
    const jobManager = getJobManager();

    let result: R | undefined;

    // Hash connection string for job tracking (don't store full string)
    let connectionHash: string | undefined;
    if (
      typeof input === "object" &&
      input !== null &&
      "connection_string" in input &&
      typeof (input as Record<string, unknown>).connection_string === "string"
    ) {
      const connStr = (input as Record<string, unknown>).connection_string as string;
      connectionHash = Buffer.from(connStr).toString("base64").substring(0, 16);
    }

    // Create a promise that resolves after the threshold
    const thresholdPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, threshold);
    });

    // Race between handler and threshold
    const handlerPromise = handler(input);
    const raceResult = await Promise.race([
      handlerPromise.then((res) => {
        result = res;
        return { completed: true };
      }),
      thresholdPromise.then(() => {
        return { completed: false };
      }),
    ]);

    // If completed before threshold, return result immediately
    if (raceResult.completed) {
      logger.debug("[background-wrapper] Tool completed before threshold", {
        toolName,
        threshold,
      });
      return result as R;
    }

    // Tool is still running after threshold, return job ID
    const jobId = jobManager.createJob(toolName, connectionHash);
    const startedAt = new Date().toISOString();

    // Create an AbortController for this job (for future cancellation support)
    const abortController = new AbortController();
    jobManager.setJobCanceller(jobId, abortController);

    logger.debug("[background-wrapper] Tool exceeded threshold, returning job ID", {
      toolName,
      jobId,
      threshold,
    });

    // Continue execution in background
    handlerPromise
      .then((res) => {
        jobManager.completeJob(jobId, res);
        logger.debug("[background-wrapper] Background job completed", {
          jobId,
          toolName,
        });
      })
      .catch((err) => {
        const mcpError = formatMcpError(err);
        jobManager.failJob(jobId, mcpError);
        logger.error("[background-wrapper] Background job failed", {
          jobId,
          toolName,
          error: err,
        });
      });

    // Return background response
    return {
      status: "background",
      job_id: jobId,
      message: `Query is taking longer than ${threshold}ms. It will continue running in the background. Use get_job_status with job_id to check progress.`,
      started_at: startedAt,
    };
  };
}
