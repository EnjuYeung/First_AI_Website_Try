import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import speakeasy from 'speakeasy';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Require critical secrets at startup to avoid weak defaults
const requireEnv = (name) => {
  const val = process.env[name];
  if (!val) {
    console.error(`[FATAL] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return val;
};

// Environment variables (can be overridden in deployment)
const ENV_ADMIN_USER = requireEnv('ADMIN_USER');
const ENV_ADMIN_PASS = requireEnv('ADMIN_PASS');
const JWT_SECRET = requireEnv('JWT_SECRET');
const PORT = process.env.PORT || 3001;
const NOTIFY_INTERVAL_MS = Number(process.env.NOTIFY_INTERVAL_MS || 10 * 60 * 1000); // default 10 minutes

// Default reminder templates (new + legacy) for layout upgrades
const PREVIOUS_REMINDER_TEMPLATE = JSON.stringify(
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
      '⚠️ 请及时续订以避免服务中断。'
    ]
  },
  null,
  2
);

const DEFAULT_REMINDER_TEMPLATE = JSON.stringify(
  {
    lines: [
      '🔔 续订提醒通知',
      '',
      '📌 订阅 {{name}} 即将续费',
      '',
      '📅 付款日期：{{nextBillingDate}}',
      '',
      '🔒 订阅金额：{{price}} {{currency}}',
      '💳 支付方式：{{paymentMethod}}',
      '',
      '⚠️ 请及时续订以避免服务中断。'
    ]
  },
  null,
  2
);

const DATA_DIR = path.join(__dirname, 'data');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');
const EXCHANGE_RATE_KEYPAIR_FILE = path.join(DATA_DIR, 'exchange-rate-keypair.json');
const DEFAULT_RULE_CHANNELS = {
  renewalReminder: ['telegram', 'email']
};

const buildInlineKeyboard = (subscriptionId) => ({
  inline_keyboard: [
    [
      { text: '✅ 已续订', callback_data: `renewed|${subscriptionId}` },
      { text: '🛑 已弃用', callback_data: `deprecated|${subscriptionId}` }
    ]
  ]
});

const smtpConfig = {
  host: process.env.SMTP_HOST || '',
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || ''
};

const hasSmtpConfig = !!(smtpConfig.host && smtpConfig.port && smtpConfig.user && smtpConfig.pass);

// Allow only specific origins
const allowedOrigins = [
  'https://subm.junziguozi.cc',
  'http://localhost:5173',
  'http://localhost:3000'
];

// --- ExchangeRate-API helpers ---
const readExchangeRateKeypair = async () => {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(EXCHANGE_RATE_KEYPAIR_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed?.publicKeyPem || !parsed?.privateKeyPem) throw new Error('invalid_keypair');
    return parsed;
  } catch (_err) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    const payload = { publicKeyPem: publicKey, privateKeyPem: privateKey };
    await fs.writeFile(EXCHANGE_RATE_KEYPAIR_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    return payload;
  }
};

const getExchangeRatePublicJwk = async () => {
  const { publicKeyPem } = await readExchangeRateKeypair();
  const keyObj = crypto.createPublicKey(publicKeyPem);
  return keyObj.export({ format: 'jwk' });
};

const decryptExchangeRateApiKey = async (encryptedKeyBase64) => {
  if (!encryptedKeyBase64) throw new Error('missing_encrypted_key');
  const { privateKeyPem } = await readExchangeRateKeypair();
  const buf = Buffer.from(encryptedKeyBase64, 'base64');
  const decrypted = crypto.privateDecrypt(
    { key: privateKeyPem, oaepHash: 'sha256' },
    buf
  );
  return decrypted.toString('utf-8');
};

const fetchUsdRatesFromExchangeRateApi = async (apiKey) => {
  const url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/USD`;
  const resp = await fetch(url, { method: 'GET' });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = json?.['error-type'] || json?.message || `exchange_rate_api_http_${resp.status}`;
    throw new Error(msg);
  }
  if (json?.result !== 'success' || !json?.conversion_rates) {
    const msg = json?.['error-type'] || 'exchange_rate_api_invalid_response';
    throw new Error(msg);
  }
  return json.conversion_rates;
};

const formatDateInTimeZone = (timeZone, date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const getTimePartsInTimeZone = (timeZone, date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { hour: Number(map.hour), minute: Number(map.minute) };
};

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, origin); // allow non-browser or health checks
      if (allowedOrigins.includes(origin)) return cb(null, origin);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

// Allow larger payloads because subscriptions can embed uploaded icon data URLs.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10mb' }));

// --- Defaults for user data ---
const defaultSettings = () => ({
  language: 'zh',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  theme: 'system',
  customCategories: [
    '娱乐',
    '生产力',
    '音乐',
    '视频',
    '云服务',
    '开发者工具',
    '教育',
    '健康',
    '游戏'
  ],
  customPaymentMethods: [
    '信用卡',
    '借记卡',
    'PayPal',
    'Apple Pay',
    'Google Pay',
    '微信支付',
    '支付宝',
    '银行卡自动扣款'
  ],
  customCurrencies: [
    { code: 'USD', name: 'US Dollar' },
    { code: 'CNY', name: 'Chinese Yuan' },
    { code: 'EUR', name: 'Euro' },
    { code: 'SGD', name: 'Singapore Dollar' }
  ],
  exchangeRates: {
    USD: 1,
    CNY: 7.2,
    EUR: 0.92,
    SGD: 1.34
  },
  lastRatesUpdate: 0,
  exchangeRateApi: {
    enabled: false,
    encryptedKey: '',
    lastTestedAt: 0,
    lastRunAt0: 0,
    lastRunAt12: 0
  },
  notifications: {
    telegram: { enabled: false, botToken: '', chatId: '' },
    email: { enabled: false, emailAddress: '' },
    rules: {
      renewalReminder: true,
      reminderDays: 3,
      channels: { ...DEFAULT_RULE_CHANNELS },
      template: DEFAULT_REMINDER_TEMPLATE
    },
    scheduledTask: false
  },
  security: {
    twoFactorEnabled: false,
    twoFactorSecret: '',
    pendingTwoFactorSecret: '',
    lastPasswordChange: new Date().toISOString()
  }
});

const defaultUserData = () => ({
  subscriptions: [],
  settings: defaultSettings(),
  notifications: []
});

// --- Helpers: file IO ---
const ensureDataDir = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
};

