import { spawn } from "node:child_process";

export interface SeedSpawnOptions {
  readonly url: string;
  readonly schema: string;
  readonly timeoutMs?: number;
}

export async function seedAdminForSchema(options: SeedSpawnOptions): Promise<void> {
  const { url, schema, timeoutMs = 30_000 } = options;

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "bun",
      ["run", "src/lib/db/seed-test.ts", "--url", url, "--schema", schema],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NODE_ENV: "test" },
      },
    );

    let stderr = "";
    proc.stdout?.on("data", () => {});
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`seed-test timed out after ${timeoutMs}ms for schema ${schema}`));
    }, timeoutMs);

    proc.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`seed-test exited ${code} for schema ${schema}:\n${stderr}`));
    });
  });
}
