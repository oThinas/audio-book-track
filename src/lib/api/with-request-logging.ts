import type { NextResponse } from "next/server";

import { type ServerLogger, serverLogger } from "@/lib/logger/server-logger";

const DEFAULT_SLOW_THRESHOLD_MS = 3000;

export interface WithRequestLoggingOptions {
  readonly logger?: ServerLogger;
  readonly slowThresholdMs?: number;
  readonly now?: () => number;
}

type Handler<TArgs extends readonly unknown[]> = (
  request: Request,
  ...args: TArgs
) => Promise<NextResponse>;

interface LogPayload {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly duration_ms: number;
  readonly slow: boolean;
}

function buildPayload(
  request: Request,
  status: number,
  durationMs: number,
  slowThresholdMs: number,
): LogPayload {
  return {
    method: request.method,
    path: new URL(request.url).pathname,
    status,
    duration_ms: Math.max(0, Math.round(durationMs)),
    slow: durationMs > slowThresholdMs,
  };
}

export function withRequestLogging<TArgs extends readonly unknown[]>(
  handler: Handler<TArgs>,
  options: WithRequestLoggingOptions = {},
): Handler<TArgs> {
  const logger = options.logger ?? serverLogger;
  const slowThresholdMs = options.slowThresholdMs ?? DEFAULT_SLOW_THRESHOLD_MS;
  const now = options.now ?? (() => performance.now());

  return async (request, ...args) => {
    const start = now();
    try {
      const response = await handler(request, ...args);
      const payload = buildPayload(request, response.status, now() - start, slowThresholdMs);
      logger.info("api.request", payload);
      return response;
    } catch (error) {
      const payload = buildPayload(request, 500, now() - start, slowThresholdMs);
      logger.error("api.request.error", payload);
      throw error;
    }
  };
}
