import { renderReminderTemplate, DEFAULT_REMINDER_TEMPLATE_STRING } from '../../../shared/reminderTemplate.js';
import { sendTelegramMessage, ensureTelegramWebhook } from '../telegram.js';

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const resolveWebhookBaseUrl = (req, config) => {
  if (config.publicBaseUrl) return normalizeBaseUrl(config.publicBaseUrl);
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = (req.get('x-forwarded-proto') || req.protocol || '').split(',')[0].trim();
  return host && proto ? normalizeBaseUrl(`${proto}://${host}`) : '';
};

export const registerNotificationRoutes = ({ app, config, auth, storage }) => {
  app.post('/api/notifications/test-telegram', auth.authMiddleware, async (req, res) => {
    try {
      const data = await storage.loadUserData(req.user.username);
      const settings = data.settings;
      const { enabled, botToken, chatId } = settings.notifications?.telegram || {};
      if (!enabled || !botToken || !chatId) {
        return res.status(400).json({ ok: false, message: 'telegram_not_configured' });
      }
      const baseUrl = resolveWebhookBaseUrl(req, config);
      if (!baseUrl) {
        return res.status(400).json({ ok: false, message: 'telegram_webhook_url_missing' });
      }
      await ensureTelegramWebhook(
        { debug: config.debugTelegram },
        botToken,
        `${baseUrl}/api/telegram/webhook/${botToken}`
      );
      const template = req.body?.template || settings.notifications.rules.template;
      const message = renderReminderTemplate(template || DEFAULT_REMINDER_TEMPLATE_STRING, {
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
};
