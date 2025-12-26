/**
 * Tests for request tracking and cancellation
 */

import {
  trackRequest,
  untrackRequest,
  cancelRequest,
  getActiveRequestCount,
  cancelAllRequests,
} from "../../src/utils/request-tracker.js";

describe("RequestTracker", () => {
  beforeEach(() => {
    // Clean up any tracked requests from previous tests
    cancelAllRequests();
  });

  afterEach(() => {
    // Clean up after each test
    cancelAllRequests();
  });

  describe("trackRequest", () => {
    it("should return an AbortSignal", () => {
      const signal = trackRequest("test-1");
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });

    it("should track multiple requests", () => {
      trackRequest("test-1");
      trackRequest("test-2");
      trackRequest("test-3");

      expect(getActiveRequestCount()).toBe(3);
    });

    it("should allow string or number IDs", () => {
      trackRequest("string-id");
      trackRequest(123);

      expect(getActiveRequestCount()).toBe(2);
    });
  });

  describe("untrackRequest", () => {
    it("should remove a tracked request", () => {
      trackRequest("test-1");
      expect(getActiveRequestCount()).toBe(1);

      untrackRequest("test-1");
      expect(getActiveRequestCount()).toBe(0);
    });

    it("should not error when untracking non-existent request", () => {
      expect(() => {
        untrackRequest("non-existent");
      }).not.toThrow();
    });

    it("should only remove the specified request", () => {
      trackRequest("test-1");
      trackRequest("test-2");
      trackRequest("test-3");

      untrackRequest("test-2");

      expect(getActiveRequestCount()).toBe(2);
    });
  });

  describe("cancelRequest", () => {
    it("should abort the request signal", () => {
      const signal = trackRequest("test-1");
      expect(signal.aborted).toBe(false);

      const cancelled = cancelRequest("test-1");

      expect(cancelled).toBe(true);
      expect(signal.aborted).toBe(true);
    });

    it("should remove the request from tracking", () => {
      trackRequest("test-1");
      expect(getActiveRequestCount()).toBe(1);

      cancelRequest("test-1");

      expect(getActiveRequestCount()).toBe(0);
    });

    it("should return false for non-existent request", () => {
      const cancelled = cancelRequest("non-existent");
      expect(cancelled).toBe(false);
    });

    it("should trigger abort event listeners", (done) => {
      const signal = trackRequest("test-1");

      signal.addEventListener("abort", () => {
        expect(signal.aborted).toBe(true);
        done();
      });

      cancelRequest("test-1");
    });
  });

  describe("getActiveRequestCount", () => {
    it("should return 0 initially", () => {
      expect(getActiveRequestCount()).toBe(0);
    });

    it("should return correct count", () => {
      trackRequest("test-1");
      trackRequest("test-2");

      expect(getActiveRequestCount()).toBe(2);

      untrackRequest("test-1");

      expect(getActiveRequestCount()).toBe(1);
    });
  });

  describe("cancelAllRequests", () => {
    it("should cancel all tracked requests", () => {
      const signal1 = trackRequest("test-1");
      const signal2 = trackRequest("test-2");
      const signal3 = trackRequest("test-3");

      expect(getActiveRequestCount()).toBe(3);

      cancelAllRequests();

      expect(signal1.aborted).toBe(true);
      expect(signal2.aborted).toBe(true);
      expect(signal3.aborted).toBe(true);
      expect(getActiveRequestCount()).toBe(0);
    });

    it("should not error when no requests are tracked", () => {
      expect(() => {
        cancelAllRequests();
      }).not.toThrow();
    });
  });

  describe("Integration scenarios", () => {
    it("should support full request lifecycle", () => {
      // Start tracking
      const signal = trackRequest("request-123");
      expect(getActiveRequestCount()).toBe(1);
      expect(signal.aborted).toBe(false);

      // Simulate request completion
      untrackRequest("request-123");
      expect(getActiveRequestCount()).toBe(0);

      // Signal should not be aborted if request completed normally
      expect(signal.aborted).toBe(false);
    });

    it("should handle concurrent requests", () => {
      const signals: AbortSignal[] = [];

      // Simulate 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        signals.push(trackRequest(`request-${i}`));
      }

      expect(getActiveRequestCount()).toBe(10);

      // Complete half of them
      for (let i = 0; i < 5; i++) {
        untrackRequest(`request-${i}`);
      }

      expect(getActiveRequestCount()).toBe(5);

      // Cancel the rest
      cancelAllRequests();

      expect(getActiveRequestCount()).toBe(0);
      for (let i = 5; i < 10; i++) {
        expect(signals[i].aborted).toBe(true);
      }
    });

    it("should allow reusing request IDs after untracking", () => {
      const signal1 = trackRequest("reusable-id");
      untrackRequest("reusable-id");

      const signal2 = trackRequest("reusable-id");

      expect(signal1).not.toBe(signal2);
      expect(signal1.aborted).toBe(false);
      expect(signal2.aborted).toBe(false);
    });
  });
});
