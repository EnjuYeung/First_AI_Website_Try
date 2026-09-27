import { sameNameCount, matchesSubscription } from '../../shared/notificationIdentity.js';
import { rollForwardActiveSubscriptions } from '../../shared/billingDate.js';
import { normalizeSettings } from '../../shared/settingsNormalization.js';
import { formatDateInTimeZone } from './dates.js';

const resolveSubscriptionForNotification = (subscriptions, record) => {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  const count = sameNameCount(list, record?.subscriptionName);
  return list.find(sub => matchesSubscription(record, sub, count)) || null;
};

const isPastYmd = (ymd, today) => {
  const value = String(ymd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value < today;
};

export const normalizeNotifications = (incoming, subscriptions, { today, nowMs }) => {
  const list = Array.isArray(incoming) ? incoming : [];
  const retentionCutoff = nowMs - 90 * 24 * 60 * 60 * 1000;
  const filtered = list.filter(
    (record) =>
      record?.type !== 'subscription_change' &&
      typeof record?.timestamp === 'number' &&
      record.timestamp >= retentionCutoff
  );
  return filtered.map((record) => {
    if (!record || typeof record !== 'object') return record;
    const details =
      record.details && typeof record.details === 'object' ? record.details : {};
    let nextDetails = details;
    if (record.type === 'renewal_reminder') {
      if (details !== record.details) {
        nextDetails = { ...nextDetails };
      }
      const feedback = String(details.renewalFeedback || '').trim();
      const needsBackfill = !feedback || feedback === 'pending' || feedback === '未确定';
      if (needsBackfill && isPastYmd(details.date, today)) {
        const sub = resolveSubscriptionForNotification(subscriptions, record);
        if (sub?.status === 'cancelled') {
          nextDetails = { ...nextDetails, renewalFeedback: 'deprecated' };
        } else if (sub?.status === 'active' && sub.nextBillingDate > details.date) {
          nextDetails = { ...nextDetails, renewalFeedback: 'renewed', autoRenewed: true };
        }
      }
      if (!feedback && !nextDetails.renewalFeedback) {
        nextDetails = { ...nextDetails, renewalFeedback: 'pending' };
      }
    } else if (details !== record.details) {
      nextDetails = { ...details };
    }
    if (nextDetails.receiver !== undefined) {
      const { receiver, ...rest } = nextDetails;
      nextDetails = rest;
    }
    if (nextDetails.frequency !== undefined) {
      const { frequency, ...rest } = nextDetails;
      nextDetails = rest;
    }
    if (nextDetails !== record.details) {
      return { ...record, details: nextDetails };
    }
    return record;
  });
};

/** Pure reconciliation. File IO and revision changes are owned by storage. */
export const reconcileUserData = (incoming, timeZone, now = new Date()) => {
  const today = formatDateInTimeZone(timeZone, now);
  const subscriptions = rollForwardActiveSubscriptions(
    Array.isArray(incoming.subscriptions) ? incoming.subscriptions : [], today,
  );
  return {
    subscriptions,
    notifications: normalizeNotifications(incoming.notifications, subscriptions, { today, nowMs: now.getTime() }),
    settings: normalizeSettings(incoming.settings, timeZone),
  };
};
