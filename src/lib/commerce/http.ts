/**
 * Shared transport policy for catalog providers: every request has a timeout,
 * and transient failures (network errors, timeouts, 429, 5xx) are retried a
 * bounded number of times. Callers get a typed error they can tell apart from
 * "not found".
 */

export class CommerceUpstreamError extends Error {
  readonly name = "CommerceUpstreamError";
  constructor(
    message: string,
    /** HTTP status, when the provider answered at all. */
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export type TransportPolicy = {
  timeoutMs?: number;
  /** Extra attempts after the first. Only safe for idempotent requests. */
  retries?: number;
  /** Base delay between attempts; doubles each retry. */
  backoffMs?: number;
};

const MAX_RETRY_AFTER_MS = 2_000;

const isTransient = (status: number) => status === 429 || status >= 500;

function retryDelay(res: Response | null, attempt: number, backoffMs: number): number {
  const retryAfter = Number(res?.headers.get("retry-after"));
  const hinted = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0;
  return Math.min(Math.max(hinted, backoffMs * 2 ** attempt), MAX_RETRY_AFTER_MS);
}

/**
 * Returns the response for any status that is not transient, so callers keep
 * handling 401 and 404 themselves. Throws CommerceUpstreamError once transient
 * failures outlast the retry budget.
 */
export async function commerceFetch(
  label: string,
  input: string | URL,
  init: RequestInit = {},
  { timeoutMs = 8_000, retries = 1, backoffMs = 200 }: TransportPolicy = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    let failure: unknown;
    try {
      res = await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (!isTransient(res.status)) return res;
    } catch (e) {
      failure = e;
    }
    if (attempt >= retries) {
      const reason = res ? `status ${res.status}` : failure instanceof Error ? failure.name : "network error";
      throw new CommerceUpstreamError(`${label} failed (${reason})`, res?.status, { cause: failure });
    }
    await new Promise((r) => setTimeout(r, retryDelay(res, attempt, backoffMs)));
  }
}