const loadCredentials = async () => {
  await ensureDataDir();
  try {
    const buf = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(buf);
  } catch (err) {
    const passwordHash = bcrypt.hashSync(ENV_ADMIN_PASS, 10);
    const creds = { username: ENV_ADMIN_USER, passwordHash };
    await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
    return creds;
  }
};

const saveCredentials = async (creds) => {
  await ensureDataDir();
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
};

const userDataPath = (username) => path.join(DATA_DIR, `${username}.json`);

const loadUserData = async (username) => {
  await ensureDataDir();
  try {
    const buf = await fs.readFile(userDataPath(username), 'utf-8');
    const parsed = JSON.parse(buf);
    const mergedSettings = { ...defaultSettings(), ...parsed.settings };
    mergedSettings.security = { ...defaultSettings().security, ...(parsed.settings?.security || {}) };
    // AI config is removed; strip legacy values if present
    if ('aiConfig' in mergedSettings) {
      delete mergedSettings.aiConfig;
    }
    mergedSettings.exchangeRateApi = {
      ...defaultSettings().exchangeRateApi,
      ...(parsed.settings?.exchangeRateApi || {})
    };
    const parsedRules = parsed.settings?.notifications?.rules || {};
    const parsedTemplate = parsedRules.template;
    const normalizedTemplate =
      !parsedTemplate ||
      parsedTemplate === DEFAULT_REMINDER_TEMPLATE ||
      parsedTemplate === PREVIOUS_REMINDER_TEMPLATE
        ? DEFAULT_REMINDER_TEMPLATE
        : parsedTemplate;
    const normalizedRules = {
      renewalReminder: parsedRules.renewalReminder !== undefined ? parsedRules.renewalReminder : defaultSettings().notifications.rules.renewalReminder,
      reminderDays: parsedRules.reminderDays ?? defaultSettings().notifications.rules.reminderDays,
      template: normalizedTemplate,
      channels: {
        ...DEFAULT_RULE_CHANNELS,
        ...(parsedRules.channels || {})
      }
    };
    mergedSettings.notifications = {
      ...defaultSettings().notifications,
      ...(parsed.settings?.notifications || {}),
      rules: {
        ...normalizedRules
      }
    };
    return {
      subscriptions: parsed.subscriptions || [],
      notifications: parsed.notifications || [],
      settings: mergedSettings
    };
  } catch (err) {
    const initial = defaultUserData();
    await saveUserData(username, initial);
    return initial;
  }
};

