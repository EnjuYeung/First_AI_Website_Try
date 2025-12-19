const requireEnv = (name) => {
  const val = process.env[name];
  if (!val) {
    console.error(`[FATAL] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return val;
};

export const getConfig = () => {
  const adminUser = requireEnv('ADMIN_USER');
  const adminPass = requireEnv('ADMIN_PASS');
  const jwtSecret = requireEnv('JWT_SECRET');

  const port = Number(process.env.PORT || 3001);
  const notifyIntervalMs = Number(process.env.NOTIFY_INTERVAL_MS || 10 * 60 * 1000);
  const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '2mb';
  const maxIconBytes = Number(process.env.MAX_ICON_BYTES || 1024 * 1024);

  const smtp = {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  };

  const allowedOrigins = [
    'https://subm.junziguozi.cc',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  return {
    adminUser,
    adminPass,
    jwtSecret,
    port,
    notifyIntervalMs,
    jsonBodyLimit,
    maxIconBytes,
    smtp,
    allowedOrigins,
    debugTelegram: process.env.DEBUG_TELEGRAM === '1',
  };
};

