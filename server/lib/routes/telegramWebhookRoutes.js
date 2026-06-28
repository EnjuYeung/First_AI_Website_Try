import { DEFAULT_REMINDER_TEMPLATE_STRING } from '../../../shared/reminderTemplate.js';
import { answerCallback, clearInlineKeyboard } from '../telegram.js';
import { parseLocalYMD, formatLocalYMD } from '../dates.js';

const addFrequencyToDate = (ymd, frequency) => {
  const date = parseLocalYMD(ymd);
  if (Number.isNaN(date.getTime())) return '';
  const months = { Monthly: 1, Quarterly: 3, 'Semi-Annually': 6 };
  if (months[frequency]) date.setMonth(date.getMonth() + months[frequency]);
  else if (frequency === 'Yearly') date.setFullYear(date.getFullYear() + 1);
  else return '';
  return formatLocalYMD(date);
};

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

const findSubscription = (subscriptions, rawId, messageText, template) =>
  subscriptions.find((sub) => sub.id === rawId) ||
  subscriptions.find((sub) => sub.name === rawId) ||
  subscriptions.find((sub) => sub.name === extractName(template, messageText));

const updateFeedback = (notifications, subscription, date, feedback) => {
  notifications.forEach((record) => {
    const sameSubscription = record.details?.subscriptionId
      ? record.details.subscriptionId === subscription.id
      : record.subscriptionName === subscription.name;
    if (record.type === 'renewal_reminder' && record.details?.date === date && sameSubscription) {
      record.details = { ...record.details, renewalFeedback: feedback, subscriptionId: subscription.id };
    }
  });
};

export const registerTelegramWebhookRoutes = ({ app, auth, storage }) => {
  app.post('/api/telegram/webhook/:token', async (req, res) => {
    const incomingToken = req.params.token;
    const callback = req.body?.callback_query;
    try {
      const username = auth.getAdminUsername();
      const initial = await storage.loadUserData(username);
      const telegram = initial.settings?.notifications?.telegram || {};
      if (!telegram.botToken || telegram.botToken !== incomingToken) {
        return res.status(403).json({ ok: false, message: 'invalid_token' });
      }
      if (!callback?.data) return res.json({ ok: true, message: 'ignored' });
      const [action, ...idParts] = String(callback.data).split('|');
      if (!['renewed', 'deprecated'].includes(action)) {
        await answerCallback(telegram.botToken, callback.id, '无效操作');
        return res.json({ ok: false, message: 'invalid_action' });
      }
      let status = null;
      await storage.updateUserData(username, (current) => {
        if (current.settings.notifications.telegram.botToken !== incomingToken) {
          throw new Error('invalid_token');
        }
        const subscription = findSubscription(
          current.subscriptions,
          idParts.join('|'),
          callback.message?.text,
          current.settings.notifications.rules.template
        );
        if (!subscription) return current;
        const billingDate = subscription.nextBillingDate;
        status = action === 'renewed' ? 'active' : 'cancelled';
        subscription.status = status;
        if (status === 'active') {
          delete subscription.cancelledAt;
          subscription.nextBillingDate =
            addFrequencyToDate(billingDate, subscription.frequency) || billingDate;
        } else {
          subscription.cancelledAt = formatLocalYMD(new Date());
          subscription.nextBillingDate = '';
        }
        updateFeedback(current.notifications, subscription, billingDate, action);
        return current;
      });
      if (!status) {
        await answerCallback(telegram.botToken, callback.id, '找不到对应的订阅记录');
        return res.json({ ok: false, message: 'subscription_not_found' });
      }
      await answerCallback(
        telegram.botToken,
        callback.id,
        status === 'cancelled' ? '已标记为已弃用' : '已标记为已续订'
      );
      if (callback.message?.chat?.id && callback.message?.message_id) {
        await clearInlineKeyboard(
          telegram.botToken,
          callback.message.chat.id,
          callback.message.message_id
        );
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('Telegram callback error', err);
      res.status(500).json({ ok: false, message: 'server_error' });
    }
  });
};
