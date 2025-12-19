export class UnauthorizedError extends Error {
  name = 'UnauthorizedError';
}

export const authHeaderOnly = (): Record<string, string> => ({});

export const authJsonHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
});

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const resp = await fetch(input, { credentials: 'include', ...init });
  if (resp.status === 401) {
    throw new UnauthorizedError('unauthorized');
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