const saveUserData = async (username, data) => {
  await ensureDataDir();
  // AI config is removed; strip legacy values if present
  const settings = { ...(data.settings || {}) };
  if ('aiConfig' in settings) {
    delete settings.aiConfig;
  }
  settings.exchangeRateApi = {
    ...defaultSettings().exchangeRateApi,
    ...(data.settings?.exchangeRateApi || {})
  };
  const payload = {
    subscriptions: data.subscriptions || [],
    notifications: data.notifications || [],
    settings: { 
      ...defaultSettings(), 
      ...settings,
      security: { ...defaultSettings().security, ...(data.settings?.security || {}) },
      notifications: {
        ...defaultSettings().notifications,
        ...(data.settings?.notifications || {}),
        rules: {
          renewalReminder: data.settings?.notifications?.rules?.renewalReminder ?? defaultSettings().notifications.rules.renewalReminder,
          reminderDays: data.settings?.notifications?.rules?.reminderDays ?? defaultSettings().notifications.rules.reminderDays,
          template: data.settings?.notifications?.rules?.template || DEFAULT_REMINDER_TEMPLATE,
          channels: {
            ...DEFAULT_RULE_CHANNELS,
            ...(data.settings?.notifications?.rules?.channels || {})
          }
        }
      }
    }
  };
  await fs.writeFile(userDataPath(username), JSON.stringify(payload, null, 2), 'utf-8');
};

// --- Runtime state ---
let credentials = await loadCredentials();
let ADMIN_HASH = credentials.passwordHash;

const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// --- Notification helpers ---
const emailTransporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    })
  : null;

const renderTemplate = (templateStr, subscription) => {
  try {
    const parsed = JSON.parse(templateStr || '');
    if (!parsed?.lines || !Array.isArray(parsed.lines)) throw new Error('invalid_template');
    const map = {
      name: subscription.name || '未填写',
      nextBillingDate: subscription.nextBillingDate || '未填写',
      price: subscription.price ?? '',
      currency: subscription.currency || '',
      paymentMethod: subscription.paymentMethod || '未填写'
    };
    const replaceTokens = (line) =>
      typeof line === 'string'
        ? line
            .replace(/{{\s*name\s*}}/g, map.name)
            .replace(/{{\s*nextBillingDate\s*}}/g, map.nextBillingDate)
            .replace(/{{\s*price\s*}}/g, map.price)
            .replace(/{{\s*currency\s*}}/g, map.currency)
            .replace(/{{\s*paymentMethod\s*}}/g, map.paymentMethod)
        : '';
    const lines = parsed.lines.map(replaceTokens).filter(Boolean);
    // Use real newlines so Telegram/email render line breaks correctly
    return lines.join('\n');
  } catch (err) {
    // Fallback to default template if parsing fails
    return renderTemplate(DEFAULT_REMINDER_TEMPLATE, subscription);
  }
};

const formatReminderMessage = (subscription, templateStr = DEFAULT_REMINDER_TEMPLATE) => {
  return renderTemplate(templateStr, subscription);
};

const scrubToken = (token) =>
  token ? `${token.slice(0, 6)}...${token.slice(-4)}` : 'undefined';

