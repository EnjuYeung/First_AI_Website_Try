import {
  daysUntilDate,
  formatDateInTimeZone,
  getTimePartsInTimeZone,
} from './dates.js';
import {
  renderReminderTemplate,
  DEFAULT_REMINDER_TEMPLATE_STRING,
} from '../../shared/reminderTemplate.js';
import {
  DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING,
  renderMonthlySummaryTemplate,
} from '../../shared/monthlySummaryTemplate.js';
import { buildMonthlySummary, previousMonthPeriod } from './monthlySummary.js';
import {
  createTelegramWebhookSecret,
  sendTelegramMessage,
  ensureTelegramWebhook,
} from './telegram.js';
import {
  findMonthlySummaryAttempt,
  findRenewalAttempt,
  isBlockingDeliveryAttempt,
  safeErrorMessage,
  updateRenewalFeedback,
} from './notificationRecords.js';

const randomId = () => crypto.randomUUID();

const buildInlineKeyboard = (notificationId, billingDate) => ({
  inline_keyboard: [
    [
      { text: '✅ 已续订', callback_data: `renewed|${notificationId}|${billingDate}` },
      { text: '🛑 已弃用', callback_data: `deprecated|${notificationId}|${billingDate}` },
    ],
  ],
});

const normalizeBaseUrl = (value) =>
  String(value || '')
    .trim()
    .replace(/\/+$/, '');

