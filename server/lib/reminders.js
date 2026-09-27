import { configuredNotificationChannel, sendConfiguredNotification, deliverNotificationAttempt } from './notificationDelivery.js';
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
import { buildRenewalKeyboard } from './telegram.js';
import {
  findMonthlySummaryAttempt,
  findRenewalAttempt,
  safeErrorMessage,
} from './notificationRecords.js';

const randomId = () => crypto.randomUUID();

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
    const timeZone = settings.timezone;

    if (!reminderRule) return;

    const subs = data.subscriptions || [];
    for (const sub of subs) {
      if (!sub?.notificationsEnabled) continue;
      if (sub.status && sub.status !== 'active') continue;

      const days = daysUntilDate(sub.nextBillingDate, timeZone);
      if (!Number.isFinite(days)) continue;
      // Storage owns billing advancement and automatic feedback.
      if (days < 0) continue;
      if (days > reminderDays) continue;

      const templateStr =
        settings.notifications?.rules?.template || DEFAULT_REMINDER_TEMPLATE_STRING;
      const message = renderReminderTemplate(templateStr, sub);
      const dateLabel = sub.nextBillingDate || '';

      const attemptChannel = async (channel) => {
        const connection = configuredNotificationChannel(settings, 'renewalReminder', channel);
        if (!connection) return;

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

        await deliverNotificationAttempt({
          storage, username, record: recordBase, secret: connection.botToken,
          canClaim: current => {
            const currentSub = current.subscriptions?.find(candidate => candidate?.id === sub.id);
            const activeConnection = configuredNotificationChannel(current.settings, 'renewalReminder', channel);
            return currentSub?.status === 'active' && currentSub.notificationsEnabled &&
              currentSub.nextBillingDate === dateLabel &&
              JSON.stringify(activeConnection) === JSON.stringify(connection);
          },
          findExisting: current => findRenewalAttempt(current.notifications, sub, channel, current.subscriptions),
          send: recordId => sendConfiguredNotification({
            channel, connection, config, email, message, subject: '续订提醒通知',
            replyMarkup: buildRenewalKeyboard(recordId, dateLabel),
          }),
        });
      };

      await attemptChannel('telegram');
      await attemptChannel('email');
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

    const attemptChannel = async (channel) => {
      const connection = configuredNotificationChannel(settings, 'monthlySummary', channel);
      if (!connection) return;

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
      await deliverNotificationAttempt({
        storage, username, record: recordBase, secret: connection.botToken,
        canClaim: current => JSON.stringify(configuredNotificationChannel(current.settings, 'monthlySummary', channel)) === JSON.stringify(connection),
        findExisting: current => findMonthlySummaryAttempt(current.notifications, summary.periodKey, channel),
        send: () => sendConfiguredNotification({
          channel, connection, config, email, message, subject: `月度订阅总结 · ${summary.month}`,
        }),
      });
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
