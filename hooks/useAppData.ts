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
  updateSubscription,
} from '../services/storageService';
import { getT } from '../services/i18n';
import { UnauthorizedError } from '../services/apiClient';

export const useAppData = (isAuthenticated: boolean, onUnauthorized?: () => void) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const onUnauthorizedRef = useRef<(() => void) | undefined>(onUnauthorized);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const revisionsRef = useRef<DataRevisions>({ subscriptions: 0, settings: 0, notifications: 0 });

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const t = getT(settings.language);

  const loadRemoteData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsDataLoading(true);
    try {
      const data = await fetchAllData();
      setSubscriptions(data.subscriptions);
      setSettings(data.settings);
      setNotifications(data.notifications || []);
      revisionsRef.current = data.revisions;
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorizedRef.current?.();
        return;
      }
      console.error('Failed to load data', err);
    } finally {
      setIsDataLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadRemoteData();
  }, [loadRemoteData]);

  const persistFeature = <K extends keyof DataRevisions, T>(
    feature: K,
    operation: (revision: number) => Promise<{ data: T; revision: number }>,
    apply: (data: T) => void
  ) => {
    const save = async () => {
      try {
        const result = await operation(revisionsRef.current[feature]);
        revisionsRef.current = { ...revisionsRef.current, [feature]: result.revision };
        apply(result.data);
      } catch (err) {
        if (err instanceof UnauthorizedError) onUnauthorizedRef.current?.();
        else {
          console.error('Failed to persist data', err);
          await loadRemoteData();
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
