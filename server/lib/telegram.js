const scrubToken = (token) =>
  token ? `${token.slice(0, 6)}...${token.slice(-4)}` : 'undefined';

export const sendTelegramMessage = async (
  { debug },
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

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await resp.json().catch(() => ({}));

  if (debug) {
    console.log('telegram sendMessage', {
      ok: json?.ok,
      description: json?.description,
      chatId,
      hasMarkup: !!replyMarkup,
      markupType: typeof payload.reply_markup,
      replyMarkup: payload.reply_markup,
      resultMarkup: json?.result?.reply_markup,
      bot: scrubToken(botToken),
    });
  }

  if (!resp.ok || json?.ok === false) {
    const errMsg = json?.description || `telegram_error_${resp.status}`;
    throw new Error(errMsg);
  }

  return json;
};

export const answerCallback = async (botToken, callbackQueryId, text) => {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  });
};

export const clearInlineKeyboard = async (botToken, chatId, messageId) => {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    }),
  });
};

