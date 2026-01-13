import express from 'express';
import speakeasy from 'speakeasy';
import { renderReminderTemplate, DEFAULT_REMINDER_TEMPLATE_STRING } from '../../shared/reminderTemplate.js';
import { createIconUpload } from './iconUpload.js';
import { sendTelegramMessage, answerCallback, clearInlineKeyboard, ensureTelegramWebhook } from './telegram.js';

const applySubscriptionAction = (subscription, action) => {
  if (!subscription) return { changed: false, status: null };
  let targetStatus = subscription.status || 'active';
  if (action === 'renewed') targetStatus = 'active';
  if (action === 'deprecated') targetStatus = 'cancelled';
  const changed = subscription.status !== targetStatus;
  subscription.status = targetStatus;
  if (changed) {
    if (targetStatus === 'cancelled') {
      subscription.cancelledAt = formatLocalYMD(new Date());
    } else {
      delete subscription.cancelledAt;
    }
  }
  return { changed, status: targetStatus };
};

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseLocalYMD = (ymd) => {
  const match = YMD_RE.exec(String(ymd || '').trim());
  if (!match) return new Date(NaN);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
};

function formatLocalYMD(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const addFrequencyToDate = (ymd, frequency) => {
  const date = parseLocalYMD(ymd);
  if (Number.isNaN(date.getTime())) return '';
  switch (frequency) {
    case 'Monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'Quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'Semi-Annually':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'Yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return '';
  }
  return formatLocalYMD(date);
};

const normalizeBaseUrl = (value) =>
  String(value || '')
    .trim()
    .replace(/\/+$/, '');

const resolveWebhookBaseUrl = (req, config) => {
  if (config.publicBaseUrl) return normalizeBaseUrl(config.publicBaseUrl);
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) return '';
  const protoHeader = req.get('x-forwarded-proto');
  const proto = protoHeader ? protoHeader.split(',')[0].trim() : req.protocol;
  if (!proto) return '';
  return normalizeBaseUrl(`${proto}://${host}`);
};

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseCallbackData = (data) => {
  const parts = String(data || '').split('|');
  const action = parts[0] || '';
  const rawId = parts.slice(1).join('|');
  return { action, rawId };
};

const extractSubscriptionNameFromMessage = (templateString, messageText) => {
  if (!messageText) return '';

  const parseLines = (input) => {
    try {
      const parsed = JSON.parse(input || '');
      return Array.isArray(parsed?.lines) ? parsed.lines : [];
    } catch {
      return [];
    }
  };

  const templateLines =
    parseLines(templateString).length > 0
      ? parseLines(templateString)
      : parseLines(DEFAULT_REMINDER_TEMPLATE_STRING);
  const messageLines = String(messageText).split('\n');

  for (const templateLine of templateLines) {
    if (typeof templateLine !== 'string' || !templateLine.includes('{{name}}')) continue;
    const [prefix, ...rest] = templateLine.split('{{name}}');
    const suffix = rest.join('{{name}}');
    const pattern = new RegExp(`^${escapeRegExp(prefix)}(.+?)${escapeRegExp(suffix)}$`);
    for (const messageLine of messageLines) {
      const match = pattern.exec(messageLine);
      if (match?.[1]) return match[1].trim();
    }
  }

  const flatText = String(messageText).replace(/\s+/g, ' ').trim();
  const genericPatterns = [
    /订阅\s*(.+?)\s*即将续费/,
    /Subscription\s*(.+?)\s*(?:is\s*)?(?:about\s+to|will)\s+renew/i,
  ];
  for (const pattern of genericPatterns) {
    const match = pattern.exec(flatText);
    if (match?.[1]) return match[1].trim();
  }

  return '';
};

const resolveSubscriptionFromCallback = ({
  subscriptions,
  rawId,
  messageText,
  templateString,
}) => {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  if (rawId) {
    const byId = list.find((s) => s.id === rawId);
    if (byId) return byId;
    const byName = list.find((s) => s.name === rawId);
    if (byName) return byName;
  }
  const extractedName = extractSubscriptionNameFromMessage(templateString, messageText);
  if (!extractedName) return null;
  return list.find((s) => s.name === extractedName) || null;
};

