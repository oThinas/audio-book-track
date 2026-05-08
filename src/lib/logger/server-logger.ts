export interface ServerLogger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
}

function emit(
  channel: "error" | "warn" | "info",
  level: "error" | "warn" | "info",
  message: string,
  context?: Record<string, unknown>,
): void {
  const payload = JSON.stringify({ level, msg: message, ...(context ?? {}) });
  if (channel === "error") {
    console.error(payload);
  } else if (channel === "warn") {
    console.warn(payload);
  } else {
    console.info(payload);
  }
}

export const serverLogger: ServerLogger = {
  error: (msg, ctx) => emit("error", "error", msg, ctx),
  warn: (msg, ctx) => emit("warn", "warn", msg, ctx),
  info: (msg, ctx) => emit("info", "info", msg, ctx),
};
