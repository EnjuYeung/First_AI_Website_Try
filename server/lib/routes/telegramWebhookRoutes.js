import crypto from 'crypto';
import { DEFAULT_REMINDER_TEMPLATE_STRING } from '../../../shared/reminderTemplate.js';
import { addBillingCycleYMD } from '../../../shared/billingDate.js';
import {
  answerCallback,
  clearInlineKeyboard,
  createTelegramWebhookSecret,
} from '../telegram.js';
import { formatDateInTimeZone } from '../dates.js';
import {
  matchesSubscription,
  safeErrorMessage,
  sameNameCount,
  updateRenewalFeedback,
} from '../notificationRecords.js';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const TERMINAL_FEEDBACK = new Set(['renewed', 'deprecated']);

const extractName = (templateString, messageText) => {
  const parseLines = (value) => {
    try {
      const parsed = JSON.parse(value || '');
      return Array.isArray(parsed?.lines) ? parsed.lines : [];
    } catch {
      return [];
    }
  };
  const lines = parseLines(templateString);
  const templates = lines.length ? lines : parseLines(DEFAULT_REMINDER_TEMPLATE_STRING);
  for (const template of templates) {
    if (typeof template !== 'string' || !template.includes('{{name}}')) continue;
    const [prefix, ...suffixParts] = template.split('{{name}}');
    const suffix = suffixParts.join('{{name}}');
    const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escape(prefix)}(.+?)${escape(suffix)}$`);
    for (const line of String(messageText || '').split('\n')) {
      const match = pattern.exec(line);
      if (match?.[1]) return match[1].trim();
    }
  }
  const flat = String(messageText || '').replace(/\s+/g, ' ').trim();
  return (
    /订阅\s*(.+?)\s*即将续费/.exec(flat)?.[1]?.trim() ||
    /Subscription\s*(.+?)\s*(?:is\s*)?(?:about\s+to|will)\s+renew/i.exec(flat)?.[1]?.trim() ||
    ''
  );
};

const findUnique = (items, predicate) => {
  const matches = (items || []).filter(predicate);
  return matches.length === 1 ? matches[0] : null;
};

const findLegacySubscription = (subscriptions, rawId, messageText, template) => {
  const byId = findUnique(subscriptions, (sub) => sub?.id === rawId);
  if (byId) return byId;
  const name = rawId || extractName(template, messageText);
  if (!name) return null;
  return findUnique(subscriptions, (sub) => sub?.name === name);
};

const isTelegramReminder = (record) =>
  record?.type === 'renewal_reminder' &&
  record?.channel === 'telegram' &&
  (record?.status === 'success' ||
    ['attempting', 'delivered', 'unknown'].includes(record?.details?.deliveryState));

const selectLegacyRecord = (current, subscription, messageText) => {
  const nameCount = sameNameCount(current.subscriptions, subscription.name);
  const candidates = (current.notifications || []).filter(
    (record) =>
      isTelegramReminder(record) &&
      matchesSubscription(record, subscription, nameCount) &&
      YMD_RE.test(String(record.details?.date || ''))
  );
  if (candidates.length === 1) return candidates[0];

  if (messageText) {
    const byMessage = candidates.filter(
      (record) => record.details?.message === messageText
    );
    if (byMessage.length === 1) return byMessage[0];
  }
  return null;
};

const resolveTarget = (current, callbackData, messageText) => {
  const parts = String(callbackData || '').split('|');
  if (parts.length < 2) return null;

  if (parts.length === 3 && YMD_RE.test(parts[2])) {
    const [, notificationId, expectedDate] = parts;
    const record = (current.notifications || []).find(
      (candidate) =>
        candidate?.id === notificationId &&
        isTelegramReminder(candidate) &&
        candidate.details?.date === expectedDate
    );
    const subscriptionId = record?.details?.subscriptionId;
    const subscription = subscriptionId
      ? (current.subscriptions || []).find((candidate) => candidate?.id === subscriptionId)
      : null;
    return record && subscription ? { record, subscription, expectedDate } : null;
  }

  const rawId = parts.slice(1).join('|');
  const subscription = findLegacySubscription(
    current.subscriptions,
    rawId,
    messageText,
    current.settings?.notifications?.rules?.template
  );
  if (!subscription) return null;
  const record = selectLegacyRecord(current, subscription, messageText);
  return record
    ? { record, subscription, expectedDate: record.details.date }
    : null;
};

const boundedCallbackId = (value) =>
  typeof value === 'string' && value.length <= 256 ? value : '';

const safeUpdateId = (value) => (Number.isSafeInteger(value) ? value : undefined);

const secretsMatch = (actual, expected) => {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

export const registerTelegramWebhookRoutes = ({ app, auth, storage, config }) => {
  app.post('/api/telegram/webhook', async (req, res) => {
    const callback = req.body?.callback_query;
    const callbackId = boundedCallbackId(callback?.id);
    const updateId = safeUpdateId(req.body?.update_id);
    let botToken = '';
    try {
      const username = auth.getAdminUsername();
      const initial = await storage.loadUserData(username);
      const telegram = initial.settings?.notifications?.telegram || {};
      botToken = telegram.botToken || '';
      const expectedSecret = createTelegramWebhookSecret(config?.jwtSecret, telegram.botToken);
      const incomingSecret = req.get?.('x-telegram-bot-api-secret-token')
        || req.headers?.['x-telegram-bot-api-secret-token'];
      if (!telegram.botToken || !secretsMatch(incomingSecret, expectedSecret)) {
        return res.status(403).json({ ok: false, message: 'invalid_webhook_secret' });
      }
      if (!callback?.data) return res.json({ ok: true, message: 'ignored' });
      if (!callbackId || String(callback.data).length > 256) {
        return res.json({ ok: false, message: 'invalid_callback' });
      }

      const [action] = String(callback.data).split('|');
      if (!['renewed', 'deprecated'].includes(action)) {
        await answerCallback(telegram.botToken, callbackId, '无效操作');
        return res.json({ ok: false, message: 'invalid_action' });
      }

      let outcome = 'subscription_not_found';
      let resultingStatus = null;
      await storage.updateUserData(username, (current) => {
        if (current.settings?.notifications?.telegram?.botToken !== telegram.botToken) {
          throw new Error('invalid_token');
        }
        const processedIdentifier = (current.notifications || []).find(
          (record) =>
            TERMINAL_FEEDBACK.has(String(record?.details?.renewalFeedback || '')) &&
            ((updateId !== undefined && record.details?.telegramUpdateId === updateId) ||
              record.details?.telegramCallbackId === callbackId)
        );
        if (processedIdentifier) {
          outcome =
            processedIdentifier.details.renewalFeedback === action
              ? 'already_processed'
              : 'stale_callback';
          return current;
        }
        const target = resolveTarget(current, callback.data, callback.message?.text);
        if (!target) return current;

        const { record, subscription, expectedDate } = target;
        const previousFeedback = String(record.details?.renewalFeedback || '');
        const hasCallbackMarker =
          !!record.details?.telegramCallbackId ||
          Number.isSafeInteger(record.details?.telegramUpdateId);
        if (
          TERMINAL_FEEDBACK.has(previousFeedback) &&
          (hasCallbackMarker ||
            subscription.status !== 'active' ||
            subscription.nextBillingDate !== expectedDate)
        ) {
          outcome = previousFeedback === action ? 'already_processed' : 'stale_callback';
          resultingStatus = subscription.status;
          return current;
        }
        if (
          subscription.status !== 'active' ||
          subscription.nextBillingDate !== expectedDate
        ) {
          outcome = 'stale_callback';
          resultingStatus = subscription.status;
          return current;
        }

        if (action === 'renewed') {
          const nextBillingDate = addBillingCycleYMD(
            expectedDate,
            subscription.frequency,
            subscription.startDate || expectedDate
          );
          if (!nextBillingDate || nextBillingDate === expectedDate) {
            outcome = 'stale_callback';
            return current;
          }
          subscription.status = 'active';
          delete subscription.cancelledAt;
          subscription.nextBillingDate = nextBillingDate;
        } else {
          subscription.status = 'cancelled';
          subscription.cancelledAt = formatDateInTimeZone(
            current.settings?.timezone,
            new Date()
          );
          subscription.nextBillingDate = '';
        }

        updateRenewalFeedback(
          current.notifications,
          subscription,
          expectedDate,
          action,
          current.subscriptions
        );
        record.details = {
          ...record.details,
          renewalFeedback: action,
          subscriptionId: subscription.id,
          telegramCallbackId: callbackId,
          telegramProcessedAt: Date.now(),
          ...(updateId === undefined ? {} : { telegramUpdateId: updateId }),
        };
        outcome = 'updated';
        resultingStatus = subscription.status;
        return current;
      });

      const callbackText = {
        updated: resultingStatus === 'cancelled' ? '已标记为已弃用' : '已标记为已续订',
        already_processed: '该提醒已处理',
        stale_callback: '该提醒已处理或账期已变化',
        subscription_not_found: '找不到对应的订阅记录',
      }[outcome];
      await answerCallback(telegram.botToken, callbackId, callbackText);
      if (callback.message?.chat?.id && callback.message?.message_id) {
        await clearInlineKeyboard(
          telegram.botToken,
          callback.message.chat.id,
          callback.message.message_id
        );
      }

      if (outcome === 'updated') return res.json({ ok: true });
      if (outcome === 'already_processed') {
        return res.json({ ok: true, message: 'already_processed' });
      }
      if (outcome === 'stale_callback') {
        return res.json({ ok: false, message: 'stale_callback' });
      }
      return res.json({ ok: false, message: 'subscription_not_found' });
    } catch (err) {
      console.error('Telegram callback error', {
        message: safeErrorMessage(err, botToken),
        ...(updateId === undefined ? {} : { updateId }),
      });
      res.status(500).json({ ok: false, message: 'server_error' });
    }
  });
};
