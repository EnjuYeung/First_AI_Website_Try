import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment variables (can be overridden in deployment)
const ENV_ADMIN_USER = process.env.ADMIN_USER || 'luanyang5209';
const ENV_ADMIN_PASS = process.env.ADMIN_PASS || 'passwords';
const JWT_SECRET = process.env.JWT_SECRET || 'hAhJwsNwQLc1b2tIGLjIupRVphNue5vbdPxoAoeBMUg=';
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, 'data');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');

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
      reminderDays: 3
    },
    scheduledTask: false
  },
  security: {
    twoFactorEnabled: false,
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
    return {
      subscriptions: parsed.subscriptions || [],
      notifications: parsed.notifications || [],
      settings: { ...defaultSettings(), ...parsed.settings }
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
    settings: { ...defaultSettings(), ...data.settings }
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

// --- Routes ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (username !== credentials.username) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, ADMIN_HASH);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

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
