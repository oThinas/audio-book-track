export type PingFn = () => Promise<void>;

export type HealthCheckResult = { healthy: true } | { healthy: false; error: string };

interface HealthCheckOptions {
  maxRetries: number;
  retryIntervalMs: number;
  timeoutMs: number;
}

const DEFAULT_OPTIONS: HealthCheckOptions = {
  maxRetries: 3,
  retryIntervalMs: 2000,
  timeoutMs: 5000,
};

const TIMEOUT_SENTINEL = Symbol("timeout");

function categorizeError(error: unknown): string {
  if (error === TIMEOUT_SENTINEL) {
    return "Timeout \u2014 o banco n\u00e3o respondeu a tempo";
  }

  const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;

  if (code === "ECONNREFUSED") {
    return "Conex\u00e3o recusada \u2014 verifique se o PostgreSQL est\u00e1 rodando";
  }

  if (code === "28P01") {
    return "Autentica\u00e7\u00e3o falhou \u2014 verifique credenciais";
  }

  return "Erro de conex\u00e3o \u2014 verifique a configura\u00e7\u00e3o do banco";
}

function withTimeout(ping: PingFn, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(TIMEOUT_SENTINEL), timeoutMs);

    ping().then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkDatabaseHealth(
  ping: PingFn,
  options?: Partial<HealthCheckOptions>,
): Promise<HealthCheckResult> {
  const { maxRetries, retryIntervalMs, timeoutMs } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await withTimeout(ping, timeoutMs);
      return { healthy: true };
    } catch (error: unknown) {
      lastError = error;

      if (attempt < maxRetries) {
        await delay(retryIntervalMs);
      }
    }
  }

  return { healthy: false, error: categorizeError(lastError) };
}

export async function checkDatabaseConnection(
  ping: PingFn,
  timeoutMs = DEFAULT_OPTIONS.timeoutMs,
): Promise<HealthCheckResult> {
  return checkDatabaseHealth(ping, {
    maxRetries: 1,
    retryIntervalMs: 0,
    timeoutMs,
  });
}
