/**
 * Logger utility with DEBUG environment variable support
 */

function shouldLog(namespace: string): boolean {
  const debug = process.env.DEBUG || "";
  if (debug === "*") return true;
  if (debug === "") return false;

  const parts = debug.split(",").map((s) => s.trim());
  return parts.some((part) => {
    if (part === "*") return true;
    if (part.endsWith("*")) {
      const prefix = part.slice(0, -1);
      return namespace.startsWith(prefix);
    }
    return namespace === part;
  });
}

function formatTime(): string {
  return new Date().toISOString();
}

function sanitizeString(str: string): string {
  // Redact common credential patterns
  return str
    .replace(/password[=:][\s]*[^\s;,}]*/gi, "password=***")
    .replace(/pwd[=:][\s]*[^\s;,}]*/gi, "pwd=***")
    .replace(/token[=:][\s]*[^\s;,}]*/gi, "token=***")
    .replace(/key[=:][\s]*[^\s;,}]*/gi, "key=***")
    .replace(/@[^@/]*:/, "@***:"); // postgres://user:password@host
}

export class Logger {
  private namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  debug(message: string, data?: unknown): void {
    if (shouldLog(this.namespace)) {
      const sanitized = typeof data === "string" ? sanitizeString(data) : data;
      if (sanitized !== undefined && sanitized !== null && sanitized !== "") {
        console.error(
          "[%s] DEBUG %s: %s %s",
          formatTime(),
          this.namespace,
          message,
          JSON.stringify(sanitized, null, 2)
        );
      } else {
        console.error("[%s] DEBUG %s: %s", formatTime(), this.namespace, message);
      }
    }
  }

  info(message: string, data?: unknown): void {
    if (data !== undefined && data !== null && data !== "") {
      console.error(
        "[%s] INFO %s: %s %s",
        formatTime(),
        this.namespace,
        message,
        JSON.stringify(data, null, 2)
      );
    } else {
      console.error("[%s] INFO %s: %s", formatTime(), this.namespace, message);
    }
  }

  warn(message: string, data?: unknown): void {
    if (data !== undefined && data !== null && data !== "") {
      console.error(
        "[%s] WARN %s: %s %s",
        formatTime(),
        this.namespace,
        message,
        JSON.stringify(data, null, 2)
      );
    } else {
      console.error("[%s] WARN %s: %s", formatTime(), this.namespace, message);
    }
  }

  error(message: string, error?: Error | unknown): void {
    if (error instanceof Error) {
      console.error(
        "[%s] ERROR %s: %s %s %s",
        formatTime(),
        this.namespace,
        message,
        error.message,
        error.stack || ""
      );
    } else {
      if (error !== undefined && error !== null && error !== "") {
        console.error(
          "[%s] ERROR %s: %s %s",
          formatTime(),
          this.namespace,
          message,
          JSON.stringify(error, null, 2)
        );
      } else {
        console.error("[%s] ERROR %s: %s", formatTime(), this.namespace, message);
      }
    }
  }
}

export function createLogger(namespace: string): Logger {
  return new Logger(namespace);
}
