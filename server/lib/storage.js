import fs from 'fs/promises';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import path from 'path';

import {
  CREDENTIALS_FILE,
  DATA_DIR,
  UPLOADS_DIR,
  userDataPath,
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
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${crypto.randomUUID()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
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
  pendingWrites.set(
    key,
    next.finally(() => {
      if (pendingWrites.get(key) === next) pendingWrites.delete(key);
    })
  );
  return next;
};

export const ensureDataDir = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
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
      ...base.notifications,
      ...(parsed.notifications || {}),
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

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isPastDate = (ymd) => {
  if (!ymd) return false;
  const match = YMD_RE.exec(String(ymd).trim());
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const normalizeNotifications = (incoming, subscriptions) => {
  const list = Array.isArray(incoming) ? incoming : [];
  const filtered = list.filter((record) => record?.type !== 'subscription_change');
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
  const loadCredentials = async () => {
    await ensureDataDir();
    await waitForPendingWrite(CREDENTIALS_FILE);
    try {
      return await readJson(CREDENTIALS_FILE);
    } catch {
      const passwordHash = bcrypt.hashSync(adminPass, 10);
      const creds = { username: adminUser, passwordHash };
      await atomicWriteJson(CREDENTIALS_FILE, creds);
      return creds;
    }
  };

  const saveCredentials = async (creds) => {
    await ensureDataDir();
    await queueWrite(CREDENTIALS_FILE, () => atomicWriteJson(CREDENTIALS_FILE, creds));
  };

  const loadUserData = async (username) => {
    await ensureDataDir();
    const filePath = userDataPath(username);
    await waitForPendingWrite(filePath);
    try {
      const parsed = await readJson(filePath);
      const settings = mergeSettings(parsed.settings);
      const notifications = normalizeNotifications(parsed.notifications || [], parsed.subscriptions || []);
      return {
        subscriptions: parsed.subscriptions || [],
        notifications,
        settings,
      };
    } catch {
      const initial = defaultUserData();
      await atomicWriteJson(userDataPath(username), initial);
      return initial;
    }
  };

  const saveUserData = async (username, data) => {
    await ensureDataDir();
    const settings = mergeSettings(data.settings);
    const notifications = normalizeNotifications(data.notifications || [], data.subscriptions || []);
    const payload = {
      subscriptions: data.subscriptions || [],
      notifications,
      settings,
    };
    const filePath = userDataPath(username);
    await queueWrite(filePath, () => atomicWriteJson(filePath, payload));
  };

  return {
    ensureDataDir,
    loadCredentials,
    saveCredentials,
    loadUserData,
    saveUserData,
  };
};
