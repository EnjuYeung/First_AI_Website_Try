import { useCallback, useEffect, useState } from 'react';
import { apiFetchJson, SESSION_EXPIRED_EVENT, UnauthorizedError } from '../services/apiClient';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await apiFetchJson('/api/me');
        if (!cancelled) setIsAuthenticated(true);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          if (!cancelled) setIsAuthenticated(false);
        } else if (!cancelled) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) setIsLoadingAuth(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => setIsAuthenticated(false);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const login = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetchJson('/api/logout', { method: 'POST' });
    } catch {
      // ignore logout failures
    } finally {
      setIsAuthenticated(false);
    }
  }, []);

  return { isAuthenticated, isLoadingAuth, login, logout };
};
