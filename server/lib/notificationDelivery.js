import { isBlockingDeliveryAttempt, safeErrorMessage } from './notificationRecords.js';
import { sendTelegramMessage } from './telegram.js';

export const configuredNotificationChannel = (settings, rule, channel) => {
  const notifications = settings?.notifications;
  if (!notifications?.rules?.[rule] || !notifications.rules.channels?.[rule]?.includes(channel)) return null;
  const connection = notifications[channel];
  if (!connection?.enabled) return null;
  if (channel === 'telegram' && connection.botToken && connection.chatId) return connection;
  if (channel === 'email' && connection.emailAddress) return connection;
  return null;
};

export const sendConfiguredNotification = ({ channel, connection, config, email, message, subject, replyMarkup }) => {
  if (channel === 'telegram') {
    return sendTelegramMessage({ debug: config.debugTelegram }, connection.botToken, connection.chatId, message, replyMarkup);
  }
  return email.sendEmailMessage(connection.emailAddress, subject, message);
};

/** Claim durably before sending. Ambiguous delivery and failed finalization block retries. */
export const deliverNotificationAttempt = async ({
  storage, username, record, canClaim, findExisting, send, secret = '',
}) => {
  let claimed = false;
  let recordId = record.id;
  try {
    await storage.updateUserData(username, current => {
      if (!canClaim(current)) return current;
      const existing = findExisting(current);
      if (existing && isBlockingDeliveryAttempt(existing)) return current;
      if (!Array.isArray(current.notifications)) current.notifications = [];
      const details = { ...record.details, deliveryState: 'attempting', deliveryAttemptedAt: record.timestamp };
      if (existing) {
        recordId = existing.id;
        existing.status = 'failed';
        existing.timestamp = record.timestamp;
        existing.details = { ...existing.details, ...details };
        delete existing.details.errorReason;
        delete existing.details.deliveryCompletedAt;
      } else {
        current.notifications.push({ ...record, status: 'failed', details });
      }
      claimed = true;
      return current;
    });
  } catch (error) {
    console.error('Failed to persist notification attempt', safeErrorMessage(error, secret));
    return { state: 'unpersisted' };
  }
  if (!claimed) return { state: 'skipped' };

  let state = 'delivered';
  let errorReason = '';
  try { await send(recordId); }
  catch (error) {
    errorReason = safeErrorMessage(error, secret);
    state = record.channel === 'telegram' &&
      (errorReason === 'telegram_timeout' || errorReason.endsWith('_request_failed')) ? 'unknown' : 'failed';
  }
  try {
    await storage.updateUserData(username, current => {
      const saved = (current.notifications || []).find(candidate => candidate?.id === recordId);
      if (!saved) return current;
      saved.status = state === 'delivered' ? 'success' : 'failed';
      saved.details = { ...saved.details, deliveryState: state, deliveryCompletedAt: Date.now() };
      if (errorReason) saved.details.errorReason = errorReason;
      else delete saved.details.errorReason;
      return current;
    });
  } catch (error) {
    console.error('Failed to finalize notification attempt', safeErrorMessage(error, secret));
    return { state: 'unfinalized', recordId };
  }
  return { state, recordId };
};
