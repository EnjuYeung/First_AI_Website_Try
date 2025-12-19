import { useState, useEffect, useCallback, useRef } from 'react';
import { Subscription, AppSettings, NotificationRecord } from '../types';
import { fetchAllData, saveAllData, getDefaultSettings } from '../services/storageService';
import { getT } from '../services/i18n';
import { UnauthorizedError } from '../services/apiClient';

export const useAppData = (isAuthenticated: boolean, onUnauthorized?: () => void) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const onUnauthorizedRef = useRef<(() => void) | undefined>(onUnauthorized);

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

  const persistData = async (partial?: { subscriptions?: Subscription[]; settings?: AppSettings; notifications?: NotificationRecord[] }) => {
    const payload = {
      subscriptions: partial?.subscriptions ?? subscriptions,
      settings: partial?.settings ?? settings,
      notifications: partial?.notifications ?? notifications
    };
    try {
      await saveAllData(payload);
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorizedRef.current?.();
      else console.error('Failed to persist data', err);
    }
  };

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    void persistData({ settings: newSettings });
  };

  const saveSubscription = (sub: Subscription, isEditing: boolean) => {
    let updated: Subscription[];
    if (isEditing) {
      updated = subscriptions.map(s => s.id === sub.id ? sub : s);
    } else {
      updated = [...subscriptions, sub];
    }
    setSubscriptions(updated);
    void persistData({ subscriptions: updated });
  };

  const deleteSubscription = (id: string) => {
     if (window.confirm(t('confirm_delete'))) {
      const updated = subscriptions.filter(s => s.id !== id);
      setSubscriptions(updated);
      void persistData({ subscriptions: updated });
    }
  };

  const batchDeleteSubscriptions = (ids: string[]) => {
    const message = t('confirm_batch_delete').replace('{count}', ids.length.toString());
    if (window.confirm(message)) {
      const updated = subscriptions.filter(s => !ids.includes(s.id));
      setSubscriptions(updated);
      void persistData({ subscriptions: updated });
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
    void persistData({ subscriptions: updated });
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
    duplicateSubscription
  };
};
