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
  const onUnauthorizedRef = useRef<(() => void) | undefined>(onUnauthorized);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const revisionsRef = useRef<DataRevisions>({ subscriptions: 0, settings: 0, notifications: 0 });
  const isLoadingRef = useRef(false);
  const lastLoadedAtRef = useRef(0);

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
      setSubscriptions(data.subscriptions);
      setSettings(data.settings);
      setNotifications(data.notifications || []);
      revisionsRef.current = data.revisions;
      lastLoadedAtRef.current = Date.now();
      return { ok: true };
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorizedRef.current?.();
      }
      console.error('Failed to load data', err);
      return { ok: false, error: err };
    } finally {
      isLoadingRef.current = false;
      setIsDataLoading(false);
    }
  }, [isAuthenticated]);

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
    const save = async () => {
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
        apply(result.data);
      } catch (err) {
        if (err instanceof UnauthorizedError) onUnauthorizedRef.current?.();
        else {
          console.error('Failed to persist data', err);
          // Do not call loadRemoteData here: this save is itself part of the
          // queue that loadRemoteData waits for.
          await fetchRemoteData();
        }
      }
    };
    saveQueueRef.current = saveQueueRef.current.then(save, save);
    return saveQueueRef.current;
  };

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    void persistFeature('settings', (revision) => replaceSettings(newSettings, revision), setSettings);
  };

  const saveSubscription = (sub: Subscription, isEditing: boolean) => {
    let updated: Subscription[];
    if (isEditing) {
      updated = subscriptions.map(s => s.id === sub.id ? sub : s);
    } else {
      updated = [...subscriptions, sub];
    }
    setSubscriptions(updated);
    void persistFeature(
      'subscriptions',
      (revision) => isEditing
        ? updateSubscription(sub, revision)
        : createSubscription(sub, revision),
      setSubscriptions
    );
  };

  const deleteSubscription = (id: string) => {
     if (window.confirm(t('confirm_delete'))) {
      const updated = subscriptions.filter(s => s.id !== id);
      setSubscriptions(updated);
      void persistFeature('subscriptions', (revision) => removeSubscription(id, revision), setSubscriptions);
    }
  };

  const batchDeleteSubscriptions = (ids: string[]) => {
    const message = t('confirm_batch_delete').replace('{count}', ids.length.toString());
    if (window.confirm(message)) {
      const updated = subscriptions.filter(s => !ids.includes(s.id));
      setSubscriptions(updated);
      void persistFeature('subscriptions', (revision) => removeSubscriptions(ids, revision), setSubscriptions);
    }
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

    const updated = [...subscriptions, newSub];
    setSubscriptions(updated);
    void persistFeature('subscriptions', (revision) => createSubscription(newSub, revision), setSubscriptions);
  };

  const deleteNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    void persistFeature('notifications', (revision) => removeNotification(id, revision), setNotifications);
  };

  const clearNotifications = () => {
    setNotifications([]);
    void persistFeature('notifications', clearNotificationHistory, setNotifications);
  };

  return {
    subscriptions,
    settings,
    notifications,
    isDataLoading,
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