const sendTelegramMessage = async (botToken, chatId, text, replyMarkup) => {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };

  if (replyMarkup) {
    // Ensure Telegram receives an object, even if caller passed a stringified markup
    try {
      payload.reply_markup =
        typeof replyMarkup === 'string' ? JSON.parse(replyMarkup) : replyMarkup;
    } catch (_err) {
      payload.reply_markup = replyMarkup;
    }
  }

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await resp.json().catch(() => ({}));

  // Debug log to inspect inline keyboard delivery
  if (process.env.DEBUG_TELEGRAM === '1') {
    console.log('telegram sendMessage', {
      ok: json?.ok,
      description: json?.description,
      chatId,
      hasMarkup: !!replyMarkup,
      markupType: typeof payload.reply_markup,
      replyMarkup: payload.reply_markup,
      resultMarkup: json?.result?.reply_markup,
      bot: scrubToken(botToken)
    });
  }

  if (!resp.ok || json?.ok === false) {
    const errMsg = json?.description || `telegram_error_${resp.status}`;
    throw new Error(errMsg);
  }

  return json;
};

const answerCallback = async (botToken, callbackQueryId, text) => {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false
    })
  });
};

const clearInlineKeyboard = async (botToken, chatId, messageId) => {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] }
    })
  });
};

const sendEmailMessage = async (to, subject, text) => {
  if (!emailTransporter) {
    throw new Error('smtp_not_configured');
  }
  await emailTransporter.sendMail({
    from: smtpConfig.from || smtpConfig.user,
    to,
    subject,
    text
  });
};

const notificationAlreadySent = (notifications, subscription, channel) => {
  return (notifications || []).some(
    (n) =>
      n.type === 'renewal_reminder' &&
      n.subscriptionName === subscription.name &&
      n.channel === channel &&
      n.status === 'success' &&
      n.details?.date === subscription.nextBillingDate
  );
};

const randomId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const applySubscriptionAction = (subscription, action) => {
  if (!subscription) return { changed: false, status: null };
  let targetStatus = subscription.status || 'active';
  if (action === 'renewed') targetStatus = 'active';
  if (action === 'deprecated') targetStatus = 'cancelled';
  const changed = subscription.status !== targetStatus;
  subscription.status = targetStatus;
  return { changed, status: targetStatus };
};

