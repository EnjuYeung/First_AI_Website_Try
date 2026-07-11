import { useState, useEffect, useCallback, useRef } from 'react';
import { Subscription, AppSettings, NotificationRecord } from '../types';
import {
  clearNotificationHistory,
  createSubscription,
  DataRevisions,
  fetchAllData,
  getDefaultSettings,
  removeNotification,
  removeSubscription,
  removeSubscriptions,
  replaceSettings,
  RevisionConflictError,
  updateSubscription,
} from '../services/storageService';
import { getT } from '../services/i18n';
import { UnauthorizedError } from '../services/apiClient';

const FOCUS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export type DataRefreshResult =
  | { ok: true }
  | { ok: false; error: unknown };

export const useAppData = (
  isAuthenticated: boolean,
  onUnauthorized?: () => void,
  language: AppSettings['language'] = 'zh'
) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [lastMutationError, setLastMutationError] = useState<unknown>(null);
  const onUnauthorizedRef = useRef<(() => void) | undefined>(onUnauthorized);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const revisionsRef = useRef<DataRevisions>({ subscriptions: 0, settings: 0, notifications: 0 });
  const mutationVersionsRef = useRef<DataRevisions>({ subscriptions: 0, settings: 0, notifications: 0 });
  const subscriptionsRef = useRef<Subscription[]>(subscriptions);
  const settingsRef = useRef<AppSettings>(settings);
  const notificationsRef = useRef<NotificationRecord[]>(notifications);
  const isLoadingRef = useRef(false);
  const lastLoadedAtRef = useRef(0);

  const applySubscriptions = useCallback((value: Subscription[]) => {
    subscriptionsRef.current = value;
    setSubscriptions(value);
  }, []);
  const applySettings = useCallback((value: AppSettings) => {
    settingsRef.current = value;
    setSettings(value);
  }, []);
  const applyNotifications = useCallback((value: NotificationRecord[]) => {
    notificationsRef.current = value;
    setNotifications(value);
  }, []);

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const t = getT(language);

  const fetchRemoteData = useCallback(async (): Promise<DataRefreshResult> => {
    if (!isAuthenticated) return { ok: false, error: new Error('not_authenticated') };
    if (isLoadingRef.current) return { ok: false, error: new Error('refresh_in_progress') };
    isLoadingRef.current = true;
    setIsDataLoading(true);
    try {
      const data = await fetchAllData();
      applySubscriptions(data.subscriptions);
      applySettings(data.settings);
      applyNotifications(data.notifications || []);
      revisionsRef.current = data.revisions;
      lastLoadedAtRef.current = Date.now();
      return { ok: true };
    } catch (err) {
      if (err instanceof UnauthorizedError && err.sessionExpired) {
        onUnauthorizedRef.current?.();
      }
      console.error('Failed to load data', err);
      return { ok: false, error: err };
    } finally {
      isLoadingRef.current = false;
      setIsDataLoading(false);
    }
  }, [isAuthenticated, applyNotifications, applySettings, applySubscriptions]);

  const loadRemoteData = useCallback(async (): Promise<DataRefreshResult> => {
    // A refresh must not replace an optimistic local update with the older
    // server snapshot while that update is still being persisted.
    await saveQueueRef.current;
    return fetchRemoteData();
  }, [fetchRemoteData]);

  useEffect(() => {
    void loadRemoteData();
  }, [loadRemoteData]);

  useEffect(() => {
    if (!isAuthenticated) {
      lastLoadedAtRef.current = 0;
      return;
    }

    const refreshIfStale = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastLoadedAtRef.current < FOCUS_REFRESH_INTERVAL_MS) return;
      void loadRemoteData();
    };

    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [isAuthenticated, loadRemoteData]);

  const persistFeature = <K extends keyof DataRevisions, T>(
    feature: K,
    operation: (revision: number) => Promise<{ data: T; revision: number }>,
    apply: (data: T) => void
  ) => {
    const mutationVersion = mutationVersionsRef.current[feature] + 1;
    mutationVersionsRef.current = {
      ...mutationVersionsRef.current,
      [feature]: mutationVersion,
    };

    const save = async (): Promise<boolean> => {
      try {
        let result: { data: T; revision: number };
        try {
          result = await operation(revisionsRef.current[feature]);
        } catch (err) {
          if (!(err instanceof RevisionConflictError)) throw err;

          // Settings can also be changed by server-side tasks such as exchange
          // rate refreshes. Refresh the revisions and retry the user's pending
          // mutation once instead of discarding the optimistic local value.
          if (err.currentRevision !== undefined) {
            revisionsRef.current = {
              ...revisionsRef.current,
              [feature]: err.currentRevision,
            };
          } else {
            const latest = await fetchAllData();
            revisionsRef.current = latest.revisions;
          }
          result = await operation(revisionsRef.current[feature]);
        }
        revisionsRef.current = { ...revisionsRef.current, [feature]: result.revision };
        if (mutationVersionsRef.current[feature] === mutationVersion) {
          apply(result.data);
        }
        return true;
      } catch (err) {
        setLastMutationError(err);
        if (err instanceof UnauthorizedError && err.sessionExpired) {
          onUnauthorizedRef.current?.();
        } else {
          console.error('Failed to persist data', err);
          // Reconcile only the failed feature. Refreshing all state here could
          // overwrite optimistic changes queued for another feature.
          try {
            const latest = await fetchAllData();
            revisionsRef.current = latest.revisions;
            if (mutationVersionsRef.current[feature] === mutationVersion) {
              if (feature === 'subscriptions') apply(latest.subscriptions as T);
              else if (feature === 'settings') apply(latest.settings as T);
              else apply((latest.notifications || []) as T);
            }
          } catch (refreshError) {
            console.error('Failed to reconcile data after save failure', refreshError);
          }
        }
        return false;
      }
    };
    const result = saveQueueRef.current.then(save, save);
    saveQueueRef.current = result.then(() => undefined, () => undefined);
    return result;
  };

  const updateSettings = (newSettings: AppSettings) => {
    applySettings(newSettings);
    return persistFeature('settings', (revision) => replaceSettings(newSettings, revision), applySettings);
  };

  const saveSubscription = (sub: Subscription, isEditing: boolean) => {
    let updated: Subscription[];
    if (isEditing) {
      updated = subscriptionsRef.current.map(s => s.id === sub.id ? sub : s);
    } else {
      updated = [...subscriptionsRef.current, sub];
    }
    applySubscriptions(updated);
    return persistFeature(
      'subscriptions',
      (revision) => isEditing
        ? updateSubscription(sub, revision)
        : createSubscription(sub, revision),
      applySubscriptions
    );
  };

  const deleteSubscription = (id: string) => {
     if (window.confirm(t('confirm_delete'))) {
      const updated = subscriptionsRef.current.filter(s => s.id !== id);
      applySubscriptions(updated);
      return persistFeature('subscriptions', (revision) => removeSubscription(id, revision), applySubscriptions);
    }
    return Promise.resolve(false);
  };

  const batchDeleteSubscriptions = (ids: string[]) => {
    const message = t('confirm_batch_delete').replace('{count}', ids.length.toString());
    if (window.confirm(message)) {
      const updated = subscriptionsRef.current.filter(s => !ids.includes(s.id));
      applySubscriptions(updated);
      return persistFeature('subscriptions', (revision) => removeSubscriptions(ids, revision), applySubscriptions);
    }
    return Promise.resolve(false);
  };

  const duplicateSubscription = (sub: Subscription) => {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    const prefix = t('copy_prefix');
    const suffix = t('copy_suffix');
    const newName = `${prefix}${sub.name}${suffix}`;

    const newSub: Subscription = {
      ...sub,
      id: newId,
      name: newName,
    };

    const updated = [...subscriptionsRef.current, newSub];
    applySubscriptions(updated);
    return persistFeature('subscriptions', (revision) => createSubscription(newSub, revision), applySubscriptions);
  };

  const deleteNotification = (id: string) => {
    const updated = notificationsRef.current.filter(n => n.id !== id);
    applyNotifications(updated);
    return persistFeature('notifications', (revision) => removeNotification(id, revision), applyNotifications);
  };

  const clearNotifications = () => {
    applyNotifications([]);
    return persistFeature('notifications', clearNotificationHistory, applyNotifications);
  };

  return {
    subscriptions,
    settings,
    notifications,
    isDataLoading,
    lastMutationError,
    clearMutationError: () => setLastMutationError(null),
    loadRemoteData,
    updateSettings,
    saveSubscription,
    deleteSubscription,
    batchDeleteSubscriptions,
    duplicateSubscription,
    deleteNotification,
    clearNotifications
  };
};
