/**
 * In-memory job manager for tracking background query executions
 */

import { randomBytes } from "crypto";
import { createLogger } from "../utils/logger.js";
import { McpError } from "../types/index.js";

const logger = createLogger("usql-mcp:job-manager");

export interface JobState {
  id: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: Date;
  startedAtMs: number;
  completedAt?: Date;
  result?: unknown;
  error?: McpError;
  toolName: string;
  connectionStringHash?: string; // Hashed for security, not full string
  progress?: number; // Progress percentage (0-100)
  progressToken?: string; // MCP progress token for notifications
}

class JobManager {
  private jobs = new Map<string, JobState>();
  private resultTTL: number; // milliseconds
  private cleanupInterval: NodeJS.Timeout;
  private jobCancellers = new Map<string, AbortController>(); // Track cancellation controllers
  // Track waiters that should be notified when a job leaves "running" state
  private waiters = new Map<string, Array<(job: JobState) => void>>();

  constructor(resultTTL: number = 3600000) {
    this.resultTTL = resultTTL;
    logger.debug("[job-manager] Initializing with TTL", { resultTTL });

    // Start cleanup interval - run every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );

    // Don't keep the process alive due to this interval
    this.cleanupInterval.unref();
  }

  /**
   * Create a new job and return its ID
   */
  createJob(toolName: string, connectionStringHash?: string, startedAtMs?: number): string {
    const jobId = generateJobId();
    const startMs = startedAtMs ?? Date.now();
    const jobState: JobState = {
      id: jobId,
      status: "running",
      startedAt: new Date(startMs),
      startedAtMs: startMs,
      toolName,
      connectionStringHash,
    };

    this.jobs.set(jobId, jobState);
    logger.debug("[job-manager] Created job", {
      jobId,
      toolName,
    });

    return jobId;
  }

