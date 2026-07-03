import fs from 'fs/promises';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import path from 'path';
import { parseLocalYMD } from './dates.js';

import {
  CREDENTIALS_FILE,
  DATA_DIR,
  UPLOADS_DIR,
  USERS_DIR,
  userDataPath,
  userFeatureDir,
  userFeaturePath,
} from './storagePaths.js';
import { defaultSettings, defaultUserData } from './defaults.js';
import { DEFAULT_RULE_CHANNELS } from '../../shared/constants.js';
import {
  DEFAULT_REMINDER_TEMPLATE_STRING,
  normalizeReminderTemplateString,
} from '../../shared/reminderTemplate.js';

const PREVIOUS_REMINDER_TEMPLATE_STRING = JSON.stringify(
  {
    lines: [
      '🔔 续订提醒通知',
      '',
      '📌 订阅 {{name}} 即将续费',
      '',
      '📅 付款日期：{{nextBillingDate}}',
      '🔒 订阅金额：{{price}} {{currency}}',
      '💳 支付方式：{{paymentMethod}}',
      '',
      '⚠️ 请及时续订以避免服务中断。',
    ],
  },
  null,
  2
);

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
};

const atomicWriteJson = async (filePath, data) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.chmod(path.dirname(filePath), 0o700);
  const tmpPath = `${filePath}.tmp-${crypto.randomUUID()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
  await fs.rename(tmpPath, filePath);
  await fs.chmod(filePath, 0o600);
};

const pendingWrites = new Map();

const waitForPendingWrite = async (key) => {
  const pending = pendingWrites.get(key);
  if (!pending) return;
  try {
    await pending;
  } catch {
    // ignore write failure for waiters
  }
};

const queueWrite = async (key, writeFn) => {
  const previous = pendingWrites.get(key) || Promise.resolve();
  const next = previous.then(writeFn, writeFn);
  const tracked = next.finally(() => {
    if (pendingWrites.get(key) === tracked) pendingWrites.delete(key);
  });
  pendingWrites.set(key, tracked);
  return tracked;
};

export const ensureDataDir = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(UPLOADS_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(USERS_DIR, { recursive: true, mode: 0o700 });
  await Promise.all([DATA_DIR, UPLOADS_DIR, USERS_DIR].map((dir) => fs.chmod(dir, 0o700)));
};

const mergeSettings = (incoming) => {
  const parsed = incoming || {};
  const base = defaultSettings();

  if ('aiConfig' in parsed) delete parsed.aiConfig;

  const exchangeRateApi = {
    ...base.exchangeRateApi,
    ...(parsed.exchangeRateApi || {}),
  };

  const parsedRules = parsed.notifications?.rules || {};
  const parsedTemplate = parsedRules.template;
  const template =
    !parsedTemplate ||
    parsedTemplate === DEFAULT_REMINDER_TEMPLATE_STRING ||
    parsedTemplate === PREVIOUS_REMINDER_TEMPLATE_STRING
      ? DEFAULT_REMINDER_TEMPLATE_STRING
      : normalizeReminderTemplateString(parsedTemplate);

  const rules = {
    renewalReminder:
      parsedRules.renewalReminder !== undefined
        ? parsedRules.renewalReminder
        : base.notifications.rules.renewalReminder,
    reminderDays: parsedRules.reminderDays ?? base.notifications.rules.reminderDays,
    template,
    channels: {
      ...DEFAULT_RULE_CHANNELS,
      ...(parsedRules.channels || {}),
    },
  };

  return {
    ...base,
    ...parsed,
    exchangeRateApi,
    security: { ...base.security, ...(parsed.security || {}) },
    notifications: {
      telegram: {
        ...base.notifications.telegram,
        ...(parsed.notifications?.telegram || {}),
      },
      email: {
        ...base.notifications.email,
        ...(parsed.notifications?.email || {}),
      },
      rules,
    },
  };
};

const resolveSubscriptionForNotification = (subscriptions, record) => {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  const subId = record?.details?.subscriptionId;
  if (subId) {
    const byId = list.find((sub) => sub?.id === subId);
    if (byId) return byId;
  }
  const name = record?.subscriptionName;
  if (!name) return null;
  return list.find((sub) => sub?.name === name) || null;
};

const isPastDate = (ymd) => {
  const date = parseLocalYMD(ymd);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const normalizeNotifications = (incoming, subscriptions) => {
  const list = Array.isArray(incoming) ? incoming : [];
  const retentionCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const filtered = list.filter(
    (record) =>
      record?.type !== 'subscription_change' &&
      typeof record?.timestamp === 'number' &&
      record.timestamp >= retentionCutoff
  );
  return filtered.map((record) => {
    if (!record || typeof record !== 'object') return record;
    const details =
      record.details && typeof record.details === 'object' ? record.details : {};
    let nextDetails = details;
    if (record.type === 'renewal_reminder') {
      if (details !== record.details) {
        nextDetails = { ...nextDetails };
      }
      const feedback = String(details.renewalFeedback || '').trim();
      const needsBackfill = !feedback || feedback === 'pending' || feedback === '未确定';
      if (needsBackfill && isPastDate(details.date)) {
        const sub = resolveSubscriptionForNotification(subscriptions, record);
        if (sub?.status === 'active') {
          nextDetails = { ...nextDetails, renewalFeedback: 'renewed' };
        } else if (sub?.status === 'cancelled') {
          nextDetails = { ...nextDetails, renewalFeedback: 'deprecated' };
        }
      }
      if (!feedback && !nextDetails.renewalFeedback) {
        nextDetails = { ...nextDetails, renewalFeedback: 'pending' };
      }
    } else if (details !== record.details) {
      nextDetails = { ...details };
    }
    if (nextDetails.receiver !== undefined) {
      const { receiver, ...rest } = nextDetails;
      nextDetails = rest;
    }
    if (nextDetails.frequency !== undefined) {
      const { frequency, ...rest } = nextDetails;
      nextDetails = rest;
    }
    if (nextDetails !== record.details) {
      return { ...record, details: nextDetails };
    }
    return record;
  });
};

export const createStorage = ({ adminUser, adminPass }) => {
  const FEATURES = ['subscriptions', 'notifications', 'settings'];
  const migratedUsers = new Set();
  const featureCache = new Map();
  const featureDefault = (feature) => defaultUserData()[feature];
  const makeDocument = (data, revision = 1) => ({
    schemaVersion: 1,
    revision,
    updatedAt: new Date().toISOString(),
    data,
  });
  const featureCacheKey = (username, feature) => `${username}\0${feature}`;
  const getCachedDocument = (username, feature) => {
    const cached = featureCache.get(featureCacheKey(username, feature));
    return cached ? structuredClone(cached) : null;
  };
  const setCachedDocument = (username, feature, document) => {
    featureCache.set(featureCacheKey(username, feature), structuredClone(document));
  };

  const normalizeFeature = (feature, value, subscriptions = []) => {
    if (feature === 'subscriptions') return Array.isArray(value) ? value : [];
    if (feature === 'notifications') return normalizeNotifications(value, subscriptions);
    if (feature === 'settings') return mergeSettings(value);
    throw new Error('unknown_storage_feature');
  };

  const ensureUserMigrated = async (username) => {
    if (migratedUsers.has(username)) return;
    await ensureDataDir();
    const migrationKey = `migration:${username}`;
    await queueWrite(migrationKey, async () => {
      const paths = FEATURES.map((feature) => userFeaturePath(username, feature));
      const existing = await Promise.all(
        paths.map((filePath) => fs.access(filePath).then(() => true).catch(() => false))
      );
      if (existing.every(Boolean)) return;

      let legacy = null;
      try {
        legacy = await readJson(userDataPath(username));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      const initial = legacy || defaultUserData();
      const subscriptions = normalizeFeature('subscriptions', initial.subscriptions);
      const values = {
        subscriptions,
        notifications: normalizeFeature('notifications', initial.notifications, subscriptions),
        settings: normalizeFeature('settings', initial.settings),
      };
      await fs.mkdir(userFeatureDir(username), { recursive: true, mode: 0o700 });
      await fs.chmod(userFeatureDir(username), 0o700);
      for (let index = 0; index < FEATURES.length; index += 1) {
        if (!existing[index]) {
          const feature = FEATURES[index];
          const document = makeDocument(values[feature]);
          await atomicWriteJson(paths[index], document);
          setCachedDocument(username, feature, document);
        }
      }
      if (legacy) {
        await fs.unlink(userDataPath(username)).catch((err) => {
          if (err?.code !== 'ENOENT') throw err;
        });
      }
    });
    migratedUsers.add(username);
  };

  const readFeatureDocument = async (username, feature) => {
    const cached = getCachedDocument(username, feature);
    if (cached) return cached;

    const filePath = userFeaturePath(username, feature);
    try {
      const document = await readJson(filePath);
      const data = normalizeFeature(feature, document.data);
      const normalizedDocument = {
        schemaVersion: 1,
        revision: Number.isInteger(document.revision) ? document.revision : 1,
        updatedAt: document.updatedAt || new Date(0).toISOString(),
        data,
      };
      setCachedDocument(username, feature, normalizedDocument);
      return structuredClone(normalizedDocument);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      const document = makeDocument(normalizeFeature(feature, featureDefault(feature)));
      await atomicWriteJson(filePath, document);
      setCachedDocument(username, feature, document);
      return structuredClone(document);
    }
  };

  const loadAllDocuments = async (username) => {
    await ensureUserMigrated(username);
    const subscriptionsDoc = await readFeatureDocument(username, 'subscriptions');
    const notificationsDoc = await readFeatureDocument(username, 'notifications');
    const settingsDoc = await readFeatureDocument(username, 'settings');
    const notifications = normalizeNotifications(notificationsDoc.data, subscriptionsDoc.data);
    if (JSON.stringify(notifications) !== JSON.stringify(notificationsDoc.data)) {
      notificationsDoc.data = notifications;
      notificationsDoc.revision += 1;
      notificationsDoc.updatedAt = new Date().toISOString();
      await atomicWriteJson(userFeaturePath(username, 'notifications'), notificationsDoc);
      setCachedDocument(username, 'notifications', notificationsDoc);
    }
    return { subscriptionsDoc, notificationsDoc, settingsDoc };
  };

  const loadCredentials = async () => {
    await ensureDataDir();
    await waitForPendingWrite(CREDENTIALS_FILE);
    try {
      const credentials = await readJson(CREDENTIALS_FILE);
      await fs.chmod(CREDENTIALS_FILE, 0o600);
      return credentials;
    } catch (err) {
      if (err.code === 'ENOENT') {
        const passwordHash = bcrypt.hashSync(adminPass, 10);
        const creds = { username: adminUser, passwordHash, tokenVersion: 0 };
        await atomicWriteJson(CREDENTIALS_FILE, creds);
        return creds;
      }
      throw err;
    }
  };

  const saveCredentials = async (creds) => {
    await ensureDataDir();
    await queueWrite(CREDENTIALS_FILE, () => atomicWriteJson(CREDENTIALS_FILE, creds));
  };

  const loadUserData = async (username) => {
    await ensureUserMigrated(username);
    return queueWrite(`user:${username}`, async () => {
      const { subscriptionsDoc, notificationsDoc, settingsDoc } = await loadAllDocuments(username);
      return {
        subscriptions: subscriptionsDoc.data,
        notifications: notificationsDoc.data,
        settings: settingsDoc.data,
        revisions: {
          subscriptions: subscriptionsDoc.revision,
          notifications: notificationsDoc.revision,
          settings: settingsDoc.revision,
        },
      };
    });
  };

  const updateUserData = async (username, updater) => {
    await ensureUserMigrated(username);
    return queueWrite(`user:${username}`, async () => {
      const { subscriptionsDoc, notificationsDoc, settingsDoc } = await loadAllDocuments(username);
      const current = {
        subscriptions: structuredClone(subscriptionsDoc.data),
        notifications: structuredClone(notificationsDoc.data),
        settings: structuredClone(settingsDoc.data),
      };
      const updated = (await updater(current)) || current;
      const next = {
        subscriptions: normalizeFeature('subscriptions', updated.subscriptions),
        notifications: normalizeFeature(
          'notifications',
          updated.notifications,
          updated.subscriptions
        ),
        settings: normalizeFeature('settings', updated.settings),
      };
      const documents = { subscriptions: subscriptionsDoc, notifications: notificationsDoc, settings: settingsDoc };
      for (const feature of FEATURES) {
        if (JSON.stringify(documents[feature].data) === JSON.stringify(next[feature])) continue;
        documents[feature] = makeDocument(next[feature], documents[feature].revision + 1);
        await atomicWriteJson(userFeaturePath(username, feature), documents[feature]);
        setCachedDocument(username, feature, documents[feature]);
      }
      return {
        ...next,
        revisions: Object.fromEntries(FEATURES.map((feature) => [feature, documents[feature].revision])),
      };
    });
  };

  const updateUserFeature = async (username, feature, expectedRevision, updater) => {
    if (!FEATURES.includes(feature)) throw new Error('unknown_storage_feature');
    await ensureUserMigrated(username);
    return queueWrite(`user:${username}`, async () => {
      const subscriptionsDoc = await readFeatureDocument(username, 'subscriptions');
      const document =
        feature === 'subscriptions'
          ? subscriptionsDoc
          : await readFeatureDocument(username, feature);
      if (!Number.isInteger(expectedRevision)) {
        const error = new Error('precondition_required');
        error.statusCode = 428;
        throw error;
      }
      if (document.revision !== expectedRevision) {
        const error = new Error('revision_conflict');
        error.statusCode = 409;
        error.currentRevision = document.revision;
        throw error;
      }
      const updated = await updater(structuredClone(document.data));
      const subscriptions = feature === 'subscriptions' ? updated : subscriptionsDoc.data;
      const data = normalizeFeature(feature, updated, subscriptions);
      const nextDocument = makeDocument(data, document.revision + 1);
      await atomicWriteJson(userFeaturePath(username, feature), nextDocument);
      setCachedDocument(username, feature, nextDocument);
      return { data, revision: nextDocument.revision };
    });
  };

  return {
    ensureDataDir,
    loadCredentials,
    saveCredentials,
    loadUserData,
    updateUserData,
    updateUserFeature,
  };
};
