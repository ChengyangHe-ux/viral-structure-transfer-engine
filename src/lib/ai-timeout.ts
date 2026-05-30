export function readTimeoutMs(
  envName: string,
  fallbackMs: number,
  env: Record<string, string | undefined> = process.env,
) {
  const rawValue = env[envName];
  if (rawValue === "0") return 0;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) return fallbackMs;

  return Math.floor(parsed);
}

export async function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  if (timeoutMs === 0) return promise;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
