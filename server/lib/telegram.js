import crypto from 'crypto';

const TELEGRAM_REQUEST_TIMEOUT_MS = 10_000;

const webhookCache = new Map();

export const createTelegramWebhookSecret = (jwtSecret, botToken) => {
  if (!jwtSecret || !botToken) return '';
  return crypto
    .createHmac('sha256', jwtSecret)
    .update(`telegram-webhook:${botToken}`)
    .digest('base64url');
};

const redact = (value, botToken) => {
  let safe = String(value || '');
  for (const secret of [botToken, encodeURIComponent(botToken || '')]) {
    if (secret) safe = safe.split(secret).join('[redacted]');
  }
  return safe;
};

const telegramRequest = async (
  botToken,
  method,
  payload,
  { errorPrefix = 'telegram_error', timeoutMs = TELEGRAM_REQUEST_TIMEOUT_MS } = {}
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new Error('telegram_timeout');
    throw new Error(`${errorPrefix}_request_failed`);
  } finally {
    clearTimeout(timeout);
  }

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.ok === false) {
    const description = redact(json?.description, botToken);
    throw new Error(description || `${errorPrefix}_${resp.status}`);
  }
  return json;
};

export const sendTelegramMessage = async (
  { debug, timeoutMs } = {},
  botToken,
  chatId,
  text,
  replyMarkup
) => {
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };

  if (replyMarkup) {
    try {
      payload.reply_markup =
        typeof replyMarkup === 'string' ? JSON.parse(replyMarkup) : replyMarkup;
    } catch {
      payload.reply_markup = replyMarkup;
    }
  }

  try {
    const json = await telegramRequest(botToken, 'sendMessage', payload, {
      errorPrefix: 'telegram_error',
      timeoutMs,
    });
    if (debug) {
      console.log('telegram sendMessage', {
        ok: json?.ok,
        description: redact(json?.description, botToken),
        chatId,
        hasMarkup: !!replyMarkup,
        markupType: typeof payload.reply_markup,
        replyMarkup: payload.reply_markup,
        resultMarkup: json?.result?.reply_markup,
      });
    }
    return json;
  } catch (err) {
    if (debug) {
      console.log('telegram sendMessage', {
        ok: false,
        description: redact(err?.message, botToken),
        chatId,
        hasMarkup: !!replyMarkup,
      });
    }
    throw new Error(redact(err?.message, botToken) || 'telegram_error');
  }
};

export const setTelegramWebhook = async (
  { debug, timeoutMs, secretToken } = {},
  botToken,
  webhookUrl
) => {
  const payload = {
    url: webhookUrl,
    allowed_updates: ['callback_query'],
    ...(secretToken ? { secret_token: secretToken } : {}),
  };

  try {
    const json = await telegramRequest(botToken, 'setWebhook', payload, {
      errorPrefix: 'telegram_webhook_error',
      timeoutMs,
    });
    if (debug) {
      console.log('telegram setWebhook', {
        ok: json?.ok,
        description: redact(json?.description, botToken),
        webhookConfigured: true,
      });
    }
    return json;
  } catch (err) {
    if (debug) {
      console.log('telegram setWebhook', {
        ok: false,
        description: redact(err?.message, botToken),
        webhookConfigured: false,
      });
    }
    throw new Error(redact(err?.message, botToken) || 'telegram_webhook_error');
  }
};

export const ensureTelegramWebhook = async (options, botToken, webhookUrl) => {
  if (!botToken || !webhookUrl) return false;
  const cached = webhookCache.get(botToken);
  const cacheValue = `${webhookUrl}\0${options?.secretToken || ''}`;
  if (cached === cacheValue) return false;
  await setTelegramWebhook(options, botToken, webhookUrl);
  webhookCache.set(botToken, cacheValue);
  return true;
};

export const answerCallback = async (botToken, callbackQueryId, text) =>
  telegramRequest(
    botToken,
    'answerCallbackQuery',
    {
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    },
    { errorPrefix: 'telegram_callback_error' }
  );

export const clearInlineKeyboard = async (botToken, chatId, messageId) =>
  telegramRequest(
    botToken,
    'editMessageReplyMarkup',
    {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    },
    { errorPrefix: 'telegram_markup_error' }
  );
