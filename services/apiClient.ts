export class UnauthorizedError extends Error {
  name = 'UnauthorizedError';
}

const AUTH_TOKEN_KEY = 'auth_token';

const canUseLocalStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const notifyAuthChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('auth:changed'));
};

export const getAuthToken = (): string | null => {
  if (!canUseLocalStorage()) return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setAuthToken = (token: string) => {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  notifyAuthChanged();
};

export const clearAuthToken = () => {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  notifyAuthChanged();
};

export const authHeaderOnly = (): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export const authJsonHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...authHeaderOnly(),
});

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const resp = await fetch(input, init);
  if (resp.status === 401) {
    clearAuthToken();
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

