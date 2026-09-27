import { applyEditableSettings } from '../shared/settingsOwnership.js';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Subscription, AppSettings, RemoteSettings, EditableSettingsPatch, ServerSettingsUpdate, NotificationRecord, ServerClock } from '../types';
import {
  createSubscription,
  DataRevisions,
  fetchAllData,
  getDefaultRemoteSettings,
  removeSubscription,
  removeSubscriptions,
  updateSettingsFields,
  RevisionConflictError,
  updateSubscription,
} from '../services/storageService';
import { getT } from '../services/i18n';
import { newId } from '../services/ids';
import { UnauthorizedError } from '../services/apiClient';
import { getTodayYMD } from '../services/dateUtils';
import { rollForwardActiveSubscriptions } from '../shared/billingDate.js';

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
  const [settings, setSettings] = useState<RemoteSettings>(getDefaultRemoteSettings());
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [serverClock, setServerClock] = useState<ServerClock>(() => {
    const now = Date.now();
    return { serverTimeMs: now, receivedAtMs: now };
  });
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const conflictEpochRef = useRef({ subscriptions: 0, settings: 0, notifications: 0 });
  const [lastMutationError, setLastMutationError] = useState<unknown>(null);
  const onUnauthorizedRef = useRef<(() => void) | undefined>(onUnauthorized);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const revisionsRef = useRef<DataRevisions>({ subscriptions: 0, settings: 0, notifications: 0 });
  const mutationVersionsRef = useRef<DataRevisions>({ subscriptions: 0, settings: 0, notifications: 0 });
  const pendingMutationsRef = useRef<DataRevisions>({ subscriptions: 0, settings: 0, notifications: 0 });
  const subscriptionsRef = useRef<Subscription[]>(subscriptions);
  const settingsRef = useRef<RemoteSettings>(settings);
  const serverClockRef = useRef(serverClock);
  const isLoadingRef = useRef(false);
  const refreshRequestedRef = useRef(false);
  const lastLoadedAtRef = useRef(0);

  const applySubscriptions = useCallback((value: Subscription[]) => {
    const clock = serverClockRef.current;
    const now = new Date(clock.serverTimeMs + Math.max(0, Date.now() - clock.receivedAtMs));
    const rolled = rollForwardActiveSubscriptions(
      value,
      getTodayYMD(settingsRef.current.timezone, now),
    );
    subscriptionsRef.current = rolled;
    setSubscriptions(rolled);
  }, []);
  const applySettings = useCallback((value: RemoteSettings) => {
    settingsRef.current = value;
    setSettings(value);
  }, []);
  const applyNotifications = useCallback((value: NotificationRecord[]) => {
    setNotifications(value);
  }, []);

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const t = getT(language);

  const fetchRemoteData = useCallback(async (): Promise<DataRefreshResult> => {
    if (!isAuthenticated) return { ok: false, error: new Error('not_authenticated') };
    if (isLoadingRef.current) {
      refreshRequestedRef.current = true;
      return { ok: false, error: new Error('refresh_in_progress') };
    }
    isLoadingRef.current = true;
    setIsDataLoading(true);
    try {
      const versions = { ...mutationVersionsRef.current };
      const pendingAtStart = { ...pendingMutationsRef.current };
      const canApply = (feature: keyof DataRevisions) =>
        versions[feature] === mutationVersionsRef.current[feature] &&
        pendingAtStart[feature] === 0 && pendingMutationsRef.current[feature] === 0;
      const data = await fetchAllData();
      const receivedAtMs = Date.now();
      const nextClock = { serverTimeMs: data.serverTime, receivedAtMs };
      if (canApply('settings')) {
        applySettings(data.settings);
        revisionsRef.current.settings = data.revisions.settings;
      }
      serverClockRef.current = nextClock;
      setServerClock(nextClock);
      if (canApply('subscriptions')) {
        applySubscriptions(data.subscriptions);
        revisionsRef.current.subscriptions = data.revisions.subscriptions;
      }
      if (canApply('notifications')) {
        applyNotifications(data.notifications || []);
        revisionsRef.current.notifications = data.revisions.notifications;
      }
      setHasLoadedData(true);
      setLoadError(null);
      lastLoadedAtRef.current = Date.now();
      return { ok: true };
    } catch (err) {
      if (err instanceof UnauthorizedError && err.sessionExpired) {
        onUnauthorizedRef.current?.();
      }
      setLoadError(err);
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
    if (isDataLoading || !refreshRequestedRef.current) return;
    refreshRequestedRef.current = false;
    void loadRemoteData();
  }, [isDataLoading, loadRemoteData]);

  useEffect(() => {
    if (!isAuthenticated) {
      lastLoadedAtRef.current = 0;
      setHasLoadedData(false);
      return;
    }

    const refreshIfStale = () => {
      if (document.visibilityState === 'hidden') return;
      const previous = subscriptionsRef.current;
      applySubscriptions(previous);
      const rolledOverdue = subscriptionsRef.current !== previous;
      if (!rolledOverdue && Date.now() - lastLoadedAtRef.current < FOCUS_REFRESH_INTERVAL_MS) return;
      void loadRemoteData();
    };

    const currentDay = () => {
      const clock = serverClockRef.current;
      return getTodayYMD(settingsRef.current.timezone,
        new Date(clock.serverTimeMs + Math.max(0, Date.now() - clock.receivedAtMs)));
    };
    let previousDay = currentDay();
    const dayTimer = window.setInterval(() => {
      const day = currentDay();
      if (day === previousDay) return;
      previousDay = day;
      const clock = serverClockRef.current;
      const now = Date.now();
      const nextClock = { serverTimeMs: clock.serverTimeMs + Math.max(0, now - clock.receivedAtMs), receivedAtMs: now };
      serverClockRef.current = nextClock;
      setServerClock(nextClock);
      applySubscriptions(subscriptionsRef.current);
      void loadRemoteData();
    }, 30_000);
    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      window.clearInterval(dayTimer);
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [isAuthenticated, loadRemoteData, applySubscriptions]);

  const persistFeature = <K extends keyof DataRevisions, T>(
    feature: K,
    operation: (revision: number) => Promise<{ data: T; revision: number }>,
    apply: (data: T) => void
  ) => {
    pendingMutationsRef.current[feature] += 1;
    const conflictEpoch = conflictEpochRef.current[feature];
    const mutationVersion = mutationVersionsRef.current[feature] + 1;
    mutationVersionsRef.current = {
      ...mutationVersionsRef.current,
      [feature]: mutationVersion,
    };

    const save = async (): Promise<boolean> => {
      try {
        if (conflictEpochRef.current[feature] !== conflictEpoch) {
          throw new RevisionConflictError('revision_conflict', revisionsRef.current[feature]);
        }
        const result = await operation(revisionsRef.current[feature]);
        revisionsRef.current = { ...revisionsRef.current, [feature]: result.revision };
        if (mutationVersionsRef.current[feature] === mutationVersion) {
          apply(result.data);
        }
        return true;
      } catch (err) {
        if (err instanceof RevisionConflictError) conflictEpochRef.current[feature] += 1;
        setLastMutationError(err);
        if (err instanceof UnauthorizedError && err.sessionExpired) {
          onUnauthorizedRef.current?.();
        } else {
          console.error('Failed to persist data', err);
          // Reconcile only the failed feature. Refreshing all state here could
          // overwrite optimistic changes queued for another feature.
          try {
            const latest = await fetchAllData();
            revisionsRef.current[feature] = latest.revisions[feature];
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
      } finally {
        pendingMutationsRef.current[feature] -= 1;
      }
    };
    const result = saveQueueRef.current.then(save, save);
    saveQueueRef.current = result.then(() => undefined, () => undefined);
    return result;
  };

  const applyRemoteSettings = ({ state, revision }: ServerSettingsUpdate) => {
    // An older dedicated response must not move the shared revision backwards.
    if (revision !== undefined && revision < revisionsRef.current.settings) return;
    mutationVersionsRef.current.settings += 1;
    if (state) applySettings({ ...settingsRef.current, ...state });
    // A state-only response cannot authorize queued editable snapshots at a newer
    // revision. Reconcile after the queue instead of upgrading those writes.
    if (revision !== undefined && pendingMutationsRef.current.settings === 0) {
      revisionsRef.current.settings = revision;
    }
    void loadRemoteData();
  };

  const updateSettings = (patch: EditableSettingsPatch) => {
    applySettings(applyEditableSettings(settingsRef.current, patch));
    return persistFeature('settings', (revision) => updateSettingsFields(patch, revision), applySettings);
  };

  const saveSubscription = (sub: Subscription, isEditing: boolean) => {
    const clock = serverClockRef.current;
    const now = new Date(clock.serverTimeMs + Math.max(0, Date.now() - clock.receivedAtMs));
    const toSave = rollForwardActiveSubscriptions(
      [sub],
      getTodayYMD(settingsRef.current.timezone, now),
    )[0] || sub;
    let updated: Subscription[];
    if (isEditing) {
      updated = subscriptionsRef.current.map(s => s.id === toSave.id ? toSave : s);
    } else {
      updated = [...subscriptionsRef.current, toSave];
    }
    applySubscriptions(updated);
    return persistFeature(
      'subscriptions',
      (revision) => isEditing
        ? updateSubscription(toSave, revision)
        : createSubscription(toSave, revision),
      applySubscriptions
    );
  };

  const deleteSubscription = (id: string) => {
    const updated = subscriptionsRef.current.filter(s => s.id !== id);
    applySubscriptions(updated);
    return persistFeature('subscriptions', (revision) => removeSubscription(id, revision), applySubscriptions);
  };

  const batchDeleteSubscriptions = (ids: string[]) => {
    const updated = subscriptionsRef.current.filter(s => !ids.includes(s.id));
    applySubscriptions(updated);
    return persistFeature('subscriptions', (revision) => removeSubscriptions(ids, revision), applySubscriptions);
  };

  const duplicateSubscription = (sub: Subscription) => {
    const prefix = t('copy_prefix');
    const suffix = t('copy_suffix');
    const newName = `${prefix}${sub.name}${suffix}`;

    const newSub: Subscription = {
      ...sub,
      id: newId(),
      name: newName,
    };

    const updated = [...subscriptionsRef.current, newSub];
    applySubscriptions(updated);
    return persistFeature('subscriptions', (revision) => createSubscription(newSub, revision), applySubscriptions);
  };

  return {
    subscriptions,
    settings,
    notifications,
    serverClock,
    isDataLoading,
    loadError,
    hasLoadedData,
    lastMutationError,
    clearMutationError: () => setLastMutationError(null),
    loadRemoteData,
    applyRemoteSettings,
    updateSettings,
    saveSubscription,
    deleteSubscription,
    batchDeleteSubscriptions,
    duplicateSubscription
  };
};
