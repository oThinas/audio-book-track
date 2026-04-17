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

  const proc = spawn("bun", ["x", "next", "dev", "--turbopack", "--port", String(port)], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: baseURL,
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
