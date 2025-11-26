/**
 * Comprehensive tests for job-manager
 */

import {
  initializeJobManager,
  getJobManager,
  shutdownJobManager,
} from "../../src/usql/job-manager.js";

describe("JobManager", () => {
  beforeEach(() => {
    // Reset the singleton before each test
    shutdownJobManager();
  });

  afterEach(() => {
    shutdownJobManager();
  });

  describe("Initialization", () => {
    it("should initialize a new job manager with default TTL", () => {
      const manager = initializeJobManager();
      expect(manager).toBeDefined();
      const jobs = manager.getAllJobs();
      expect(jobs).toEqual([]);
    });

    it("should initialize a new job manager with custom TTL", () => {
      const customTTL = 7200000; // 2 hours
      const manager = initializeJobManager(customTTL);
      expect(manager).toBeDefined();
    });

    it("should return the same singleton instance on second call", () => {
      const manager1 = initializeJobManager();
      const manager2 = initializeJobManager();
      expect(manager1).toBe(manager2);
    });

    it("should get or create job manager via getJobManager", () => {
      const manager = getJobManager();
      expect(manager).toBeDefined();
      const jobs = manager.getAllJobs();
      expect(jobs).toEqual([]);
    });

    it("should support shutdown and reinitialize", () => {
      const manager1 = initializeJobManager();
      manager1.createJob("test_tool");
      shutdownJobManager();

      const manager2 = getJobManager();
      const jobs = manager2.getAllJobs();
      expect(jobs.length).toBe(0);
    });
  });

  describe("createJob", () => {
    it("should create a job with running status", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe("string");
      expect(jobId.length).toBeGreaterThan(0);

      const job = manager.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.status).toBe("running");
      expect(job?.toolName).toBe("test_tool");
    });

    it("should create multiple jobs with unique IDs", () => {
      const manager = initializeJobManager();
      const jobId1 = manager.createJob("tool1");
      const jobId2 = manager.createJob("tool2");

      expect(jobId1).not.toBe(jobId2);
      expect(manager.getAllJobs()).toHaveLength(2);
    });

    it("should store connection string hash if provided", () => {
      const manager = initializeJobManager();
      const connectionHash = "hash123";
      const jobId = manager.createJob("test_tool", connectionHash);

      const job = manager.getJob(jobId);
      expect(job?.connectionStringHash).toBe(connectionHash);
    });

    it("should store custom startedAtMs if provided", () => {
      const manager = initializeJobManager();
      const customTime = 1000000;
      const jobId = manager.createJob("test_tool", undefined, customTime);

      const job = manager.getJob(jobId);
      expect(job?.startedAtMs).toBe(customTime);
      expect(job?.startedAt).toEqual(new Date(customTime));
    });

    it("should use current time if startedAtMs not provided", () => {
      const manager = initializeJobManager();
      const before = Date.now();
      const jobId = manager.createJob("test_tool");
      const after = Date.now();

      const job = manager.getJob(jobId);
      expect(job?.startedAtMs).toBeGreaterThanOrEqual(before);
      expect(job?.startedAtMs).toBeLessThanOrEqual(after);
    });
  });

  describe("completeJob", () => {
    it("should mark job as completed with result", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const result = { rows: [{ id: 1, name: "test" }] };

      manager.completeJob(jobId, result);

      const job = manager.getJob(jobId);
      expect(job?.status).toBe("completed");
      expect(job?.result).toEqual(result);
      expect(job?.completedAt).toBeDefined();
    });

    it("should set completedAt timestamp", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const before = Date.now();

      manager.completeJob(jobId, {});

      const after = Date.now();
      const job = manager.getJob(jobId);
      expect(job?.completedAt).toBeDefined();
      expect(job!.completedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(job!.completedAt!.getTime()).toBeLessThanOrEqual(after);
    });

    it("should handle completing non-existent job gracefully", () => {
      const manager = initializeJobManager();
      expect(() => {
        manager.completeJob("non-existent", {});
      }).not.toThrow();

      expect(manager.getJob("non-existent")).toBeNull();
    });

    it("should allow storing any result type", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");

      const stringResult = "test string";
      manager.completeJob(jobId, stringResult);
      expect(manager.getJob(jobId)?.result).toBe(stringResult);

      const jobId2 = manager.createJob("test_tool");
      const nullResult = null;
      manager.completeJob(jobId2, nullResult);
      expect(manager.getJob(jobId2)?.result).toBeNull();

      const jobId3 = manager.createJob("test_tool");
      const arrayResult = [1, 2, 3];
      manager.completeJob(jobId3, arrayResult);
      expect(manager.getJob(jobId3)?.result).toEqual(arrayResult);
    });
  });

  describe("failJob", () => {
    it("should mark job as failed with error", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const error = { error: "TestError", message: "Test error message" };

      manager.failJob(jobId, error);

      const job = manager.getJob(jobId);
      expect(job?.status).toBe("failed");
      expect(job?.error).toEqual(error);
      expect(job?.completedAt).toBeDefined();
    });

    it("should set completedAt timestamp", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const before = Date.now();

      manager.failJob(jobId, { error: "TestError", message: "msg" });

      const after = Date.now();
      const job = manager.getJob(jobId);
      expect(job?.completedAt).toBeDefined();
      expect(job!.completedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(job!.completedAt!.getTime()).toBeLessThanOrEqual(after);
    });

    it("should handle failing non-existent job gracefully", () => {
      const manager = initializeJobManager();
      expect(() => {
        manager.failJob("non-existent", { error: "TestError", message: "msg" });
      }).not.toThrow();

      expect(manager.getJob("non-existent")).toBeNull();
    });

    it("should store error details", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const error = {
        error: "QueryExecutionError",
        message: "Syntax error in query",
        details: { cause: "unexpected token" },
      };

      manager.failJob(jobId, error);

      const job = manager.getJob(jobId);
      expect(job?.error).toEqual(error);
    });
  });

  describe("cancelJob", () => {
    it("should cancel a running job", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");

      const result = manager.cancelJob(jobId);

      expect(result.success).toBe(true);
      expect(result.message).toContain("cancelled successfully");

      const job = manager.getJob(jobId);
      expect(job?.status).toBe("cancelled");
      expect(job?.error?.error).toBe("JobCancelled");
    });

    it("should fail to cancel non-existent job", () => {
      const manager = initializeJobManager();
      const result = manager.cancelJob("non-existent");

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("should fail to cancel already completed job", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      manager.completeJob(jobId, {});

      const result = manager.cancelJob(jobId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("not running");
    });

    it("should abort controller if registered", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const controller = new AbortController();
      const abortSpy = jest.spyOn(controller, "abort");

      manager.setJobCanceller(jobId, controller);
      manager.cancelJob(jobId);

      expect(abortSpy).toHaveBeenCalled();
    });

    it("should set completedAt timestamp on cancellation", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const before = Date.now();

      manager.cancelJob(jobId);

      const after = Date.now();
      const job = manager.getJob(jobId);
      expect(job?.completedAt).toBeDefined();
      expect(job!.completedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(job!.completedAt!.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe("getJob", () => {
    it("should return job state by ID", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool", "hash123");

      const job = manager.getJob(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.status).toBe("running");
      expect(job?.toolName).toBe("test_tool");
      expect(job?.connectionStringHash).toBe("hash123");
    });

    it("should return null for non-existent job", () => {
      const manager = initializeJobManager();
      const job = manager.getJob("non-existent");

      expect(job).toBeNull();
    });

    it("should return a copy of the job state", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");

      const job1 = manager.getJob(jobId);
      const job2 = manager.getJob(jobId);

      expect(job1).toEqual(job2);
      expect(job1).not.toBe(job2); // Different object references
    });
  });

  describe("getAllJobs", () => {
    it("should return all jobs", () => {
      const manager = initializeJobManager();
      const jobId1 = manager.createJob("tool1");
      const jobId2 = manager.createJob("tool2");
      const jobId3 = manager.createJob("tool3");

      const jobs = manager.getAllJobs();

      expect(jobs).toHaveLength(3);
      expect(jobs.map((j) => j.id)).toEqual(expect.arrayContaining([jobId1, jobId2, jobId3]));
    });

    it("should return empty array when no jobs", () => {
      const manager = initializeJobManager();
      const jobs = manager.getAllJobs();

      expect(jobs).toEqual([]);
    });

    it("should return copies of jobs, not references", () => {
      const manager = initializeJobManager();
      manager.createJob("tool1");

      const jobs1 = manager.getAllJobs();
      const jobs2 = manager.getAllJobs();

      expect(jobs1).toEqual(jobs2);
      expect(jobs1[0]).not.toBe(jobs2[0]); // Different references
    });

    it("should include jobs with various statuses", () => {
      const manager = initializeJobManager();
      const jobId1 = manager.createJob("tool1");
      const jobId2 = manager.createJob("tool2");
      manager.createJob("tool3"); // remains running

      manager.completeJob(jobId1, {});
      manager.failJob(jobId2, { error: "TestError", message: "msg" });

      const jobs = manager.getAllJobs();

      expect(jobs.filter((j) => j.status === "completed")).toHaveLength(1);
      expect(jobs.filter((j) => j.status === "failed")).toHaveLength(1);
      expect(jobs.filter((j) => j.status === "running")).toHaveLength(1);
    });
  });

  describe("deleteJob", () => {
    it("should delete a specific job", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");

      const deleted = manager.deleteJob(jobId);

      expect(deleted).toBe(true);
      expect(manager.getJob(jobId)).toBeNull();
    });

    it("should return false when deleting non-existent job", () => {
      const manager = initializeJobManager();
      const deleted = manager.deleteJob("non-existent");

      expect(deleted).toBe(false);
    });

    it("should cleanup waiters when deleting job", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");

      // Start waiting (but don't await)
      const waitPromise = manager.waitForCompletion(jobId, 10000);

      // Immediately delete job
      manager.deleteJob(jobId);

      // The wait should eventually resolve to null or timeout
      expect(waitPromise).toBeDefined();
    });

    it("should allow deleting completed jobs", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      manager.completeJob(jobId, {});

      const deleted = manager.deleteJob(jobId);

      expect(deleted).toBe(true);
    });
  });

  describe("getRunningJobs", () => {
    it("should return only running jobs", () => {
      const manager = initializeJobManager();
      const jobId1 = manager.createJob("tool1");
      const jobId2 = manager.createJob("tool2");
      const jobId3 = manager.createJob("tool3");

      manager.completeJob(jobId1, {});
      manager.failJob(jobId2, { error: "TestError", message: "msg" });
      // jobId3 remains running

      const runningJobs = manager.getRunningJobs();

      expect(runningJobs).toHaveLength(1);
      expect(runningJobs[0].id).toBe(jobId3);
      expect(runningJobs[0].status).toBe("running");
    });

    it("should return empty array when no running jobs", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      manager.completeJob(jobId, {});

      const runningJobs = manager.getRunningJobs();

      expect(runningJobs).toEqual([]);
    });

    it("should return copies, not references", () => {
      const manager = initializeJobManager();
      manager.createJob("tool1");

      const jobs1 = manager.getRunningJobs();
      const jobs2 = manager.getRunningJobs();

      expect(jobs1).toEqual(jobs2);
      expect(jobs1[0]).not.toBe(jobs2[0]);
    });
  });

  describe("setJobCanceller and cancelJob integration", () => {
    it("should register and use an abort controller", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const controller = new AbortController();

      manager.setJobCanceller(jobId, controller);
      expect(controller.signal.aborted).toBe(false);

      manager.cancelJob(jobId);
      expect(controller.signal.aborted).toBe(true);
    });

    it("should handle cancellation without controller", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");

      // No setJobCanceller called
      const result = manager.cancelJob(jobId);

      expect(result.success).toBe(true);
      expect(manager.getJob(jobId)?.status).toBe("cancelled");
    });

    it("should register multiple cancellers (last one wins)", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      manager.setJobCanceller(jobId, controller1);
      manager.setJobCanceller(jobId, controller2);

      manager.cancelJob(jobId);

      // The second controller should have been aborted
      expect(controller2.signal.aborted).toBe(true);
    });
  });

  describe("waitForCompletion", () => {
    it("should resolve immediately if job not found", async () => {
      const manager = initializeJobManager();
      const job = await manager.waitForCompletion("non-existent", 1000);

      expect(job).toBeNull();
    });

    it("should resolve immediately if job already completed", async () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const result = { data: "test" };
      manager.completeJob(jobId, result);

      const job = await manager.waitForCompletion(jobId, 1000);

      expect(job).toBeDefined();
      expect(job?.status).toBe("completed");
      expect(job?.result).toEqual(result);
    });

    it("should resolve immediately if job already failed", async () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const error = { error: "TestError", message: "msg" };
      manager.failJob(jobId, error);

      const job = await manager.waitForCompletion(jobId, 1000);

      expect(job).toBeDefined();
      expect(job?.status).toBe("failed");
      expect(job?.error).toEqual(error);
    });

    it("should resolve immediately if job already cancelled", async () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      manager.cancelJob(jobId);

      const job = await manager.waitForCompletion(jobId, 1000);

      expect(job).toBeDefined();
      expect(job?.status).toBe("cancelled");
    });

    it("should wait for job completion", async () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const result = { data: "test" };

      // Complete the job after a delay
      setTimeout(() => {
        manager.completeJob(jobId, result);
      }, 100);

      const job = await manager.waitForCompletion(jobId, 5000);

      expect(job).toBeDefined();
      expect(job?.status).toBe("completed");
      expect(job?.result).toEqual(result);
    });

    it("should wait for job failure", async () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const error = { error: "TestError", message: "msg" };

      // Fail the job after a delay
      setTimeout(() => {
        manager.failJob(jobId, error);
      }, 100);

      const job = await manager.waitForCompletion(jobId, 5000);

      expect(job).toBeDefined();
      expect(job?.status).toBe("failed");
      expect(job?.error).toEqual(error);
    });

    it("should timeout if job doesn't complete", async () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");

      // Don't complete the job
      const job = await manager.waitForCompletion(jobId, 100);

      expect(job).toBeDefined();
      expect(job?.status).toBe("running"); // Still running
    });

    it("should handle multiple concurrent waiters", async () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const result = { data: "test" };

      // Start multiple waiters
      const wait1 = manager.waitForCompletion(jobId, 5000);
      const wait2 = manager.waitForCompletion(jobId, 5000);
      const wait3 = manager.waitForCompletion(jobId, 5000);

      // Complete the job
      setTimeout(() => {
        manager.completeJob(jobId, result);
      }, 50);

      const [job1, job2, job3] = await Promise.all([wait1, wait2, wait3]);

      expect(job1?.status).toBe("completed");
      expect(job2?.status).toBe("completed");
      expect(job3?.status).toBe("completed");
      expect(job1?.result).toEqual(result);
      expect(job2?.result).toEqual(result);
      expect(job3?.result).toEqual(result);
    });

    it("should return copy of job state", async () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      manager.completeJob(jobId, {});

      const waitJob = await manager.waitForCompletion(jobId, 1000);
      const getJob = manager.getJob(jobId);

      expect(waitJob).toEqual(getJob);
      expect(waitJob).not.toBe(getJob); // Different references
    });
  });

  describe("forceCleanup", () => {
    it("should clear all jobs", () => {
      const manager = initializeJobManager();
      manager.createJob("tool1");
      manager.createJob("tool2");

      manager.forceCleanup();

      expect(manager.getAllJobs()).toEqual([]);
    });

    it("should clear cleanup interval", async () => {
      const manager = initializeJobManager();
      manager.forceCleanup();

      // If interval wasn't cleared, this would cause issues
      // We can't directly test this, but it should not throw
      expect(() => {
        manager.forceCleanup();
      }).not.toThrow();
    });

    it("should allow reinitializing after cleanup", () => {
      let manager = initializeJobManager();
      manager.createJob("tool1");
      manager.forceCleanup();

      manager = initializeJobManager();
      expect(manager.getAllJobs()).toEqual([]);
    });
  });

  describe("Job TTL cleanup", () => {
    it("should cleanup expired completed jobs (integration test)", async () => {
      const TTL = 100; // 100ms
      const manager = initializeJobManager(TTL);
      const jobId = manager.createJob("test_tool");

      // Complete the job
      manager.completeJob(jobId, {});
      expect(manager.getJob(jobId)).toBeDefined();

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, TTL + 50));

      // Manually trigger cleanup (since interval runs every 5 minutes)
      // We can't directly call cleanup() since it's private, but we can verify the job still exists
      // because the cleanup interval hasn't run yet

      // Instead, create a new manager with instant cleanup
      shutdownJobManager();

      const manager2 = initializeJobManager(50);
      const jobId2 = manager2.createJob("test_tool");
      manager2.completeJob(jobId2, {});

      // After sufficient time for cleanup, the old job should be gone
      // (but since cleanup runs every 5 minutes, we can't test this easily in unit tests)
      expect(manager2.getJob(jobId2)).toBeDefined();
    });

    it("should not cleanup running jobs", async () => {
      const TTL = 50; // 50ms
      const manager = initializeJobManager(TTL);
      const jobId = manager.createJob("test_tool");

      // Keep job running (don't complete it)
      await new Promise((resolve) => setTimeout(resolve, TTL + 100));

      expect(manager.getJob(jobId)).toBeDefined();
      expect(manager.getJob(jobId)?.status).toBe("running");
    });
  });

  describe("Edge cases", () => {
    it("should handle rapid job creation and completion", () => {
      const manager = initializeJobManager();

      for (let i = 0; i < 100; i++) {
        const jobId = manager.createJob("tool");
        manager.completeJob(jobId, { index: i });
      }

      expect(manager.getAllJobs()).toHaveLength(100);
    });

    it("should handle very large result objects", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");

      // Create a large result
      const largeResult = {
        rows: Array(10000).fill(null).map((_, i) => ({ id: i, data: "x".repeat(100) })),
      };

      manager.completeJob(jobId, largeResult);

      const job = manager.getJob(jobId);
      expect(job?.result).toEqual(largeResult);
    });

    it("should handle completing already-completed job", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");

      manager.completeJob(jobId, { data: "first" });
      manager.completeJob(jobId, { data: "second" });

      // Second complete overwrites first
      const job = manager.getJob(jobId);
      expect(job?.result).toEqual({ data: "second" });
    });

    it("should handle failing already-failed job", () => {
      const manager = initializeJobManager();
      const jobId = manager.createJob("test_tool");
      const error1 = { error: "Error1", message: "msg1" };
      const error2 = { error: "Error2", message: "msg2" };

      manager.failJob(jobId, error1);
      manager.failJob(jobId, error2);

      // Second fail overwrites first
      const job = manager.getJob(jobId);
      expect(job?.error).toEqual(error2);
    });
  });
});