const updateRenewalFeedback = (notifications, subscription, dateLabel, feedback) => {
  if (!dateLabel) return false;
  let updated = false;
  (notifications || []).forEach((record) => {
    if (record.type !== 'renewal_reminder') return;
    if (record.details?.date !== dateLabel) return;
    const matchesId = record.details?.subscriptionId && subscription.id
      ? record.details.subscriptionId === subscription.id
      : record.subscriptionName === subscription.name;
    if (!matchesId) return;
    record.details = {
      ...record.details,
      renewalFeedback: feedback,
      subscriptionId: record.details?.subscriptionId || subscription.id,
    };
    updated = true;
  });
  return updated;
};

const randomId = (crypto) =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const sanitizePersistedData = (payload) => {
  const safe = isPlainObject(payload) ? payload : {};
  return {
    subscriptions: Array.isArray(safe.subscriptions) ? safe.subscriptions : [],
    notifications: Array.isArray(safe.notifications) ? safe.notifications : [],
    settings: isPlainObject(safe.settings) ? safe.settings : {},
  };
};

export const registerRoutes = ({
  app,
  config,
  auth,
  storage,
  reminders,
  exchangeRate,
  email,
  crypto,
  uploadsDir,
}) => {
  const iconUpload = createIconUpload({ uploadsDir, maxIconBytes: config.maxIconBytes });

  // Telegram webhook to capture inline button actions
  app.post('/api/telegram/webhook/:token', async (req, res) => {
    const incomingToken = req.params.token;
    const update = req.body || {};
    const callback = update.callback_query;

    try {
      const user = auth.getAdminUsername();
      const data = await storage.loadUserData(user);
      const telegramCfg = data.settings?.notifications?.telegram || {};

      if (!telegramCfg.botToken || telegramCfg.botToken !== incomingToken) {
        return res.status(403).json({ ok: false, message: 'invalid_token' });
      }

      if (!callback || !callback.data) {
        return res.json({ ok: true, message: 'ignored' });
      }

      const { action, rawId } = parseCallbackData(callback.data);
      const allowedActions = ['renewed', 'deprecated'];
      if (!allowedActions.includes(action)) {
        await answerCallback(telegramCfg.botToken, callback.id, '无效操作');
        return res.json({ ok: false, message: 'invalid_action' });
      }

      const templateStr =
        data.settings?.notifications?.rules?.template || DEFAULT_REMINDER_TEMPLATE_STRING;
      const sub = resolveSubscriptionFromCallback({
        subscriptions: data.subscriptions || [],
        rawId,
        messageText: callback.message?.text || '',
        templateString: templateStr,
      });

      if (!sub) {
        await answerCallback(telegramCfg.botToken, callback.id, '找不到对应的订阅记录');
        return res.json({ ok: false, message: 'subscription_not_found' });
      }

      const currentBillingDate = sub.nextBillingDate;
      const feedbackValue = action === 'renewed' ? 'renewed' : 'deprecated';
      const result = applySubscriptionAction(sub, action);

      if (action === 'renewed') {
        const nextDate = addFrequencyToDate(currentBillingDate, sub.frequency);
        if (nextDate) sub.nextBillingDate = nextDate;
      }
      if (action === 'deprecated') {
        sub.nextBillingDate = '';
      }

      data.notifications = data.notifications || [];
      updateRenewalFeedback(data.notifications, sub, currentBillingDate, feedbackValue);

      await storage.saveUserData(user, data);

      await answerCallback(
        telegramCfg.botToken,
        callback.id,
        result.status === 'cancelled' ? '已标记为已弃用' : '已标记为已续订'
      );
      if (callback.message?.chat?.id && callback.message?.message_id) {
        await clearInlineKeyboard(
          telegramCfg.botToken,
          callback.message.chat.id,
          callback.message.message_id
        );
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Telegram callback error', err);
      res.status(500).json({ ok: false, message: 'server_error' });
    }
  });

  app.post('/api/login', async (req, res) => {
    const { username, password, code } = req.body || {};
    if (username !== auth.getAdminUsername()) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await auth.verifyAdminPassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const data = await storage.loadUserData(username);
    const sec = data.settings?.security || {};

    if (sec.twoFactorEnabled && sec.twoFactorSecret) {
      if (!code) return res.status(403).json({ message: 'two_factor_required' });

      const verified = speakeasy.totp.verify({
        secret: sec.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      });

      if (!verified) return res.status(401).json({ message: 'invalid_2fa' });
    }

    const token = auth.signToken({ username });
    auth.setAuthCookie(res, req, token);
    res.json({ ok: true, username });
  });

  app.post('/api/logout', (req, res) => {
    auth.clearAuthCookie(res, req);
    res.json({ success: true });
  });

  app.get('/api/me', auth.authMiddleware, (req, res) => {
    res.json({ username: req.user.username });
  });

  app.get('/api/data', auth.authMiddleware, async (req, res) => {
    const data = await storage.loadUserData(req.user.username);
    res.json(data);
  });

  app.put('/api/data', auth.authMiddleware, async (req, res) => {
    const payload = sanitizePersistedData(req.body);
    await storage.saveUserData(req.user.username, payload);
    res.json({ success: true });
  });

  app.post('/api/icons', auth.authMiddleware, async (req, res) => {
    await storage.ensureDataDir?.();
    iconUpload.single('file')(req, res, (err) => {
      if (err) {
        if (err?.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ ok: false, message: 'icon_too_large' });
        }
        return res.status(400).json({ ok: false, message: err?.message || 'upload_failed' });
      }
      const file = req.file;
      if (!file?.filename) return res.status(400).json({ ok: false, message: 'missing_file' });
      return res.json({ ok: true, url: `/api/uploads/${file.filename}` });
    });
  });

  // ExchangeRate-API config
  app.get('/api/exchange-rate/public-key', auth.authMiddleware, async (_req, res) => {
    try {
      const jwk = await exchangeRate.getPublicJwk();
      res.json({ jwk });
    } catch (err) {
      console.error('Failed to provide exchange rate public key', err);
      res.status(500).json({ message: 'failed_to_get_public_key' });
    }
  });

  app.post('/api/exchange-rate/config', auth.authMiddleware, async (req, res) => {
    try {
      const { encryptedKey, test } = req.body || {};
      const username = req.user.username;
      const data = await storage.loadUserData(username);
      const settings = data.settings;

      settings.exchangeRateApi = {
        ...settings.exchangeRateApi,
        ...(typeof encryptedKey === 'string' ? { encryptedKey } : {}),
        enabled: false,
      };

      data.settings = settings;
      await storage.saveUserData(username, data);

      if (test) {
        const keyToUse = settings.exchangeRateApi.encryptedKey;
        const apiKey = await exchangeRate.decryptKeyForTest(keyToUse);
        await exchangeRate.fetchUsdRatesFromExchangeRateApi(apiKey);

        settings.exchangeRateApi.enabled = true;
        settings.exchangeRateApi.lastTestedAt = Date.now();
        data.settings = settings;
        await storage.saveUserData(username, data);

        const updated = await exchangeRate.updateExchangeRatesForUser(username, null);
        return res.json({
          ok: true,
          settings: {
            exchangeRateApi: updated.exchangeRateApi,
            exchangeRates: updated.exchangeRates,
            lastRatesUpdate: updated.lastRatesUpdate,
          },
        });
      }

      res.json({
        ok: true,
        settings: {
          exchangeRateApi: settings.exchangeRateApi,
          exchangeRates: settings.exchangeRates,
          lastRatesUpdate: settings.lastRatesUpdate,
        },
      });
    } catch (err) {
      console.error('Exchange rate config error', err);
      res.status(400).json({ ok: false, message: err?.message || 'exchange_rate_config_failed' });
    }
  });

  app.post('/api/exchange-rate/update', auth.authMiddleware, async (req, res) => {
    try {
      const username = req.user.username;
      const updated = await exchangeRate.updateExchangeRatesForUser(username, null);
      if (!updated.updated) {
        return res.status(400).json({ ok: false, message: updated.reason || 'not_updated' });
      }
      res.json({
        ok: true,
        settings: {
          exchangeRateApi: updated.exchangeRateApi,
          exchangeRates: updated.exchangeRates,
          lastRatesUpdate: updated.lastRatesUpdate,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, message: err?.message || 'exchange_rate_update_failed' });
    }
  });

  // Notifications: test telegram via backend (avoid browser CORS + keep behavior consistent)
  app.post('/api/notifications/test-telegram', auth.authMiddleware, async (req, res) => {
    try {
      const username = req.user.username;
      const data = await storage.loadUserData(username);
      const settings = data.settings;

      const { enabled, botToken, chatId } = settings.notifications?.telegram || {};
      if (!enabled || !botToken || !chatId) {
        return res.status(400).json({ ok: false, message: 'telegram_not_configured' });
      }

      const webhookBaseUrl = resolveWebhookBaseUrl(req, config);
      if (!webhookBaseUrl) {
        return res.status(400).json({ ok: false, message: 'telegram_webhook_url_missing' });
      }

      const webhookUrl = `${webhookBaseUrl}/api/telegram/webhook/${botToken}`;
      await ensureTelegramWebhook({ debug: config.debugTelegram }, botToken, webhookUrl);

      const templateStr =
        settings.notifications?.rules?.template || DEFAULT_REMINDER_TEMPLATE_STRING;
      const message = renderReminderTemplate(templateStr, {
        name: '测试订阅',
        nextBillingDate: new Date().toISOString().slice(0, 10),
        price: '0.00',
        currency: '',
        paymentMethod: '测试支付方式',
      });

      await sendTelegramMessage({ debug: config.debugTelegram }, botToken, chatId, message, null);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ ok: false, message: err?.message || 'telegram_test_failed' });
    }
  });

  // 2FA
  app.post('/api/2fa/init', auth.authMiddleware, async (req, res) => {
    const data = await storage.loadUserData(req.user.username);
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `Subm (${req.user.username})`,
      issuer: 'Subm',
    });

    data.settings.security = data.settings.security || {};
    data.settings.security.pendingTwoFactorSecret = secret.base32;
    data.settings.security.twoFactorEnabled = false;

    await storage.saveUserData(req.user.username, data);
    res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url });
  });

  app.post('/api/2fa/verify', auth.authMiddleware, async (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ message: 'Missing code' });

    const data = await storage.loadUserData(req.user.username);
    const secret =
      data.settings?.security?.pendingTwoFactorSecret || data.settings?.security?.twoFactorSecret;

    if (!secret) return res.status(400).json({ message: 'No pending secret' });

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) return res.status(400).json({ message: 'Invalid code' });

    data.settings.security.twoFactorEnabled = true;
    data.settings.security.twoFactorSecret = secret;
    data.settings.security.pendingTwoFactorSecret = '';

    await storage.saveUserData(req.user.username, data);
    res.json({ success: true });
  });

  app.post('/api/2fa/disable', auth.authMiddleware, async (req, res) => {
    const data = await storage.loadUserData(req.user.username);
    data.settings.security.twoFactorEnabled = false;
    data.settings.security.twoFactorSecret = '';
    data.settings.security.pendingTwoFactorSecret = '';
    await storage.saveUserData(req.user.username, data);
    res.json({ success: true });
  });

  app.post('/api/change-password', auth.authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing password fields' });
    }

    const ok = await auth.verifyAdminPassword(currentPassword);
    if (!ok) return res.status(401).json({ message: 'Invalid current password' });

    await auth.changeAdminPassword(newPassword);
    res.json({ success: true });
  });

  // Health check
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
};
