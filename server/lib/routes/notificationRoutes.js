import { renderReminderTemplate, DEFAULT_REMINDER_TEMPLATE_STRING } from '../../../shared/reminderTemplate.js';
import {
  DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING,
  renderMonthlySummaryTemplate,
} from '../../../shared/monthlySummaryTemplate.js';
import {
  sendTelegramMessage,
} from '../telegram.js';
import { formatDateInTimeZone } from '../dates.js';

export const registerNotificationRoutes = ({ app, config, auth, storage }) => {
  app.post('/api/notifications/test-telegram', auth.authMiddleware, async (req, res) => {
    try {
      const data = await storage.loadUserData(req.user.username);
      const settings = data.settings;
      const { enabled, botToken, chatId } = settings.notifications?.telegram || {};
      if (!enabled || !botToken || !chatId) {
        return res.status(400).json({ ok: false, message: 'telegram_not_configured' });
      }
      const templateType = req.body?.templateType === 'monthlySummary'
        ? 'monthlySummary'
        : 'renewalReminder';
      const template = req.body?.template;
      const message = templateType === 'monthlySummary'
        ? renderMonthlySummaryTemplate(
            template || settings.notifications.rules.monthlySummaryTemplate || DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING,
            {
              month: '2026年7月',
              totalPaidUsd: 42.5,
              activeSubscriptions: 8,
              newSubscriptions: '月付 2 个',
              cancelledSubscriptions: 1,
            },
          )
        : renderReminderTemplate(template || settings.notifications.rules.template || DEFAULT_REMINDER_TEMPLATE_STRING, {
            name: '测试订阅',
            nextBillingDate: formatDateInTimeZone(config.timeZone),
            price: '0.00',
            currency: '',
            paymentMethod: '测试支付方式',
          });
      await sendTelegramMessage({ debug: config.debugTelegram }, botToken, chatId, message);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ ok: false, message: err?.message || 'telegram_test_failed' });
    }
  });
};
