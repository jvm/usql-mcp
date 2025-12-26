/**
 * Unit tests for background execution wrapper
 */

import { withBackgroundSupport } from "../../src/tools/background-wrapper.js";
import { getJobManager, shutdownJobManager } from "../../src/usql/job-manager.js";
import { BackgroundJobResponse } from "../../src/types/index.js";

// Force immediate backgrounding
jest.mock("../../src/usql/config.js", () => ({
  getBackgroundThresholdMs: () => 0,
}));

describe("Background Wrapper", () => {
  afterEach(() => {
    shutdownJobManager();
  });

  it("stores a hashed, sanitized connection identifier instead of raw credentials", async () => {
    const handler = jest.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 5);
        })
    );

    const wrapped = withBackgroundSupport<{ connection_string: string }, unknown>(
      "execute_query",
      handler
    );

    const response = (await wrapped({
      connection_string: "postgres://user:secret@host/db",
    })) as BackgroundJobResponse;

    expect(response.status).toBe("background");

    const job = getJobManager().getJob(response.job_id);
    expect(job?.connectionStringHash).toBeDefined();
    expect(job?.connectionStringHash).not.toContain("secret");
    expect(job?.connectionStringHash).toMatch(/^[a-f0-9]{64}$/);

    // Allow handler to finish and ensure cleanup still keeps hash
    await new Promise((resolve) => setTimeout(resolve, 10));
    const completed = getJobManager().getJob(response.job_id);
    expect(completed?.status).toBe("completed");
    expect(completed?.connectionStringHash).toBe(job?.connectionStringHash);
  });
});