const daysUntilDate = (dateString) => {
  if (!dateString) return Infinity;
  const toStartOfDay = (d) => {
    const clone = new Date(d);
    clone.setHours(0, 0, 0, 0);
    return clone;
  };

  const todayStart = toStartOfDay(new Date());
  const targetStart = toStartOfDay(new Date(dateString));
  const diff = targetStart.getTime() - todayStart.getTime();

  // Use ceil so a target 2.2 days away counts as 3 full days remaining
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const processRenewalReminders = async () => {
  const username = credentials.username;
  let data;

  try {
    data = await loadUserData(username);
  } catch (err) {
    console.error('Failed to load user data for reminders', err);
    return;
  }

  const settings = data.settings || defaultSettings();
  const reminderRule = settings.notifications?.rules?.renewalReminder;
  const reminderDays = Number(settings.notifications?.rules?.reminderDays ?? 3);
  const ruleChannels = settings.notifications?.rules?.channels || DEFAULT_RULE_CHANNELS;

  if (!reminderRule) return;

  const subs = data.subscriptions || [];
  let changed = false;

  for (const sub of subs) {
    if (!sub?.notificationsEnabled) continue;
    if (sub.status && sub.status !== 'active') continue;

    const days = daysUntilDate(sub.nextBillingDate);
    if (days < 0 || days > reminderDays) continue;

    const message = formatReminderMessage(sub, settings.notifications?.rules?.template);
    const dateLabel = sub.nextBillingDate || '';

    const attemptChannel = async (channel) => {
      const recordBase = {
        id: randomId(),
        subscriptionName: sub.name,
        type: 'renewal_reminder',
        channel,
        timestamp: Date.now(),
        details: {
          date: dateLabel,
          amount: sub.price,
          currency: sub.currency,
          paymentMethod: sub.paymentMethod,
          message
        }
      };

      if (notificationAlreadySent(data.notifications, sub, channel)) return;

      try {
        if (channel === 'telegram') {
          const { enabled, botToken, chatId } = settings.notifications?.telegram || {};
          const allowed = (ruleChannels?.renewalReminder || []).includes('telegram');
          if (!enabled || !botToken || !chatId || !allowed) return;
          const replyMarkup = buildInlineKeyboard(sub.id || sub.name || 'unknown');
          await sendTelegramMessage(botToken, chatId, message, replyMarkup);
        } else if (channel === 'email') {
          const { enabled, emailAddress } = settings.notifications?.email || {};
          const allowed = (ruleChannels?.renewalReminder || []).includes('email');
          if (!enabled || !emailAddress || !allowed) return;
          await sendEmailMessage(emailAddress, '续订提醒通知', message);
        } else {
          return;
        }

        data.notifications.push({
          ...recordBase,
          status: 'success'
        });
        changed = true;
      } catch (err) {
        data.notifications.push({
          ...recordBase,
          status: 'failed',
          details: { ...recordBase.details, errorReason: err?.message || 'unknown_error' }
        });
        changed = true;
      }
    };

    await attemptChannel('telegram');
    await attemptChannel('email');
  }

  if (changed) {
    try {
      await saveUserData(username, data);
    } catch (err) {
      console.error('Failed to persist notifications history', err);
    }
  }
};

const updateExchangeRatesForUser = async (username, slotHour = null) => {
  const data = await loadUserData(username);
  const settings = data.settings || defaultSettings();
  const cfg = settings.exchangeRateApi || defaultSettings().exchangeRateApi;

  if (!cfg.enabled || !cfg.encryptedKey) {
    return { updated: false, reason: 'exchange_rate_api_not_enabled' };
  }

  const apiKey = await decryptExchangeRateApiKey(cfg.encryptedKey);
  const conversionRates = await fetchUsdRatesFromExchangeRateApi(apiKey);

  const desired = (settings.customCurrencies || []).map((c) => c.code).filter(Boolean);
  const nextRates = { ...(settings.exchangeRates || {}) };
  nextRates.USD = 1;

  for (const code of desired) {
    if (code === 'USD') continue;
    const rate = conversionRates[code];
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      nextRates[code] = rate;
    }
  }

  const now = Date.now();
  settings.exchangeRates = nextRates;
  settings.lastRatesUpdate = now;
  settings.exchangeRateApi = {
    ...defaultSettings().exchangeRateApi,
    ...cfg,
    ...(slotHour === 0 ? { lastRunAt0: now } : {}),
    ...(slotHour === 12 ? { lastRunAt12: now } : {})
  };

  data.settings = settings;
  await saveUserData(username, data);

  return { updated: true, lastRatesUpdate: now, exchangeRates: nextRates, exchangeRateApi: settings.exchangeRateApi };
};

let reminderTimer = null;
let reminderRunning = false;

const startReminderScheduler = () => {
  if (reminderTimer) return;

  const tick = async () => {
    if (reminderRunning) return;
    reminderRunning = true;
    try {
      await processRenewalReminders();
    } catch (err) {
      console.error('Reminder tick failed', err);
    } finally {
      reminderRunning = false;
    }
  };

  // Initial run
  tick();
  reminderTimer = setInterval(tick, NOTIFY_INTERVAL_MS);
};

