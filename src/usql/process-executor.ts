/**
 * Spawn and manage usql subprocesses
 */

import { spawn } from "child_process";
import { createLogger } from "../utils/logger.js";
import { createUsqlError } from "../utils/error-handler.js";
import { formatConnectionStringForLogging } from "./connection.js";
import { UsqlExecutorOptions } from "../types/index.js";

const logger = createLogger("usql-mcp:process");

export interface UsqlExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function executeUsqlCommand(
  connectionString: string,
  command: string,
  options?: UsqlExecutorOptions
): Promise<UsqlExecutionResult> {
  const timeout = options?.timeout;
  const format = options?.format || "json";

  logger.debug("[process-executor] Executing usql command", {
    connectionString: formatConnectionStringForLogging(connectionString),
    timeout,
    format,
    binaryPath: process.env.USQL_BINARY_PATH?.trim() || "usql",
  });

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timeoutHandle: NodeJS.Timeout | null = null;

    if (typeof timeout === "number" && timeout > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        process.kill(-childProcess.pid!); // Kill process group
        reject(
          createUsqlError(
            "QueryTimeout",
            `Query execution timed out after ${timeout}ms. Consider simplifying your query or increasing the timeout.`,
            { timeout, command: command.substring(0, 100) }
          )
        );
      }, timeout);
    }

    // Build usql arguments
    const args = [connectionString, "-c", command];

    const configuredCommand = process.env.USQL_BINARY_PATH?.trim();
    const commandToRun = configuredCommand && configuredCommand.length > 0 ? configuredCommand : "usql";

    // Add format flag
    if (format === "json") {
      args.push("--json");
    } else if (format === "csv") {
      args.push("--csv");
    }

    // Use detached process group for better cleanup
    const childProcess = spawn(commandToRun, args, {
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    logger.debug("[process-executor] Spawned usql process", {
      pid: childProcess.pid,
      command: commandToRun,
      args: args.map((arg, i) => (i === 0 ? formatConnectionStringForLogging(arg) : arg)),
    });

    childProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    childProcess.on("error", (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (!timedOut) {
        logger.error("[process-executor] Process error", error);
        reject(error);
      }
    });

    childProcess.on("close", (exitCode) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (timedOut) {
        return; // Already rejected
      }

      logger.debug("[process-executor] Process exited", {
        exitCode,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      });

      resolve({
        stdout,
        stderr,
        exitCode: exitCode || 0,
      });
    });

    childProcess.stdin.end();
  });
}

export async function executeUsqlQuery(
  connectionString: string,
  query: string,
  options?: UsqlExecutorOptions
): Promise<UsqlExecutionResult> {
  // Don't escape - spawn() doesn't use shell, so no escaping needed
  return executeUsqlCommand(connectionString, query, {
    timeout: options?.timeout,
    format: options?.format || "json",
  });
}
