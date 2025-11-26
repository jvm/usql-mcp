import { handleGetJobStatus } from "../../src/tools/get-job-status.js";

const mockJobManager = {
  getJob: jest.fn(),
  waitForCompletion: jest.fn(),
};

jest.mock("../../src/usql/job-manager.js", () => {
  return {
    getJobManager: () => mockJobManager,
    __esModule: true,
  };
});

describe("handleGetJobStatus", () => {
  const startMs = Date.UTC(2025, 0, 1, 0, 0, 0);
  const startDate = new Date(startMs);

  beforeEach(() => {
    jest.restoreAllMocks();
    mockJobManager.getJob.mockReset();
    mockJobManager.waitForCompletion.mockReset();
  });

  it("returns elapsed_ms for a running job that has been in-flight for some time", async () => {
    mockJobManager.getJob.mockReturnValue({
      id: "job1",
      status: "running",
      startedAt: startDate,
      startedAtMs: startMs,
    });
    mockJobManager.waitForCompletion.mockResolvedValue({
      id: "job1",
      status: "running",
      startedAt: startDate,
      startedAtMs: startMs,
    });
    // Simulate a get_job_status call happening 12 seconds after the job started
    jest.spyOn(Date, "now").mockReturnValue(startMs + 12000);

    const result = await handleGetJobStatus({ job_id: "job1", wait_seconds: 5 });

    expect(result.status).toBe("running");
    expect(result.started_at).toBe("2025-01-01T00:00:00.000Z");
    expect(result.elapsed_ms).toBe(12000);
    expect(mockJobManager.waitForCompletion).toHaveBeenCalledWith("job1", 5000);
  });

  it("returns elapsed_ms based on start time for already completed job without waiting", async () => {
    mockJobManager.getJob.mockReturnValue({
      id: "job2",
      status: "completed",
      startedAt: startDate,
      startedAtMs: startMs,
      completedAt: new Date(startMs + 2000),
    });
    jest.spyOn(Date, "now").mockReturnValue(startMs + 12000);

    const result = await handleGetJobStatus({ job_id: "job2", wait_seconds: 5 });

    expect(result.status).toBe("completed");
    expect(result.started_at).toBe("2025-01-01T00:00:00.000Z");
    // elapsed should be based on completion time, not the later poll time
    expect(result.elapsed_ms).toBe(2000);
    expect(mockJobManager.waitForCompletion).not.toHaveBeenCalled();
  });

  it("returns elapsed_ms based on start time when job is still running after wait", async () => {
    mockJobManager.getJob.mockReturnValue({
      id: "job3",
      status: "running",
      startedAt: startDate,
      startedAtMs: startMs,
    });
    mockJobManager.waitForCompletion.mockResolvedValue({
      id: "job3",
      status: "running",
      startedAt: startDate,
      startedAtMs: startMs,
    });
    jest.spyOn(Date, "now").mockReturnValue(startMs + 7000);

    const result = await handleGetJobStatus({ job_id: "job3", wait_seconds: 2 });

    expect(result.status).toBe("running");
    expect(result.started_at).toBe("2025-01-01T00:00:00.000Z");
    expect(result.elapsed_ms).toBe(7000);
    expect(mockJobManager.waitForCompletion).toHaveBeenCalledWith("job3", 2000);
  });

  it("handles multi-call scenario with accumulated elapsed time across waits", async () => {
    // First call: after 30s, still running
    mockJobManager.getJob.mockReturnValueOnce({
      id: "jobX",
      status: "running",
      startedAt: startDate,
      startedAtMs: startMs,
    });
    mockJobManager.waitForCompletion.mockResolvedValueOnce({
      id: "jobX",
      status: "running",
      startedAt: startDate,
      startedAtMs: startMs,
    });
    jest.spyOn(Date, "now").mockReturnValueOnce(startMs + 30000);

    const first = await handleGetJobStatus({ job_id: "jobX", wait_seconds: 30 });
    expect(first.status).toBe("running");
    expect(first.elapsed_ms).toBe(30000);

    // Second call: after another 45s (total 75s), still running
    mockJobManager.getJob.mockReturnValueOnce({
      id: "jobX",
      status: "running",
      startedAt: startDate,
      startedAtMs: startMs,
    });
    mockJobManager.waitForCompletion.mockResolvedValueOnce({
      id: "jobX",
      status: "running",
      startedAt: startDate,
      startedAtMs: startMs,
    });
    (Date.now as jest.Mock).mockReturnValueOnce(startMs + 75000);

    const second = await handleGetJobStatus({ job_id: "jobX", wait_seconds: 45 });
    expect(second.status).toBe("running");
    expect(second.elapsed_ms).toBe(75000);

    // Third call: job completes after 10s more (total 85s)
    mockJobManager.getJob.mockReturnValueOnce({
      id: "jobX",
      status: "running",
      startedAt: startDate,
      startedAtMs: startMs,
    });
    mockJobManager.waitForCompletion.mockResolvedValueOnce({
      id: "jobX",
      status: "completed",
      startedAt: startDate,
      startedAtMs: startMs,
      completedAt: new Date(startMs + 85000),
      result: { rows: 1 },
    });
    (Date.now as jest.Mock).mockReturnValueOnce(startMs + 85000);

    const third = await handleGetJobStatus({ job_id: "jobX", wait_seconds: 45 });
    expect(third.status).toBe("completed");
    expect(third.elapsed_ms).toBe(85000);
    expect(third.result).toEqual({ rows: 1 });
  });
});
