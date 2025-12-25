import crypto from 'crypto';
import { daysUntilDate } from './dates.js';
import { renderReminderTemplate, DEFAULT_REMINDER_TEMPLATE_STRING } from '../../shared/reminderTemplate.js';
import { sendTelegramMessage, ensureTelegramWebhook } from './telegram.js';

const randomId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const buildInlineKeyboard = (subscriptionId) => ({
  inline_keyboard: [
    [
      { text: '✅ 已续订', callback_data: `renewed|${subscriptionId}` },
      { text: '🛑 已弃用', callback_data: `deprecated|${subscriptionId}` },
    ],
  ],
});

const normalizeBaseUrl = (value) =>
  String(value || '')
    .trim()
    .replace(/\/+$/, '');

const notificationAlreadySent = (notifications, subscription, channel) => {
  return (notifications || []).some(
    (n) =>
      n.type === 'renewal_reminder' &&
      ((n.details?.subscriptionId && subscription.id && n.details.subscriptionId === subscription.id) ||
        n.subscriptionName === subscription.name) &&
      n.channel === channel &&
      n.status === 'success' &&
      n.details?.date === subscription.nextBillingDate
  );
};

const updateRenewalFeedback = (notifications, subscription, dateLabel, feedback, { onlyIfEmpty = false } = {}) => {
  if (!dateLabel) return false;
  let updated = false;
  (notifications || []).forEach((record) => {
    if (record.type !== 'renewal_reminder') return;
    if (record.details?.date !== dateLabel) return;
    const matchesId = record.details?.subscriptionId && subscription.id
      ? record.details.subscriptionId === subscription.id
      : record.subscriptionName === subscription.name;
    if (!matchesId) return;
    if (onlyIfEmpty && record.details?.renewalFeedback) return;
    record.details = {
      ...record.details,
      renewalFeedback: feedback,
      subscriptionId: record.details?.subscriptionId || subscription.id,
    };
    updated = true;
  });
  return updated;
};

export const createReminders = ({ config, storage, email }) => {
  let reminderTimer = null;
  let reminderRunning = false;

  const processRenewalReminders = async () => {
    const username = config.adminUser;
    let data;
    try {
      data = await storage.loadUserData(username);
    } catch (err) {
      console.error('Failed to load user data for reminders', err);
      return;
    }

    const settings = data.settings;
    const reminderRule = settings.notifications?.rules?.renewalReminder;
    const reminderDays = Number(settings.notifications?.rules?.reminderDays ?? 3);
    const ruleChannels = settings.notifications?.rules?.channels;
    const webhookBaseUrl = normalizeBaseUrl(config.publicBaseUrl);

    if (!reminderRule) return;

    const subs = data.subscriptions || [];
    let changed = false;

    for (const sub of subs) {
      if (!sub?.notificationsEnabled) continue;
      if (sub.status && sub.status !== 'active') continue;

      const days = daysUntilDate(sub.nextBillingDate);
      if (days < 0) {
        const feedbackUpdated = updateRenewalFeedback(
          data.notifications,
          sub,
          sub.nextBillingDate,
          'pending',
          { onlyIfEmpty: true }
        );
        if (feedbackUpdated) changed = true;
        continue;
      }
      if (days > reminderDays) continue;

      const templateStr =
        settings.notifications?.rules?.template || DEFAULT_REMINDER_TEMPLATE_STRING;
      const message = renderReminderTemplate(templateStr, sub);
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
            message,
            subscriptionId: sub.id,
            renewalFeedback: 'pending',
          },
        };

        if (notificationAlreadySent(data.notifications, sub, channel)) return;

        try {
          if (channel === 'telegram') {
            const { enabled, botToken, chatId } = settings.notifications?.telegram || {};
            const allowed = (ruleChannels?.renewalReminder || []).includes('telegram');
            if (!enabled || !botToken || !chatId || !allowed) return;
            if (webhookBaseUrl) {
              const webhookUrl = `${webhookBaseUrl}/api/telegram/webhook/${botToken}`;
              try {
                await ensureTelegramWebhook({ debug: config.debugTelegram }, botToken, webhookUrl);
              } catch (err) {
                console.error('Failed to ensure Telegram webhook', err);
              }
            }
            const replyMarkup = buildInlineKeyboard(sub.id || sub.name || 'unknown');
            await sendTelegramMessage({ debug: config.debugTelegram }, botToken, chatId, message, replyMarkup);
          } else if (channel === 'email') {
            const { enabled, emailAddress } = settings.notifications?.email || {};
            const allowed = (ruleChannels?.renewalReminder || []).includes('email');
            if (!enabled || !emailAddress || !allowed) return;
            await email.sendEmailMessage(emailAddress, '续订提醒通知', message);
          } else {
            return;
          }

          data.notifications.push({ ...recordBase, status: 'success' });
          changed = true;
        } catch (err) {
          data.notifications.push({
            ...recordBase,
            status: 'failed',
            details: { ...recordBase.details, errorReason: err?.message || 'unknown_error' },
          });
          changed = true;
        }
      };

      await attemptChannel('telegram');
      await attemptChannel('email');
    }

    if (changed) {
      try {
        await storage.saveUserData(username, data);
      } catch (err) {
        console.error('Failed to persist notifications history', err);
      }
    }
  };

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

    tick();
    reminderTimer = setInterval(tick, config.notifyIntervalMs);
  };

  return { startReminderScheduler, processRenewalReminders };
};
