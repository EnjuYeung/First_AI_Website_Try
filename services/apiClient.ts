export class UnauthorizedError extends Error {
  name = 'UnauthorizedError';

  constructor(message = 'unauthorized', public readonly sessionExpired = true) {
    super(message);
  }
}

export const SESSION_EXPIRED_EVENT = 'subm:session-expired';

export const authHeaderOnly = (): Record<string, string> => ({});

export const authJsonHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
});

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const resp = await fetch(input, { credentials: 'include', ...init });
  if (resp.status === 401) {
    const payload = await resp.clone().json().catch(() => ({} as Record<string, unknown>));
    const message = typeof payload?.message === 'string' ? payload.message : 'unauthorized';
    const sessionExpired = message === 'Missing token' || message === 'Invalid token' || message === 'unauthorized';
    if (sessionExpired && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new UnauthorizedError(message, sessionExpired);
  }
  return resp;
};

export const apiFetchJson = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> => {
  const resp = await apiFetch(input, init);
  const json = await resp.json().catch(() => ({} as any));
  if (!resp.ok) {
    const message = (json as any)?.message || `http_${resp.status}`;
    throw new Error(message);
  }
  return json as T;
};
