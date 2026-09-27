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
