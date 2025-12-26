/**
 * Tests for progress notification system
 */

import {
  TimeBasedProgressEstimator,
  ProgressReporter,
  createProgressReporter,
} from "../../src/notifications/progress-notifier";

describe("TimeBasedProgressEstimator", () => {
  it("should start at 0% progress", () => {
    const estimator = new TimeBasedProgressEstimator(1000);
    const progress = estimator.getCurrentProgress();

    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThan(10); // Should be very close to 0 initially
  });

  it("should never reach 100% during operation", async () => {
    const estimator = new TimeBasedProgressEstimator(100); // 100ms expected duration

    // Wait for 200ms (2x the expected duration)
    await new Promise((resolve) => setTimeout(resolve, 200));

    const progress = estimator.getCurrentProgress();
    expect(progress).toBeLessThan(100); // Should approach but never reach 100%
    expect(progress).toBeGreaterThan(90); // Should be close to 100%
  });

  it("should return 100% for completed operations", () => {
    const estimator = new TimeBasedProgressEstimator(1000);
    const completedProgress = estimator.getCompletedProgress();

    expect(completedProgress).toBe(100);
  });

  it("should only increase progress (never decrease)", async () => {
    const estimator = new TimeBasedProgressEstimator(1000);

    let previousProgress = estimator.getCurrentProgress();

    // Check progress multiple times
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const currentProgress = estimator.getCurrentProgress();
      expect(currentProgress).toBeGreaterThanOrEqual(previousProgress);
      previousProgress = currentProgress;
    }
  });

  it("should reset progress", async () => {
    const estimator = new TimeBasedProgressEstimator(100);

    // Wait to get some progress
    await new Promise((resolve) => setTimeout(resolve, 100));
    const progressBefore = estimator.getCurrentProgress();
    expect(progressBefore).toBeGreaterThan(50);

    // Reset
    estimator.reset();

    // Progress should be back near 0
    const progressAfter = estimator.getCurrentProgress();
    expect(progressAfter).toBeLessThan(progressBefore);
    expect(progressAfter).toBeLessThan(10);
  });
});

describe("ProgressReporter", () => {
  it("should create reporter with default update interval", () => {
    const reporter = new ProgressReporter(1000);
    expect(reporter).toBeDefined();
  });

  it("should send initial progress when started", async () => {
    const progressUpdates: number[] = [];
    const callback = (progress: number) => {
      progressUpdates.push(progress);
    };

    const reporter = new ProgressReporter(1000, callback, 50); // 50ms update interval
    reporter.start();

    // Wait for initial update
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(progressUpdates.length).toBeGreaterThan(0);
    reporter.stop();
  });

  it("should send periodic progress updates", async () => {
    const progressUpdates: number[] = [];
    const callback = (progress: number) => {
      progressUpdates.push(progress);
    };

    const reporter = new ProgressReporter(1000, callback, 50); // 50ms update interval
    reporter.start();

    // Wait for multiple updates
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(progressUpdates.length).toBeGreaterThan(2);
    reporter.stop();
  });

  it("should report 100% completion", async () => {
    const progressUpdates: number[] = [];
    const callback = (progress: number) => {
      progressUpdates.push(progress);
    };

    const reporter = new ProgressReporter(1000, callback);
    reporter.start();

    await new Promise((resolve) => setTimeout(resolve, 50));

    reporter.reportCompletion();

    // Last update should be 100%
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  });

  it("should stop sending updates after stop()", async () => {
    const progressUpdates: number[] = [];
    const callback = (progress: number) => {
      progressUpdates.push(progress);
    };

    const reporter = new ProgressReporter(1000, callback, 50);
    reporter.start();

    await new Promise((resolve) => setTimeout(resolve, 100));
    const countBeforeStop = progressUpdates.length;

    reporter.stop();

    await new Promise((resolve) => setTimeout(resolve, 100));
    const countAfterStop = progressUpdates.length;

    // Should not have received more updates after stop
    expect(countAfterStop).toBe(countBeforeStop);
  });

  it("should not send updates if callback is not provided", async () => {
    const reporter = new ProgressReporter(1000); // No callback
    reporter.start();

    // Should not throw
    await new Promise((resolve) => setTimeout(resolve, 100));

    reporter.stop();
  });

  it("should get current progress without sending notification", () => {
    const reporter = new ProgressReporter(1000);
    const progress = reporter.getCurrentProgress();

    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThan(100);
  });

  it("should not start if already stopped", async () => {
    const progressUpdates: number[] = [];
    const callback = (progress: number) => {
      progressUpdates.push(progress);
    };

    const reporter = new ProgressReporter(1000, callback, 50);
    reporter.stop();
    reporter.start();

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should not have received any updates
    expect(progressUpdates.length).toBe(0);
  });
});

describe("createProgressReporter", () => {
  it("should create a progress reporter", () => {
    const reporter = createProgressReporter(1000);
    expect(reporter).toBeInstanceOf(ProgressReporter);
  });

  it("should create reporter with custom callback", async () => {
    const progressUpdates: number[] = [];
    const callback = (progress: number) => {
      progressUpdates.push(progress);
    };

    const reporter = createProgressReporter(1000, callback, 50);
    reporter.start();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(progressUpdates.length).toBeGreaterThan(0);
    reporter.stop();
  });

  it("should create reporter with custom update interval", async () => {
    const progressUpdates: number[] = [];
    const callback = (progress: number) => {
      progressUpdates.push(progress);
    };

    const reporter = createProgressReporter(1000, callback, 100); // 100ms interval
    reporter.start();

    await new Promise((resolve) => setTimeout(resolve, 250));

    // With 100ms interval, in 250ms we should get ~2-3 updates
    expect(progressUpdates.length).toBeGreaterThan(1);
    expect(progressUpdates.length).toBeLessThan(5);
    reporter.stop();
  });
});
