export const sameNameCount = (subscriptions, name) =>
  (subscriptions || []).filter((candidate) => candidate?.name === name).length;

export const matchesSubscription = (record, subscription, nameCount) => {
  const recordSubscriptionId = record?.details?.subscriptionId;
  if (recordSubscriptionId && subscription?.id) {
    return recordSubscriptionId === subscription.id;
  }
  if (recordSubscriptionId || !subscription?.name) return false;
  return nameCount === 1 && record?.subscriptionName === subscription.name;
};

export const updateRenewalFeedback = (
  notifications,
  subscription,
  dateLabel,
  feedback,
  subscriptions,
  { onlyIfEmpty = false } = {}
) => {
  if (!dateLabel) return false;
  let updated = false;
  const nameCount = sameNameCount(subscriptions, subscription.name);
  (notifications || []).forEach((record) => {
    if (record.type !== 'renewal_reminder') return;
    if (record.details?.date !== dateLabel) return;
    if (!matchesSubscription(record, subscription, nameCount)) return;
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

export const safeErrorMessage = (err, secret = '') => {
  let message = String(err?.message || 'unknown_error');
  for (const value of [secret, encodeURIComponent(secret || '')]) {
    if (value) message = message.split(value).join('[redacted]');
  }
  return message;
};

export const isBlockingDeliveryAttempt = (record) =>
  record?.status === 'success' ||
  ['attempting', 'delivered', 'unknown'].includes(record?.details?.deliveryState);

export const findRenewalAttempt = (notifications, subscription, channel, subscriptions) => {
  const nameCount = sameNameCount(subscriptions, subscription.name);
  return (notifications || []).find(
    (record) =>
      record.type === 'renewal_reminder' &&
      matchesSubscription(record, subscription, nameCount) &&
      record.channel === channel &&
      record.details?.date === subscription.nextBillingDate
  );
};

export const findMonthlySummaryAttempt = (notifications, periodKey, channel) =>
  (notifications || []).find(
    (record) =>
      record.type === 'monthly_summary' &&
      record.channel === channel &&
      record.details?.periodKey === periodKey
  );
