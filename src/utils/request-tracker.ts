/**
 * Request tracking and cancellation system for MCP protocol
 * Tracks in-flight requests and supports cancellation via $/cancelRequest
 */

import { createLogger } from "./logger.js";

const logger = createLogger("usql-mcp:request-tracker");

export interface TrackedRequest {
  id: string | number;
  abortController: AbortController;
  startTime: number;
}

class RequestTracker {
  private requests: Map<string | number, TrackedRequest> = new Map();

  /**
   * Start tracking a request
   * Returns an AbortSignal that can be passed to async operations
   */
  track(requestId: string | number): AbortSignal {
    const abortController = new AbortController();

    const request: TrackedRequest = {
      id: requestId,
      abortController,
      startTime: Date.now(),
    };

    this.requests.set(requestId, request);

    logger.debug("[request-tracker] Started tracking request", {
      requestId,
      activeRequests: this.requests.size,
    });

    return abortController.signal;
  }

  /**
   * Stop tracking a request (call when request completes)
   */
  untrack(requestId: string | number): void {
    const deleted = this.requests.delete(requestId);

    if (deleted) {
      logger.debug("[request-tracker] Stopped tracking request", {
        requestId,
        activeRequests: this.requests.size,
      });
    }
  }

  /**
   * Cancel a tracked request
   */
  cancel(requestId: string | number): boolean {
    const request = this.requests.get(requestId);

    if (!request) {
      logger.warn("[request-tracker] Cannot cancel, request not found", {
        requestId,
      });
      return false;
    }

    logger.info("[request-tracker] Cancelling request", {
      requestId,
      elapsedMs: Date.now() - request.startTime,
    });

    request.abortController.abort();
    this.requests.delete(requestId);

    return true;
  }

  /**
   * Get number of active requests
   */
  getActiveCount(): number {
    return this.requests.size;
  }

  /**
   * Cancel all tracked requests
   */
  cancelAll(): void {
    const count = this.requests.size;

    if (count > 0) {
      logger.info("[request-tracker] Cancelling all requests", { count });

      for (const request of this.requests.values()) {
        request.abortController.abort();
      }

      this.requests.clear();
    }
  }
}

// Singleton instance
const tracker = new RequestTracker();

export function trackRequest(requestId: string | number): AbortSignal {
  return tracker.track(requestId);
}

export function untrackRequest(requestId: string | number): void {
  tracker.untrack(requestId);
}

export function cancelRequest(requestId: string | number): boolean {
  return tracker.cancel(requestId);
}

export function getActiveRequestCount(): number {
  return tracker.getActiveCount();
}

export function cancelAllRequests(): void {
  tracker.cancelAll();
}
