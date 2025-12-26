/**
 * Rate limiting for MCP requests
 * Prevents abuse and manages resource usage
 */

import { createLogger } from "./logger.js";
import { createUsqlError } from "./error-handler.js";

const logger = createLogger("usql-mcp:rate-limiter");

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private requestsPerMinute: number) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    // Don't block process exit
    this.cleanupInterval.unref();

    logger.debug("[rate-limiter] Initialized", { requestsPerMinute });
  }

  /**
   * Check if a request should be allowed
   * Throws error if rate limit exceeded
   */
  checkLimit(identifier: string = "global"): void {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry) {
      // First request from this identifier
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + 60000, // Reset in 1 minute
      });
      return;
    }

    // Check if we need to reset the counter
    if (now >= entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + 60000;
      return;
    }

    // Check if limit exceeded
    if (entry.count >= this.requestsPerMinute) {
      const remainingMs = entry.resetTime - now;
      const remainingSec = Math.ceil(remainingMs / 1000);

      logger.warn("[rate-limiter] Rate limit exceeded", {
        identifier,
        count: entry.count,
        limit: this.requestsPerMinute,
        remainingSec,
      });

      throw createUsqlError(
        "RateLimitExceeded",
        `Rate limit exceeded: ${this.requestsPerMinute} requests per minute. Try again in ${remainingSec} seconds.`,
        {
          identifier,
          limit: this.requestsPerMinute,
          current: entry.count,
          resetInSeconds: remainingSec,
        }
      );
    }

    // Increment counter
    entry.count++;
  }

  /**
   * Get current request count for an identifier
   */
  getCount(identifier: string = "global"): number {
    const entry = this.requests.get(identifier);
    if (!entry) {
      return 0;
    }

    const now = Date.now();
    if (now >= entry.resetTime) {
      return 0;
    }

    return entry.count;
  }

  /**
   * Get remaining requests for an identifier
   */
  getRemaining(identifier: string = "global"): number {
    const count = this.getCount(identifier);
    return Math.max(0, this.requestsPerMinute - count);
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string = "global"): void {
    this.requests.delete(identifier);
    logger.debug("[rate-limiter] Reset limit", { identifier });
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.requests.clear();
    logger.debug("[rate-limiter] Reset all limits");
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [identifier, entry] of this.requests.entries()) {
      if (now >= entry.resetTime) {
        this.requests.delete(identifier);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("[rate-limiter] Cleaned up entries", { cleaned });
    }
  }

  /**
   * Shutdown the rate limiter
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.requests.clear();
    logger.debug("[rate-limiter] Shutdown");
  }
}

// Global rate limiter instance
let rateLimiter: RateLimiter | null = null;

export function initializeRateLimiter(requestsPerMinute: number): void {
  if (rateLimiter) {
    rateLimiter.shutdown();
  }
  rateLimiter = new RateLimiter(requestsPerMinute);
}

export function checkRateLimit(identifier: string = "global"): void {
  if (!rateLimiter) {
    // Rate limiting not enabled
    return;
  }
  rateLimiter.checkLimit(identifier);
}

export function getRateLimitCount(identifier: string = "global"): number {
  if (!rateLimiter) {
    return 0;
  }
  return rateLimiter.getCount(identifier);
}

export function getRateLimitRemaining(identifier: string = "global"): number {
  if (!rateLimiter) {
    return Infinity;
  }
  return rateLimiter.getRemaining(identifier);
}

export function resetRateLimit(identifier: string = "global"): void {
  if (rateLimiter) {
    rateLimiter.reset(identifier);
  }
}

export function shutdownRateLimiter(): void {
  if (rateLimiter) {
    rateLimiter.shutdown();
    rateLimiter = null;
  }
}