// --- Routes ---
// Telegram webhook to capture inline button actions
app.post('/api/telegram/webhook/:token', async (req, res) => {
  const incomingToken = req.params.token;
  const update = req.body || {};
  const callback = update.callback_query;

  try {
    const user = credentials.username;
    const data = await loadUserData(user);
    const telegramCfg = data.settings?.notifications?.telegram || {};

    if (!telegramCfg.botToken || telegramCfg.botToken !== incomingToken) {
      return res.status(403).json({ ok: false, message: 'invalid_token' });
    }

    if (!callback || !callback.data || !callback.message) {
      return res.json({ ok: true, message: 'ignored' });
    }

    const [action, rawId] = callback.data.split('|');
    const allowedActions = ['renewed', 'deprecated'];
    if (!allowedActions.includes(action) || !rawId) {
      return res.json({ ok: false, message: 'invalid_action' });
    }

    const sub =
      (data.subscriptions || []).find((s) => s.id === rawId) ||
      (data.subscriptions || []).find((s) => s.name === rawId);

    if (!sub) {
      await answerCallback(telegramCfg.botToken, callback.id, '找不到对应的订阅记录');
      return res.json({ ok: false, message: 'subscription_not_found' });
    }

    const result = applySubscriptionAction(sub, action);

    if (result.changed) {
      data.notifications = data.notifications || [];
      data.notifications.push({
        id: randomId(),
        subscriptionName: sub.name,
        type: 'subscription_change',
        channel: 'telegram',
        status: 'success',
        timestamp: Date.now(),
        details: {
          message: action === 'renewed' ? '用户在 Telegram 确认已续订' : '用户在 Telegram 标记为已弃用',
          receiver: callback.from?.username || callback.from?.id?.toString?.() || 'unknown',
          date: sub.nextBillingDate,
          paymentMethod: sub.paymentMethod,
          amount: sub.price,
          currency: sub.currency
        }
      });

      await saveUserData(user, data);
    }

    await answerCallback(
      telegramCfg.botToken,
      callback.id,
      result.status === 'cancelled' ? '已标记为弃用/取消' : '已标记为已续订'
    );
    await clearInlineKeyboard(telegramCfg.botToken, callback.message.chat.id, callback.message.message_id);

    res.json({ ok: true });
  } catch (err) {
    console.error('Telegram callback error', err);
    res.status(500).json({ ok: false, message: 'server_error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password, code } = req.body || {};
  if (username !== credentials.username) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, ADMIN_HASH);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const data = await loadUserData(username);
  const sec = data.settings?.security || defaultSettings().security;

  if (sec.twoFactorEnabled && sec.twoFactorSecret) {
    if (!code) {
      return res.status(403).json({ message: 'two_factor_required' });
    }

    const verified = speakeasy.totp.verify({
      secret: sec.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!verified) {
      return res.status(401).json({ message: 'invalid_2fa' });
    }
  }

  const token = signToken({ username });
  res.json({ token, username });
});

// --- ExchangeRate-API config ---
app.get('/api/exchange-rate/public-key', authMiddleware, async (_req, res) => {
  try {
    const jwk = await getExchangeRatePublicJwk();
    res.json({ jwk });
  } catch (err) {
    console.error('Failed to provide exchange rate public key', err);
    res.status(500).json({ message: 'failed_to_get_public_key' });
  }
});

app.post('/api/exchange-rate/config', authMiddleware, async (req, res) => {
  try {
    const { encryptedKey, test } = req.body || {};
    const username = req.user.username;
    const data = await loadUserData(username);
    const settings = data.settings || defaultSettings();

    settings.exchangeRateApi = {
      ...defaultSettings().exchangeRateApi,
      ...(settings.exchangeRateApi || {}),
      ...(typeof encryptedKey === 'string' ? { encryptedKey } : {}),
      enabled: false
    };

    data.settings = settings;
    await saveUserData(username, data);

    if (test) {
      const keyToUse = settings.exchangeRateApi.encryptedKey;
      const apiKey = await decryptExchangeRateApiKey(keyToUse);
      await fetchUsdRatesFromExchangeRateApi(apiKey);

      settings.exchangeRateApi.enabled = true;
      settings.exchangeRateApi.lastTestedAt = Date.now();
      data.settings = settings;
      await saveUserData(username, data);

      const updated = await updateExchangeRatesForUser(username, null);
      return res.json({
        ok: true,
        settings: {
          exchangeRateApi: updated.exchangeRateApi,
          exchangeRates: updated.exchangeRates,
          lastRatesUpdate: updated.lastRatesUpdate
        }
      });
    }

    res.json({
      ok: true,
      settings: {
        exchangeRateApi: settings.exchangeRateApi,
        exchangeRates: settings.exchangeRates,
        lastRatesUpdate: settings.lastRatesUpdate
      }
    });
  } catch (err) {
    console.error('Exchange rate config error', err);
    res.status(400).json({ ok: false, message: err?.message || 'exchange_rate_config_failed' });
  }
});

app.post('/api/exchange-rate/update', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username;
    const updated = await updateExchangeRatesForUser(username, null);
    if (!updated.updated) {
      return res.status(400).json({ ok: false, message: updated.reason || 'not_updated' });
    }
    res.json({
      ok: true,
      settings: {
        exchangeRateApi: updated.exchangeRateApi,
        exchangeRates: updated.exchangeRates,
        lastRatesUpdate: updated.lastRatesUpdate
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err?.message || 'exchange_rate_update_failed' });
  }
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username });
});

