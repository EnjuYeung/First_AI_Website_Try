const TELEGRAM_REQUEST_TIMEOUT_MS = 10_000;

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
  text
) => {
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };

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
      });
    }
    return json;
  } catch (err) {
    if (debug) {
      console.log('telegram sendMessage', {
        ok: false,
        description: redact(err?.message, botToken),
        chatId,
      });
    }
    throw new Error(redact(err?.message, botToken) || 'telegram_error');
  }
};
