import { addBillingCycleYMD } from '../../shared/billingDate.js';
import { formatDateInTimeZone } from './dates.js';
import { safeErrorMessage, updateRenewalFeedback } from './notificationRecords.js';
import { telegramRequest } from './telegram.js';

// Each callback identifies one notification and one billing period, never a name.
export const processTelegramCallback = async ({ storage, config, telegram, chatId, update }) => {
  const callback = update?.callback_query;
  if (!callback?.id || typeof callback.data !== 'string') return;
  if (String(callback.message?.chat?.id) !== String(chatId)) return;
  if (['test_renewal|renewed', 'test_renewal|deprecated'].includes(callback.data)) {
    const current = await storage.loadUserData(config.adminUser);
    const settings = current.settings?.notifications?.telegram;
    if (!settings?.enabled || settings.botToken !== telegram.botToken ||
        String(settings.chatId) !== String(telegram.chatId)) return;
    const label = callback.data === 'test_renewal|renewed' ? '续订' : '弃用';
    // Dedicated test actions never enter the subscription mutation path.
    for (const [method, payload] of [
      ['answerCallbackQuery', {
        callback_query_id: callback.id, text: '测试成功，后台已收到操作。',
      }],
      ['editMessageText', {
        chat_id: chatId, message_id: callback.message.message_id,
        text: `✅ 测试${label}成功\n后台已通过轮询接收并处理本次点击。\n测试模式，未修改真实订阅。`,
        reply_markup: { inline_keyboard: [] },
      }],
    ]) {
      try { await telegramRequest(telegram.botToken, method, payload); }
      catch (error) {
        console.error('Telegram test callback response failed', safeErrorMessage(error, telegram.botToken));
      }
    }
    return;
  }
  const parts = callback.data.split('|');
  const [action, notificationId, expectedDate] = parts;
  if (parts.length !== 3 || !['renewed', 'deprecated'].includes(action) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) return;

  let text = '该提醒已处理或账期已变化';
  await storage.updateUserData(config.adminUser, (current) => {
    const settings = current.settings?.notifications?.telegram;
    if (!settings?.enabled || settings.botToken !== telegram.botToken ||
        String(settings.chatId) !== String(telegram.chatId)) return current;
    const record = current.notifications?.find((item) => item.id === notificationId &&
      item.type === 'renewal_reminder' && item.channel === 'telegram' &&
      item.details?.date === expectedDate &&
      (item.status === 'success' || ['attempting', 'delivered', 'unknown'].includes(item.details?.deliveryState)));
    const sub = current.subscriptions?.find((item) => item.id === record?.details?.subscriptionId);
    if (!record || !sub || sub.status !== 'active' || sub.nextBillingDate !== expectedDate ||
        ['renewed', 'deprecated'].includes(record.details.renewalFeedback) ||
        expectedDate < formatDateInTimeZone(config.timeZone)) return current;

    if (action === 'renewed') {
      const next = addBillingCycleYMD(expectedDate, sub.frequency, sub.startDate || expectedDate);
      if (!next || next <= expectedDate) return current;
      sub.status = 'active';
      sub.nextBillingDate = next;
      delete sub.cancelledAt;
      text = '已标记为生效中，并更新下期账单';
    } else {
      sub.status = 'cancelled';
      sub.cancelledAt = formatDateInTimeZone(config.timeZone);
      sub.nextBillingDate = '';
      text = '已标记为已弃用';
    }
    updateRenewalFeedback(current.notifications, sub, expectedDate, action, current.subscriptions);
    record.details = { ...record.details, telegramCallbackId: callback.id,
      telegramUpdateId: update.update_id, telegramProcessedAt: Date.now() };
    return current;
  });

  // Database changes are already committed. An expired callback or deleted message
  // must not prevent acknowledgement of this update or block subsequent updates.
  for (const [method, payload] of [
    ['answerCallbackQuery', { callback_query_id: callback.id, text }],
    ['editMessageReplyMarkup', { chat_id: chatId, message_id: callback.message.message_id,
      reply_markup: { inline_keyboard: [] } }],
  ]) {
    try { await telegramRequest(telegram.botToken, method, payload); }
    catch (error) { console.error('Telegram callback response failed', safeErrorMessage(error, telegram.botToken)); }
  }
};

export const createTelegramPolling = ({ config, storage }) => {
  let timer = null;
  let running = false;
  let stopped = true;
  let identity = '';
  let offset = 0;
  let chatId;
  let connected = false;
  let idle = false;

  const pollOnce = async () => {
    if (running) return;
    running = true;
    let botToken = '';
    try {
      // Loading also persists overdue billing advancement and automatic feedback.
      const data = await storage.loadUserData(config.adminUser);
      const telegram = data.settings?.notifications?.telegram;
      if (!telegram?.enabled || !telegram.botToken || !telegram.chatId) {
        idle = true;
        identity = '';
        connected = false;
        return;
      }
      idle = false;
      botToken = telegram.botToken;
      const nextIdentity = JSON.stringify([botToken, telegram.chatId]);
      if (identity !== nextIdentity) {
        connected = false;
        // getUpdates cannot operate while a legacy webhook is registered.
        await telegramRequest(botToken, 'deleteWebhook', { drop_pending_updates: false });
        const chat = await telegramRequest(botToken, 'getChat', { chat_id: telegram.chatId });
        if (!chat.result?.id) throw new Error('telegram_chat_not_found');
        chatId = chat.result.id;
        offset = 0;
        identity = nextIdentity;
      }
      const result = await telegramRequest(botToken, 'getUpdates', {
        offset, timeout: 25, allowed_updates: ['callback_query'],
      }, { timeoutMs: 35_000 });
      if (!connected) {
        console.log('Telegram polling connected');
        connected = true;
      }
      for (const update of result.result || []) {
        if (!Number.isSafeInteger(update.update_id)) continue;
        await processTelegramCallback({ storage, config, telegram, chatId, update });
        // Failed storage writes throw before advancing offset, so they can retry.
        offset = update.update_id + 1;
      }
    } catch (error) {
      console.error('Telegram polling failed', safeErrorMessage(error, botToken));
    } finally { running = false; }
  };

  const tick = async () => {
    await pollOnce();
    if (!stopped) timer = setTimeout(tick, idle ? 30_000 : 3000);
  };
  return {
    pollOnce,
    start() {
      if (!stopped) return;
      stopped = false;
      void tick();
    },
    stop() { stopped = true; clearTimeout(timer); },
  };
};
