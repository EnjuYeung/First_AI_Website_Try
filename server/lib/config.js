import { assertStrongSecret, isStrongPassword } from './securityPolicy.js';

const requireEnv = (name) => {
  const val = process.env[name];
  if (!val) {
    console.error(`[FATAL] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return val;
};

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

const normalizeAllowedOrigin = (value) => {
  const raw = String(value || '').trim();
  try {
    const parsed = new URL(raw);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('invalid_origin');
    }
    return parsed.origin;
  } catch {
    throw new Error(`ALLOWED_ORIGINS contains invalid origin: ${raw || '(empty)'}`);
  }
};

const configuredAllowedOrigins = () => {
  const configured = process.env.ALLOWED_ORIGINS;
  const values = configured === undefined
    ? defaultAllowedOrigins
    : configured.split(',').map((value) => value.trim()).filter(Boolean);
  return [...new Set(values.map(normalizeAllowedOrigin))];
};

const configuredTrustProxy = () => {
  const configured = process.env.TRUST_PROXY?.trim();
  if (configured === undefined || configured === '') return 'loopback, linklocal, uniquelocal';
  if (['0', 'false', 'off'].includes(configured.toLowerCase())) return false;
  if (/^\d+$/.test(configured)) return Number(configured);
  return configured;
};

const configuredTimeZone = () => {
  const timeZone = String(process.env.TIMEZONE || 'Asia/Shanghai').trim();
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format();
    return timeZone;
  } catch {
    throw new Error(`TIMEZONE is not a valid IANA timezone: ${timeZone || '(empty)'}`);
  }
};

export const getConfig = () => {
  const adminUser = requireEnv('ADMIN_USER');
  const adminPass = requireEnv('ADMIN_PASS');
  const jwtSecret = requireEnv('JWT_SECRET');
  const dataEncryptionKey = requireEnv('DATA_ENCRYPTION_KEY');
  if (adminUser.length > 128) {
    throw new Error('ADMIN_USER must be 1-128 characters');
  }
  if (!isStrongPassword(adminPass)) {
    throw new Error('ADMIN_PASS must be 12-128 characters with upper, lower, digit, and symbol');
  }
  assertStrongSecret('JWT_SECRET', jwtSecret);
  assertStrongSecret('DATA_ENCRYPTION_KEY', dataEncryptionKey);

  const port = Number(process.env.PORT || 3001);
  const notifyIntervalMs = Number(process.env.NOTIFY_INTERVAL_MS || 10 * 60 * 1000);
  const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '2mb';
  const maxIconBytes = Number(process.env.MAX_ICON_BYTES || 1024 * 1024);
  const maxWallpaperBytes = Number(process.env.MAX_WALLPAPER_BYTES || 8 * 1024 * 1024);
  const timeZone = configuredTimeZone();

  const smtp = {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  };

  const allowedOrigins = configuredAllowedOrigins();
  const trustProxy = configuredTrustProxy();

  return {
    adminUser,
    adminPass,
    jwtSecret,
    dataEncryptionKey,
    port,
    notifyIntervalMs,
    jsonBodyLimit,
    maxIconBytes,
    maxWallpaperBytes,
    timeZone,
    smtp,
    allowedOrigins,
    trustProxy,
    debugTelegram: process.env.DEBUG_TELEGRAM === '1',
  };
};
