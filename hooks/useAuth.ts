import { useCallback, useEffect, useState } from 'react';
import { apiFetchJson, authHeaderOnly, clearAuthToken, getAuthToken, setAuthToken, UnauthorizedError } from '../services/apiClient';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const syncFromStorage = () => {
      if (cancelled) return;
      setIsAuthenticated(!!getAuthToken());
    };

    const init = async () => {
      const token = getAuthToken();
      if (!token) {
        syncFromStorage();
        setIsLoadingAuth(false);
        return;
      }

      try {
        await apiFetchJson('/api/me', { headers: authHeaderOnly() });
        syncFromStorage();
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          clearAuthToken();
        }
        syncFromStorage();
      } finally {
        if (!cancelled) setIsLoadingAuth(false);
      }
    };

    init();

    window.addEventListener('auth:changed', syncFromStorage as EventListener);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('auth:changed', syncFromStorage as EventListener);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const login = useCallback((token: string) => {
    setAuthToken(token);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setIsAuthenticated(false);
  }, []);

  return { isAuthenticated, isLoadingAuth, login, logout };
};