app.get('/api/data', authMiddleware, async (req, res) => {
  const data = await loadUserData(req.user.username);
  res.json(data);
});

app.put('/api/data', authMiddleware, async (req, res) => {
  const { subscriptions = [], settings = {}, notifications = [] } = req.body || {};
  await saveUserData(req.user.username, { subscriptions, settings, notifications });
  res.json({ success: true });
});

app.post('/api/2fa/init', authMiddleware, async (req, res) => {
  const data = await loadUserData(req.user.username);
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `Subm (${req.user.username})`,
    issuer: 'Subm'
  });

  data.settings = data.settings || defaultSettings();
  data.settings.security = data.settings.security || defaultSettings().security;
  data.settings.security.pendingTwoFactorSecret = secret.base32;
  data.settings.security.twoFactorEnabled = false;

  await saveUserData(req.user.username, data);

  res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url });
});

app.post('/api/2fa/verify', authMiddleware, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ message: 'Missing code' });

  const data = await loadUserData(req.user.username);
  const secret = data.settings?.security?.pendingTwoFactorSecret || data.settings?.security?.twoFactorSecret;

  if (!secret) return res.status(400).json({ message: 'No pending secret' });

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 1
  });

  if (!verified) return res.status(400).json({ message: 'Invalid code' });

  data.settings.security.twoFactorEnabled = true;
  data.settings.security.twoFactorSecret = secret;
  data.settings.security.pendingTwoFactorSecret = '';

  await saveUserData(req.user.username, data);

  res.json({ success: true, secret });
});

app.post('/api/2fa/disable', authMiddleware, async (req, res) => {
  const data = await loadUserData(req.user.username);
  data.settings.security.twoFactorEnabled = false;
  data.settings.security.twoFactorSecret = '';
  data.settings.security.pendingTwoFactorSecret = '';
  await saveUserData(req.user.username, data);
  res.json({ success: true });
});

app.post('/api/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Missing password fields' });
  }

  const ok = await bcrypt.compare(currentPassword, ADMIN_HASH);
  if (!ok) return res.status(401).json({ message: 'Invalid current password' });

  const newHash = bcrypt.hashSync(newPassword, 10);
  credentials = { ...credentials, passwordHash: newHash };
  ADMIN_HASH = newHash;
  await saveCredentials(credentials);
  res.json({ success: true });
});

// 健康检查
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Auth server running on :${PORT}`);
});

// Start background reminder checks
startReminderScheduler();

// --- Exchange rate scheduler (00:00 & 12:00) ---
let rateTimer = null;
let rateRunning = false;

const startExchangeRateScheduler = () => {
  if (rateTimer) return;

  const tick = async () => {
    if (rateRunning) return;
    rateRunning = true;
    try {
      const username = credentials.username;
      const data = await loadUserData(username);
      const settings = data.settings || defaultSettings();
      const tz = settings.timezone || 'Asia/Shanghai';
      const today = formatDateInTimeZone(tz);
      const { hour, minute } = getTimePartsInTimeZone(tz);

      const cfg = settings.exchangeRateApi || defaultSettings().exchangeRateApi;
      if (!cfg.enabled || !cfg.encryptedKey || !cfg.lastTestedAt) return;

      const ran0 = cfg.lastRunAt0 ? formatDateInTimeZone(tz, new Date(cfg.lastRunAt0)) : '';
      const ran12 = cfg.lastRunAt12 ? formatDateInTimeZone(tz, new Date(cfg.lastRunAt12)) : '';

      // run once after the slot time has passed, even if tick isn't exactly at :00
      if ((hour > 0 || (hour === 0 && minute >= 0)) && ran0 !== today) {
        await updateExchangeRatesForUser(username, 0);
      }
      if ((hour > 12 || (hour === 12 && minute >= 0)) && ran12 !== today) {
        await updateExchangeRatesForUser(username, 12);
      }
    } catch (err) {
      console.error('Exchange rate tick failed', err);
    } finally {
      rateRunning = false;
    }
  };

  tick();
  rateTimer = setInterval(tick, 5 * 60 * 1000);
};

startExchangeRateScheduler();
