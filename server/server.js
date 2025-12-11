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

// Environment variables (can be overridden in deployment)
const ENV_ADMIN_USER = process.env.ADMIN_USER || 'luanyang5209';
const ENV_ADMIN_PASS = process.env.ADMIN_PASS || 'passwords';
const JWT_SECRET = process.env.JWT_SECRET || 'hAhJwsNwQLc1b2tIGLjIupRVphNue5vbdPxoAoeBMUg=';
const PORT = process.env.PORT || 3001;
const NOTIFY_INTERVAL_MS = Number(process.env.NOTIFY_INTERVAL_MS || 10 * 60 * 1000); // default 10 minutes

const DATA_DIR = path.join(__dirname, 'data');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');
const DEFAULT_RULE_CHANNELS = {
  renewalFailed: ['telegram', 'email'],
  renewalReminder: ['telegram', 'email'],
  renewalSuccess: ['telegram', 'email'],
  subscriptionChange: ['telegram', 'email']
};

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

app.use(express.json());

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
  aiConfig: {
    baseUrl: '',
    apiKey: '',
    model: ''
  },
  notifications: {
    telegram: { enabled: false, botToken: '', chatId: '' },
    email: { enabled: false, emailAddress: '' },
    rules: {
      renewalFailed: true,
      renewalReminder: true,
      renewalSuccess: false,
      subscriptionChange: true,
      reminderDays: 3,
      channels: { ...DEFAULT_RULE_CHANNELS }
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
    mergedSettings.notifications = {
      ...defaultSettings().notifications,
      ...(parsed.settings?.notifications || {}),
      rules: {
        ...defaultSettings().notifications.rules,
        ...(parsed.settings?.notifications?.rules || {}),
        channels: {
          ...DEFAULT_RULE_CHANNELS,
          ...(parsed.settings?.notifications?.rules?.channels ||
            mergedSettings?.notifications?.rules?.channels ||
            {})
        }
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
  const payload = {
    subscriptions: data.subscriptions || [],
    notifications: data.notifications || [],
    settings: { 
      ...defaultSettings(), 
      ...data.settings,
      security: { ...defaultSettings().security, ...(data.settings?.security || {}) },
      notifications: {
        ...defaultSettings().notifications,
        ...(data.settings?.notifications || {}),
        rules: {
          ...defaultSettings().notifications.rules,
          ...(data.settings?.notifications?.rules || {}),
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

const formatReminderMessage = (subscription) => {
  const date = subscription.nextBillingDate || '未填写';
  const amount =
    subscription.price && subscription.currency
      ? `${subscription.price} ${subscription.currency}`
      : subscription.price
        ? `${subscription.price}`
        : '未填写';
  const payment = subscription.paymentMethod || '未填写';

  return [
    '🔔 续订提醒通知',
    '',
    `📌 订阅${subscription.name}即将付款`,
    '',
    `📅 付款日期：${date}`,
    `💰 订阅金额：${amount}`,
    `💳 支付方式：${payment}`,
    '',
    '⚠️ 请及时续订以避免服务中断。'
  ].join('\n');
};

const formatRenewalSuccessMessage = (subscription) => {
  const date = subscription.nextBillingDate || '未填写';
  const amount =
    subscription.price && subscription.currency
      ? `${subscription.price} ${subscription.currency}`
      : subscription.price
        ? `${subscription.price}`
        : '未填写';
  const payment = subscription.paymentMethod || '未填写';

  return [
    '✅ 续订成功通知',
    '',
    `📌 订阅${subscription.name}已成功续订`,
    '',
    `📅 付款日期：${date}`,
    `💰 订阅金额：${amount}`,
    `💳 支付方式：${payment}`,
    '',
    '🎉 订阅已续费成功，服务将正常继续。'
  ].join('\n');
};

const formatRenewalFailedMessage = (subscription) => {
  const date = subscription.nextBillingDate || '未填写';
  const amount =
    subscription.price && subscription.currency
      ? `${subscription.price} ${subscription.currency}`
      : subscription.price
        ? `${subscription.price}`
        : '未填写';
  const payment = subscription.paymentMethod || '未填写';

  return [
    '🚫 续订失败通知',
    '',
    `📌 订阅${subscription.name}续订失败`,
    '',
    `📅 尝试付款日期：${date}`,
    `💰 订阅金额：${amount}`,
    `💳 支付方式：${payment}`,
    '',
    '⚠️ 请检查支付方式或余额后重试。'
  ].join('\n');
};

const formatSubscriptionChangeMessage = (subscription, note) => {
  const date = subscription.nextBillingDate || '未填写';
  const amount =
    subscription.price && subscription.currency
      ? `${subscription.price} ${subscription.currency}`
      : subscription.price
        ? `${subscription.price}`
        : '未填写';
  const payment = subscription.paymentMethod || '未填写';

  return [
    'ℹ️ 订阅变更通知',
    '',
    `📌 订阅${subscription.name}已更新`,
    '',
    `📅 下次付款日期：${date}`,
    `💰 当前订阅金额：${amount}`,
    `💳 支付方式：${payment}`,
    `📝 变更说明：${note || '无'}`,
    '',
    '⚠️ 如非本人操作请检查订阅设置。'
  ].join('\n');
};

const sendTelegramMessage = async (botToken, chatId, text) => {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const errMsg = data?.description || `telegram_error_${resp.status}`;
    throw new Error(errMsg);
  }
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

const daysUntilDate = (dateString) => {
  if (!dateString) return Infinity;
  const now = new Date();
  const target = new Date(dateString);
  const diff = target.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
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

    const message = formatReminderMessage(sub);
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
          await sendTelegramMessage(botToken, chatId, message);
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
