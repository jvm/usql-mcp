/**
 * Wrapper for tools to support background execution
 * If a tool takes longer than the configured threshold, it returns a job ID
 * and continues execution in the background
 */

import { createHash } from "crypto";
import { createLogger } from "../utils/logger.js";
import { getJobManager } from "../usql/job-manager.js";
import { getBackgroundThresholdMs } from "../usql/config.js";
import { BackgroundJobResponse } from "../types/index.js";
import { formatMcpError, sanitizeConnectionString } from "../utils/error-handler.js";
import { createProgressReporter } from "../notifications/progress-notifier.js";

const logger = createLogger("usql-mcp:background-wrapper");

/**
 * Wraps a tool handler to support background execution
 * Returns immediately after threshold with job ID, continues execution in background
 */
export function withBackgroundSupport<T, R>(
  toolName: string,
  handler: (input: T, signal?: AbortSignal) => Promise<R>
): (input: T) => Promise<R | BackgroundJobResponse> {
  return async (input: T): Promise<R | BackgroundJobResponse> => {
    const threshold = getBackgroundThresholdMs();
    const jobManager = getJobManager();
    const abortController = new AbortController();

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
      // Sanitize connection string first to remove credentials, then hash
      const sanitized = sanitizeConnectionString(connStr);
      connectionHash = createHash("sha256").update(sanitized).digest("hex");
    }

    // Create a promise that resolves after the threshold
    let thresholdHandle: NodeJS.Timeout | null = null;
    const thresholdPromise = new Promise<void>((resolve) => {
      thresholdHandle = setTimeout(resolve, threshold);
    });

    // Race between handler and threshold
    const handlerPromise = handler(input, abortController.signal);
    const raceResult = await Promise.race([
      handlerPromise.then((res) => {
        if (thresholdHandle) {
          clearTimeout(thresholdHandle);
        }
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

    // Tool is still running after threshold, create job and return job ID
    const jobId = jobManager.createJob(toolName, connectionHash);
    const startedAt = new Date().toISOString();

    // Create an AbortController for this job (for future cancellation support)
    jobManager.setJobCanceller(jobId, abortController);

    // Create progress reporter for this job
    // Estimate remaining time as 2x the threshold (conservative estimate)
    const estimatedDurationMs = threshold * 2;
    const progressReporter = createProgressReporter(estimatedDurationMs, (progress) => {
      jobManager.updateProgress(jobId, progress);
    });

    // Start progress reporting
    progressReporter.start();

    logger.debug("[background-wrapper] Tool exceeded threshold, returning job ID", {
      toolName,
      jobId,
      threshold,
      estimatedDurationMs,
    });

    // Continue execution in background (promise already started, continues to completion)
    handlerPromise
      .then((res) => {
        progressReporter.reportCompletion();
        jobManager.completeJob(jobId, res);
        logger.debug("[background-wrapper] Background job completed", {
          jobId,
          toolName,
        });
      })
      .catch((err) => {
        progressReporter.stop();
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
/* global AbortController */
