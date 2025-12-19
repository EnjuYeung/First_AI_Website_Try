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

export const createStorage = ({ adminUser, adminPass }) => {
  const loadCredentials = async () => {
    await ensureDataDir();
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
    await atomicWriteJson(CREDENTIALS_FILE, creds);
  };

  const loadUserData = async (username) => {
    await ensureDataDir();
    try {
      const parsed = await readJson(userDataPath(username));
      const settings = mergeSettings(parsed.settings);
      return {
        subscriptions: parsed.subscriptions || [],
        notifications: parsed.notifications || [],
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
    const payload = {
      subscriptions: data.subscriptions || [],
      notifications: data.notifications || [],
      settings,
    };
    await atomicWriteJson(userDataPath(username), payload);
  };

  return {
    ensureDataDir,
    loadCredentials,
    saveCredentials,
    loadUserData,
    saveUserData,
  };
};
