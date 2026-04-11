export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupHealthCheck } = await import("@/lib/db/startup-health-check");
    await runStartupHealthCheck();
  }
}
