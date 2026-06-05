import { cookies } from "next/headers";

const E2E_DATA_DELAY_COOKIE = "e2e-data-delay-ms";
const MAX_DELAY_MS = 5_000;

/**
 * Test-only hook: delays server-side data fetching so route loading
 * states (loading.tsx) become deterministically observable in E2E.
 *
 * No-op unless `E2E_TEST_MODE=1` (request-time flag, same pattern as
 * auth/server.ts) AND the `e2e-data-delay-ms` cookie carries a positive
 * number of milliseconds. Production never sets the flag, so this
 * resolves immediately there.
 */
export async function applyE2eDataDelay(): Promise<void> {
  if (process.env.E2E_TEST_MODE !== "1") {
    return;
  }

  const cookieStore = await cookies();
  const rawDelay = cookieStore.get(E2E_DATA_DELAY_COOKIE)?.value;
  if (!rawDelay) {
    return;
  }

  const delayMs = Number(rawDelay);
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, Math.min(delayMs, MAX_DELAY_MS));
  });
}