export const createReminders = ({ config, storage, email }) => {
  let reminderTimer = null;
  let reminderRunning = false;

  const processRenewalReminders = async () => {
    const username = config.adminUser;
    let data;
    try {
      data = await storage.loadUserData(username);
    } catch (err) {
      console.error('Failed to load user data for reminders', safeErrorMessage(err));
      return;
    }

    const settings = data.settings;
    const reminderRule = settings.notifications?.rules?.renewalReminder;
    const reminderDays = Number(settings.notifications?.rules?.reminderDays ?? 3);
    const ruleChannels = settings.notifications?.rules?.channels;
    const webhookBaseUrl = normalizeBaseUrl(config.publicBaseUrl);
    const telegramWebhookUrl = webhookBaseUrl
      ? `${webhookBaseUrl}/api/telegram/webhook`
      : '';
    const timeZone = settings.timezone;

    const telegramConfig = settings.notifications?.telegram || {};
    let telegramWebhookReady = false;
    if (telegramWebhookUrl && telegramConfig.enabled && telegramConfig.botToken) {
      const secretToken = createTelegramWebhookSecret(
        config.jwtSecret,
        telegramConfig.botToken
      );
      try {
        await ensureTelegramWebhook(
          { debug: config.debugTelegram, secretToken },
          telegramConfig.botToken,
          telegramWebhookUrl
        );
        telegramWebhookReady = true;
      } catch (err) {
        console.error(
          'Failed to ensure Telegram webhook',
          safeErrorMessage(err, telegramConfig.botToken)
        );
      }
    }

    if (!reminderRule) return;

    const subs = data.subscriptions || [];
    const overdueSubs = [];
    for (const sub of subs) {
      if (!sub?.notificationsEnabled) continue;
      if (sub.status && sub.status !== 'active') continue;

      const days = daysUntilDate(sub.nextBillingDate, timeZone);
      if (!Number.isFinite(days)) continue;
      if (days < 0) {
        overdueSubs.push(sub);
        continue;
      }
      if (days > reminderDays) continue;

      const templateStr =
        settings.notifications?.rules?.template || DEFAULT_REMINDER_TEMPLATE_STRING;
      const message = renderReminderTemplate(templateStr, sub);
      const dateLabel = sub.nextBillingDate || '';

      const attemptChannel = async (channel) => {
        if (channel === 'telegram') {
          const { enabled, botToken, chatId } = settings.notifications?.telegram || {};
          const allowed = (ruleChannels?.renewalReminder || []).includes('telegram');
          if (!enabled || !botToken || !chatId || !allowed) return;
        } else if (channel === 'email') {
          const { enabled, emailAddress } = settings.notifications?.email || {};
          const allowed = (ruleChannels?.renewalReminder || []).includes('email');
          if (!enabled || !emailAddress || !allowed) return;
        } else {
          return;
        }

        const timestamp = Date.now();
        const recordBase = {
          id: randomId(),
          subscriptionName: sub.name,
          type: 'renewal_reminder',
          channel,
          timestamp,
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

        let claimed = false;
        try {
          await storage.updateUserData(username, (current) => {
            const currentSub = (current.subscriptions || []).find(
              (candidate) => candidate?.id === sub.id
            );
            if (
              !currentSub ||
              currentSub.status !== 'active' ||
              !currentSub.notificationsEnabled ||
              currentSub.nextBillingDate !== dateLabel
            ) {
              return current;
            }
            const existing = findRenewalAttempt(
              current.notifications,
              currentSub,
              channel,
              current.subscriptions
            );
            if (existing && isBlockingDeliveryAttempt(existing)) return current;
            if (!Array.isArray(current.notifications)) current.notifications = [];
            const attemptDetails = {
              ...recordBase.details,
              deliveryState: 'attempting',
              deliveryAttemptedAt: timestamp,
            };
            if (existing) {
              recordBase.id = existing.id;
              existing.status = 'failed';
              existing.timestamp = timestamp;
              existing.details = {
                ...existing.details,
                ...attemptDetails,
              };
            } else {
              current.notifications.push({
                ...recordBase,
                status: 'failed',
                details: attemptDetails,
              });
            }
            claimed = true;
            return current;
          });
        } catch (err) {
          console.error('Failed to persist notification attempt', safeErrorMessage(err));
          return;
        }
        if (!claimed) return;

        let deliveryStatus = 'success';
        let deliveryState = 'delivered';
        let deliveryError = '';
        try {
          if (channel === 'telegram') {
            const { botToken, chatId } = settings.notifications.telegram;
            const replyMarkup = telegramWebhookReady
              ? buildInlineKeyboard(recordBase.id, dateLabel)
              : null;
            await sendTelegramMessage(
              { debug: config.debugTelegram },
              botToken,
              chatId,
              message,
              replyMarkup
            );
          } else {
            const { emailAddress } = settings.notifications.email;
            await email.sendEmailMessage(emailAddress, '续订提醒通知', message);
          }
        } catch (err) {
          deliveryStatus = 'failed';
          const secret =
            channel === 'telegram' ? settings.notifications.telegram.botToken : '';
          deliveryError = safeErrorMessage(err, secret);
          deliveryState =
            channel === 'telegram' &&
            (deliveryError === 'telegram_timeout' ||
              deliveryError.endsWith('_request_failed'))
              ? 'unknown'
              : 'failed';
        }

        try {
          await storage.updateUserData(username, (current) => {
            const record = (current.notifications || []).find(
              (candidate) => candidate?.id === recordBase.id
            );
            if (!record) return current;
            record.status = deliveryStatus;
            record.details = {
              ...record.details,
              deliveryState,
              deliveryCompletedAt: Date.now(),
            };
            if (deliveryError) record.details.errorReason = deliveryError;
            else delete record.details.errorReason;
            return current;
          });
        } catch (err) {
          const secret =
            channel === 'telegram' ? settings.notifications.telegram.botToken : '';
          console.error(
            'Failed to finalize notification attempt',
            safeErrorMessage(err, secret)
          );
        }
      };

      await attemptChannel('telegram');
      await attemptChannel('email');
    }

    if (overdueSubs.length) {
      try {
        await storage.updateUserData(username, (current) => {
          overdueSubs.forEach((sub) => {
            const currentSub = (current.subscriptions || []).find(
              (candidate) => candidate?.id === sub.id
            );
            if (!currentSub || currentSub.nextBillingDate !== sub.nextBillingDate) return;
            updateRenewalFeedback(
              current.notifications,
              currentSub,
              currentSub.nextBillingDate,
              'pending',
              current.subscriptions,
              { onlyIfEmpty: true }
            );
          });
          return current;
        });
      } catch (err) {
        console.error('Failed to persist renewal feedback', safeErrorMessage(err));
      }
    }
  };

  const processMonthlySummaries = async (now = new Date()) => {
    const username = config.adminUser;
    let data;
    try {
      data = await storage.loadUserData(username);
    } catch (err) {
      console.error('Failed to load user data for monthly summary', safeErrorMessage(err));
      return;
    }

    const settings = data.settings || {};
    const rules = settings.notifications?.rules || {};
    if (!rules.monthlySummary) return;

    const timeZone = settings.timezone || config.timeZone || 'Asia/Shanghai';
    const today = formatDateInTimeZone(timeZone, now);
    const { hour } = getTimePartsInTimeZone(timeZone, now);
    if (!today.endsWith('-01') || hour < 9) return;

    const period = previousMonthPeriod(timeZone, now);
    const summary = buildMonthlySummary(data.subscriptions, settings, period);
    const template = rules.monthlySummaryTemplate || DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING;
    const message = renderMonthlySummaryTemplate(template, summary);
    const selectedChannels = rules.channels?.monthlySummary || [];

    const attemptChannel = async (channel) => {
      if (channel === 'telegram') {
        const { enabled, botToken, chatId } = settings.notifications?.telegram || {};
        if (!enabled || !botToken || !chatId || !selectedChannels.includes(channel)) return;
      } else if (channel === 'email') {
        const { enabled, emailAddress } = settings.notifications?.email || {};
        if (!enabled || !emailAddress || !selectedChannels.includes(channel)) return;
      } else {
        return;
      }

      const timestamp = now.getTime();
      const recordBase = {
        id: randomId(),
        subscriptionName: `${summary.month} 月度总结`,
        type: 'monthly_summary',
        channel,
        timestamp,
        details: {
          periodKey: summary.periodKey,
          message,
          amount: summary.totalPaidUsd,
          currency: 'USD',
        },
      };
      let claimed = false;
      try {
        await storage.updateUserData(username, (current) => {
          const currentRules = current.settings?.notifications?.rules;
          if (
            !currentRules?.monthlySummary ||
            !(currentRules.channels?.monthlySummary || []).includes(channel)
          ) return current;
          const existing = findMonthlySummaryAttempt(
            current.notifications,
            summary.periodKey,
            channel
          );
          if (existing && isBlockingDeliveryAttempt(existing)) return current;
          if (!Array.isArray(current.notifications)) current.notifications = [];
          const attemptDetails = {
            ...recordBase.details,
            deliveryState: 'attempting',
            deliveryAttemptedAt: timestamp,
          };
          if (existing) {
            recordBase.id = existing.id;
            existing.status = 'failed';
            existing.timestamp = timestamp;
            existing.details = {
              ...existing.details,
              ...attemptDetails,
            };
          } else {
            current.notifications.push({
              ...recordBase,
              status: 'failed',
              details: attemptDetails,
            });
          }
          claimed = true;
          return current;
        });
      } catch (err) {
        console.error('Failed to persist monthly summary attempt', safeErrorMessage(err));
        return;
      }
      if (!claimed) return;

      let deliveryStatus = 'success';
      let deliveryState = 'delivered';
      let deliveryError = '';
      try {
        if (channel === 'telegram') {
          const { botToken, chatId } = settings.notifications.telegram;
          await sendTelegramMessage(
            { debug: config.debugTelegram },
            botToken,
            chatId,
            message,
            null,
          );
        } else {
          await email.sendEmailMessage(
            settings.notifications.email.emailAddress,
            `月度订阅总结 · ${summary.month}`,
            message,
          );
        }
      } catch (err) {
        deliveryStatus = 'failed';
        const secret = channel === 'telegram' ? settings.notifications.telegram.botToken : '';
        deliveryError = safeErrorMessage(err, secret);
        deliveryState = channel === 'telegram' &&
          (deliveryError === 'telegram_timeout' || deliveryError.endsWith('_request_failed'))
          ? 'unknown'
          : 'failed';
      }

      try {
        await storage.updateUserData(username, (current) => {
          const record = (current.notifications || []).find(
            (candidate) => candidate?.id === recordBase.id,
          );
          if (!record) return current;
          record.status = deliveryStatus;
          record.details = {
            ...record.details,
            deliveryState,
            deliveryCompletedAt: Date.now(),
          };
          if (deliveryError) record.details.errorReason = deliveryError;
          else delete record.details.errorReason;
          return current;
        });
      } catch (err) {
        const secret = channel === 'telegram' ? settings.notifications.telegram.botToken : '';
        console.error('Failed to finalize monthly summary attempt', safeErrorMessage(err, secret));
      }
    };

    await attemptChannel('telegram');
    await attemptChannel('email');
  };

  const startReminderScheduler = () => {
    if (reminderTimer) return;

    const tick = async () => {
      if (reminderRunning) return;
      reminderRunning = true;
      try {
        await processRenewalReminders();
      } catch (err) {
        console.error('Renewal reminder tick failed', safeErrorMessage(err));
      }
      try {
        await processMonthlySummaries();
      } catch (err) {
        console.error('Monthly summary tick failed', safeErrorMessage(err));
      } finally {
        reminderRunning = false;
      }
    };

    tick();
    reminderTimer = setInterval(tick, config.notifyIntervalMs);
  };

  return { startReminderScheduler, processRenewalReminders, processMonthlySummaries };
};