  /**
   * Update job progress percentage (0-100)
   */
  updateProgress(jobId: string, progress: number): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn("[job-manager] Attempted to update progress for non-existent job", { jobId });
      return;
    }

    if (job.status !== "running") {
      logger.debug("[job-manager] Skipping progress update for non-running job", {
        jobId,
        status: job.status,
      });
      return;
    }

    job.progress = Math.min(100, Math.max(0, progress));
    logger.debug("[job-manager] Updated job progress", { jobId, progress: job.progress });
  }

  /**
   * Set the MCP progress token for a job
   */
  setProgressToken(jobId: string, progressToken: string | undefined): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn("[job-manager] Attempted to set progress token for non-existent job", { jobId });
      return;
    }

    job.progressToken = progressToken;
    logger.debug("[job-manager] Set progress token for job", { jobId, hasToken: !!progressToken });
  }

  /**
   * Mark job as completed with result
   */
  completeJob(jobId: string, result: unknown): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn("[job-manager] Attempted to complete non-existent job", { jobId });
      return;
    }

    job.status = "completed";
    job.completedAt = new Date();
    job.result = result;

    logger.debug("[job-manager] Job completed", {
      jobId,
      elapsedMs: job.completedAt.getTime() - job.startedAtMs,
    });

    this.notifyWaiters(jobId, job);
  }

  /**
   * Mark job as failed with error
   */
  failJob(jobId: string, error: McpError): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn("[job-manager] Attempted to fail non-existent job", { jobId });
      return;
    }

    job.status = "failed";
    job.completedAt = new Date();
    job.error = error;

    logger.debug("[job-manager] Job failed", {
      jobId,
      elapsedMs: job.completedAt.getTime() - job.startedAtMs,
      errorType: error.error,
    });

    this.notifyWaiters(jobId, job);
  }

  /**
   * Store an AbortController for a job (for cancellation)
   */
  setJobCanceller(jobId: string, controller: AbortController): void {
    this.jobCancellers.set(jobId, controller);
    logger.debug("[job-manager] Registered job canceller", { jobId });
  }

  /**
   * Cancel a running job by aborting its controller
   */
  cancelJob(jobId: string): { success: boolean; message: string } {
    const job = this.jobs.get(jobId);

    if (!job) {
      return { success: false, message: `Job not found: ${jobId}` };
    }

    if (job.status !== "running") {
      return { success: false, message: `Job is not running (status: ${job.status})` };
    }

    // Try to abort the controller if it exists
    const controller = this.jobCancellers.get(jobId);
    if (controller) {
      controller.abort();
      logger.debug("[job-manager] Aborted job controller", { jobId });
    }

    // Mark job as cancelled
    job.status = "cancelled";
    job.completedAt = new Date();
    job.error = {
      error: "JobCancelled",
      message: "Job was cancelled by user",
    };

    logger.debug("[job-manager] Job cancelled", {
      jobId,
      elapsedMs: job.completedAt.getTime() - job.startedAtMs,
    });

    this.notifyWaiters(jobId, job);

    return { success: true, message: `Job ${jobId} cancelled successfully` };
  }

  /**
   * Get job state
   */
  getJob(jobId: string): JobState | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }
    return { ...job }; // Return copy
  }

  /**
   * Get all jobs (for debugging/monitoring)
   */
  getAllJobs(): JobState[] {
    return Array.from(this.jobs.values()).map((job) => ({ ...job }));
  }

  /**
   * Delete a specific job (for cleanup)
   */
  deleteJob(jobId: string): boolean {
    this.waiters.delete(jobId);
    return this.jobs.delete(jobId);
  }

  /**
   * Clean up expired jobs
   */
  private cleanup(): void {
    const now = Date.now();
    let deletedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      // Only delete completed/failed/cancelled jobs that have expired
      if (job.status !== "running" && job.completedAt) {
        const age = now - job.completedAt.getTime();
        if (age > this.resultTTL) {
          this.jobs.delete(jobId);
          this.jobCancellers.delete(jobId); // Also clean up the canceller
          this.waiters.delete(jobId);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.debug("[job-manager] Cleaned up expired jobs", {
        deletedCount,
        remainingJobs: this.jobs.size,
      });
    }
  }

  /**
   * Force cleanup of all jobs (used on shutdown)
   */
  forceCleanup(): void {
    clearInterval(this.cleanupInterval);
    const count = this.jobs.size;
    this.jobs.clear();
    this.jobCancellers.clear();
    this.waiters.clear();
    logger.debug("[job-manager] Force cleanup completed", { deletedCount: count });
  }

  /**
   * Get running jobs (for shutdown handling)
   */
  getRunningJobs(): JobState[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === "running")
      .map((job) => ({ ...job }));
  }

  /**
   * Wait for a job to complete/fail/cancel or until timeoutMs elapses.
   * Resolves with the latest JobState or null if timeout.
   */
  async waitForCompletion(jobId: string, timeoutMs: number): Promise<JobState | null> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    // If already not running, return immediately
    if (job.status !== "running") {
      return { ...job };
    }

    // Set up a promise that resolves when the job is notified or times out
    return await new Promise<JobState | null>((resolve) => {
      const timeout = setTimeout(() => {
        // On timeout just resolve with current state (still running) if present
        const current = this.jobs.get(jobId);
        this.waiters.delete(jobId);
        resolve(current ? { ...current } : null);
      }, timeoutMs);

      const waiter = (updatedJob: JobState): void => {
        clearTimeout(timeout);
        resolve({ ...updatedJob });
      };

      const existing = this.waiters.get(jobId) ?? [];
      existing.push(waiter);
      this.waiters.set(jobId, existing);
    });
  }

  /**
   * Notify and clear waiters for a job
   */
  private notifyWaiters(jobId: string, job: JobState): void {
    const waiters = this.waiters.get(jobId);
    if (waiters && waiters.length > 0) {
      waiters.forEach((fn) => fn({ ...job }));
      this.waiters.delete(jobId);
    }
  }
}

function generateJobId(): string {
  return randomBytes(8).toString("base64url");
}

// Singleton instance
let manager: JobManager | null = null;

export function initializeJobManager(resultTTL?: number): JobManager {
  if (manager) {
    return manager;
  }
  manager = new JobManager(resultTTL);
  return manager;
}

export function getJobManager(): JobManager {
  if (!manager) {
    manager = new JobManager();
  }
  return manager;
}

export function shutdownJobManager(): void {
  if (manager) {
    manager.forceCleanup();
    manager = null;
  }
}
/* global AbortController */
