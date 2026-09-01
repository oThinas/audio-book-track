/**
 * Daily trigger for the database backup workflow.
 *
 * The backup itself stays in GitHub Actions — it needs pg_dump and a throwaway
 * Postgres service. Only the schedule lives here, because GitHub disables the
 * `schedule` trigger of a public repository after 60 days without repository
 * activity, and workflow runs do not count as activity: a repository whose
 * backup runs green every single day is disabled all the same. A workflow that
 * carries no `schedule` trigger has nothing for that mechanism to disable.
 *
 * A dispatch that never lands is not silent: the workflow is the only thing
 * that checks in with Sentry, so a missing run raises a missed check-in on the
 * cron monitor.
 */

interface Env {
  GITHUB_PAT: string;
  GITHUB_REPOSITORY: string;
  WORKFLOW_FILE: string;
  WORKFLOW_REF: string;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

/** Retried only on transport errors and 5xx — a 4xx is a config fault and repeating it changes nothing. */
function isRetryable(status: number): boolean {
  return status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchWorkflow(env: Env): Promise<void> {
  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/${env.WORKFLOW_FILE}/dispatches`;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          "Content-Type": "application/json",
          "User-Agent": "audiobook-track-backup-scheduler",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: env.WORKFLOW_REF }),
      });

      if (response.status === 204) {
        console.log(`Backup workflow dispatched (attempt ${attempt})`);
        return;
      }

      lastError = `HTTP ${response.status}: ${await response.text()}`;
      if (!isRetryable(response.status)) {
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < MAX_ATTEMPTS) {
      await delay(RETRY_DELAY_MS * attempt);
    }
  }

  // Thrown so the failure surfaces in Workers observability instead of being
  // swallowed into a successful cron invocation.
  throw new Error(
    `Failed to dispatch backup workflow after ${MAX_ATTEMPTS} attempts. ${lastError}`,
  );
}

export default {
  // Awaited rather than handed to ctx.waitUntil: the rejection must mark the
  // invocation itself as failed, not resolve into a green cron run.
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await dispatchWorkflow(env);
  },
};
