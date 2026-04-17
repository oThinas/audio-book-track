import { type ChildProcess, spawn } from "node:child_process";

export interface StartNextDevOptions {
  readonly port: number;
  readonly schemaName: string;
  readonly testDatabaseUrl: string;
  readonly readinessTimeoutMs?: number;
}

export interface NextDevHandle {
  readonly proc: ChildProcess;
  readonly port: number;
  readonly baseURL: string;
}

function buildSchemaAwareUrl(url: string, schemaName: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-c search_path=${schemaName}`);
  return parsed.toString();
}

async function waitUntilReady(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Next dev not ready at ${url} after ${timeoutMs}ms (last error: ${String(lastError)})`,
  );
}

export async function startNextDev(options: StartNextDevOptions): Promise<NextDevHandle> {
  const { port, schemaName, testDatabaseUrl, readinessTimeoutMs = 60_000 } = options;
  const databaseUrl = buildSchemaAwareUrl(testDatabaseUrl, schemaName);
  const baseURL = `http://localhost:${port}`;

  // `next start` serves the pre-compiled `.next/` build from the shared
  // project directory. Per-worker server only differs by PORT / DATABASE_URL /
  // BETTER_AUTH_URL — no compilation happens in the worker, so cold start is
  // seconds instead of the minute+ that `next dev --turbopack` needs at
  // 4-way parallelism.
  const proc = spawn("bun", ["x", "next", "start", "--port", String(port)], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: baseURL,
      // Flip auth config to test-friendly values (rate limit off, signup
      // enabled) without tripping Next.js production-mode invariants.
      E2E_TEST_MODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout?.on("data", () => {});
  proc.stderr?.on("data", () => {});

  try {
    await waitUntilReady(`${baseURL}/api/health`, readinessTimeoutMs);
  } catch (error) {
    await stopNextDev({ proc, port, baseURL });
    throw error;
  }

  return { proc, port, baseURL };
}

export async function stopNextDev(handle: NextDevHandle): Promise<void> {
  if (handle.proc.exitCode !== null || handle.proc.killed) return;

  handle.proc.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (handle.proc.exitCode === null) handle.proc.kill("SIGKILL");
      resolve();
    }, 5_000);
    handle.proc.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
