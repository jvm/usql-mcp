/**
 * Progress notification system for MCP
 * Provides progress updates for long-running operations
 */

import { createLogger } from "../utils/logger.js";

const logger = createLogger("usql-mcp:notifications:progress");

export type ProgressCallback = (progress: number, total: number) => void;

/**
 * Time-based progress estimator for operations without row count
 * Estimates progress based on elapsed time vs expected duration
 */
export class TimeBasedProgressEstimator {
  private startTime: number;
  private expectedDurationMs: number;
  private lastReportedProgress: number = 0;

  constructor(expectedDurationMs: number) {
    this.startTime = Date.now();
    this.expectedDurationMs = expectedDurationMs;
    logger.debug("[progress-estimator] Created estimator", { expectedDurationMs });
  }

  /**
   * Get current progress percentage (0-100)
   * Uses asymptotic curve to never quite reach 100% until completion
   */
  getCurrentProgress(): number {
    const elapsed = Date.now() - this.startTime;
    const ratio = elapsed / this.expectedDurationMs;

    // Asymptotic curve: approaches 99% but never reaches 100%
    // Formula: 99 * (1 - e^(-3*ratio))
    const progress = 99 * (1 - Math.exp(-3 * ratio));

    // Round to nearest integer
    const roundedProgress = Math.round(progress);

    // Only return increasing values (never go backwards)
    if (roundedProgress > this.lastReportedProgress) {
      this.lastReportedProgress = roundedProgress;
    }

    return this.lastReportedProgress;
  }

  /**
   * Get progress for a completed operation (always 100)
   */
  getCompletedProgress(): number {
    return 100;
  }

  /**
   * Reset the estimator
   */
  reset(): void {
    this.startTime = Date.now();
    this.lastReportedProgress = 0;
  }
}

/**
 * Progress reporter for background jobs
 * Sends periodic progress notifications via callback
 */
export class ProgressReporter {
  private estimator: TimeBasedProgressEstimator;
  private progressCallback?: ProgressCallback;
  private progressInterval?: NodeJS.Timeout;
  private updateIntervalMs: number;
  private isStopped: boolean = false;

  constructor(
    expectedDurationMs: number,
    progressCallback?: ProgressCallback,
    updateIntervalMs: number = 1000
  ) {
    this.estimator = new TimeBasedProgressEstimator(expectedDurationMs);
    this.progressCallback = progressCallback;
    this.updateIntervalMs = updateIntervalMs;

    logger.debug("[progress-reporter] Created reporter", {
      expectedDurationMs,
      updateIntervalMs,
      hasCallback: !!progressCallback,
    });
  }

  /**
   * Start sending periodic progress updates
   */
  start(): void {
    if (this.isStopped) {
      logger.warn("[progress-reporter] Cannot start stopped reporter");
      return;
    }

    if (this.progressInterval) {
      logger.warn("[progress-reporter] Progress reporting already started");
      return;
    }

    logger.debug("[progress-reporter] Starting progress updates");

    // Send initial progress
    this.sendProgress();

    // Send periodic updates
    this.progressInterval = setInterval(() => {
      if (!this.isStopped) {
        this.sendProgress();
      }
    }, this.updateIntervalMs);

    // Don't keep the process alive
    this.progressInterval.unref();
  }

  /**
   * Stop sending progress updates
   */
  stop(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = undefined;
    }
    this.isStopped = true;
    logger.debug("[progress-reporter] Stopped progress updates");
  }

  /**
   * Send completion progress (100%)
   */
  reportCompletion(): void {
    this.stop();
    if (this.progressCallback) {
      const progress = this.estimator.getCompletedProgress();
      logger.debug("[progress-reporter] Reporting completion", { progress });
      this.progressCallback(progress, 100);
    }
  }

  /**
   * Send current progress update
   */
  private sendProgress(): void {
    if (this.progressCallback && !this.isStopped) {
      const progress = this.estimator.getCurrentProgress();
      logger.debug("[progress-reporter] Sending progress", { progress });
      this.progressCallback(progress, 100);
    }
  }

  /**
   * Get current progress without sending notification
   */
  getCurrentProgress(): number {
    return this.estimator.getCurrentProgress();
  }
}

/**
 * Create a progress reporter for a job
 */
export function createProgressReporter(
  expectedDurationMs: number,
  progressCallback?: ProgressCallback,
  updateIntervalMs?: number
): ProgressReporter {
  return new ProgressReporter(expectedDurationMs, progressCallback, updateIntervalMs);
}
