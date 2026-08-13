import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_REMINDER_TEMPLATE_STRING } from '../../shared/reminderTemplate.js';
import { createReminders } from '../lib/reminders.js';
import {
  daysUntilDate,
  formatDateInTimeZone,
} from '../lib/dates.js';
import { registerTelegramWebhookRoutes } from '../lib/routes/telegramWebhookRoutes.js';
import {
  createTelegramWebhookSecret,
  ensureTelegramWebhook,
  sendTelegramMessage,
  setTelegramWebhook,
} from '../lib/telegram.js';

const BOT_TOKEN = '123456:super-secret-bot-token';
const JWT_SECRET = 'notification-test-jwt-secret-0123456789abcdef';
const WEBHOOK_SECRET = createTelegramWebhookSecret(JWT_SECRET, BOT_TOKEN);

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const telegramOk = () => ({
  ok: true,
  status: 200,
  async json() {
    return { ok: true };
  },
});

const baseSettings = (timeZone = 'UTC') => ({
  timezone: timeZone,
  notifications: {
    telegram: { enabled: true, botToken: BOT_TOKEN, chatId: 'chat-1' },
    email: { enabled: false, emailAddress: '' },
    rules: {
      renewalReminder: true,
      reminderDays: 3,
      template: DEFAULT_REMINDER_TEMPLATE_STRING,
      channels: { renewalReminder: ['telegram'] },
    },
  },
});

const subscription = (overrides = {}) => ({
  id: 'sub-1',
  name: 'Same name',
  price: 10,
  currency: 'USD',
  frequency: 'Monthly',
  category: 'Tools',
  paymentMethod: 'Card',
  status: 'active',
  startDate: '2026-01-15',
  nextBillingDate: '2026-07-15',
  notificationsEnabled: true,
  ...overrides,
});

const memoryStorage = (initial) => {
  const holder = { value: structuredClone(initial), updateCalls: 0 };
  return {
    holder,
    storage: {
      async loadUserData() {
        return structuredClone(holder.value);
      },
      async updateUserData(_username, updater) {
        holder.updateCalls += 1;
        const draft = structuredClone(holder.value);
        holder.value = structuredClone((await updater(draft)) || draft);
        return structuredClone(holder.value);
      },
    },
  };
};

const registerWebhook = (storage) => {
  let handler;
  registerTelegramWebhookRoutes({
    app: {
      post(route, callback) {
        assert.equal(route, '/api/telegram/webhook');
        handler = callback;
      },
    },
    auth: { getAdminUsername: () => 'admin' },
    storage,
    config: { jwtSecret: JWT_SECRET },
  });
  const authenticatedHandler = (req, res) => handler({
    ...req,
    get(name) {
      if (String(name).toLowerCase() === 'x-telegram-bot-api-secret-token') {
        return WEBHOOK_SECRET;
      }
      return req.get?.(name);
    },
  }, res);
  authenticatedHandler.raw = handler;
  return authenticatedHandler;
};

test('Telegram webhook uses a fixed URL and requires the secret header', async () => {
  const initial = {
    settings: baseSettings('UTC'),
    subscriptions: [subscription()],
    notifications: [],
  };
  const { holder, storage } = memoryStorage(initial);
  const webhook = registerWebhook(storage);
  const res = response();
  await webhook.raw({
    headers: {},
    body: {
      update_id: 1,
      callback_query: { id: 'callback-1', data: 'renewed|missing|2026-07-15' },
    },
  }, res);

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { ok: false, message: 'invalid_webhook_secret' });
  assert.equal(holder.value.subscriptions[0].nextBillingDate, '2026-07-15');
});

test('Telegram callbacks bind to the original billing date and are idempotent', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => telegramOk());
  const initial = {
    settings: baseSettings('America/Los_Angeles'),
    subscriptions: [subscription()],
    notifications: [
      {
        id: 'notification-1',
        subscriptionName: 'Same name',
        type: 'renewal_reminder',
        status: 'success',
        channel: 'telegram',
        timestamp: Date.now(),
        details: {
          subscriptionId: 'sub-1',
          date: '2026-07-15',
          renewalFeedback: 'pending',
        },
      },
    ],
  };
  const { holder, storage } = memoryStorage(initial);
  const webhook = registerWebhook(storage);
  const req = {
    params: { token: BOT_TOKEN },
    body: {
      update_id: 101,
      callback_query: {
        id: 'callback-101',
        data: 'renewed|notification-1|2026-07-15',
        message: { chat: { id: 'chat-1' }, message_id: 77, text: 'Same name' },
      },
    },
  };

  const forgedDate = response();
  await webhook(
    {
      ...req,
      body: {
        ...req.body,
        update_id: 100,
        callback_query: {
          ...req.body.callback_query,
          id: 'callback-100',
          data: 'renewed|notification-1|2026-07-16',
        },
      },
    },
    forgedDate
  );
  assert.deepEqual(forgedDate.body, { ok: false, message: 'subscription_not_found' });
  assert.equal(holder.value.subscriptions[0].nextBillingDate, '2026-07-15');

  const first = response();
  await webhook(req, first);
  assert.equal(first.body.ok, true);
  assert.equal(holder.value.subscriptions[0].nextBillingDate, '2026-08-15');
  assert.equal(holder.value.notifications[0].details.renewalFeedback, 'renewed');
  assert.equal(holder.value.notifications[0].details.telegramUpdateId, 101);
  assert.equal(holder.value.notifications[0].details.telegramCallbackId, 'callback-101');

  const replay = response();
  await webhook(req, replay);
  assert.deepEqual(replay.body, { ok: true, message: 'already_processed' });
  assert.equal(holder.value.subscriptions[0].nextBillingDate, '2026-08-15');

  const replayWithNewIdentifiers = response();
  await webhook(
    {
      ...req,
      body: {
        update_id: 103,
        callback_query: {
          ...req.body.callback_query,
          id: 'callback-103',
        },
      },
    },
    replayWithNewIdentifiers
  );
  assert.deepEqual(replayWithNewIdentifiers.body, {
    ok: true,
    message: 'already_processed',
  });
  assert.equal(holder.value.subscriptions[0].nextBillingDate, '2026-08-15');

  const conflicting = response();
  await webhook(
    {
      ...req,
      body: {
        update_id: 102,
        callback_query: {
          ...req.body.callback_query,
          id: 'callback-102',
          data: 'deprecated|notification-1|2026-07-15',
        },
      },
    },
    conflicting
  );
  assert.deepEqual(conflicting.body, { ok: false, message: 'stale_callback' });
  assert.equal(holder.value.subscriptions[0].status, 'active');
  assert.equal(holder.value.subscriptions[0].nextBillingDate, '2026-08-15');
});

test('legacy Telegram buttons remain usable only through a matching reminder record', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => telegramOk());
  const initial = {
    settings: baseSettings('UTC'),
    subscriptions: [subscription()],
    notifications: [
      {
        id: 'legacy-notification',
        subscriptionName: 'Same name',
        type: 'renewal_reminder',
        status: 'success',
        channel: 'telegram',
        timestamp: Date.now(),
        details: {
          subscriptionId: 'sub-1',
          date: '2026-07-15',
          renewalFeedback: 'pending',
        },
      },
    ],
  };
  const { holder, storage } = memoryStorage(initial);
  const webhook = registerWebhook(storage);
  const res = response();
  await webhook(
    {
      params: { token: BOT_TOKEN },
      body: {
        update_id: 201,
        callback_query: {
          id: 'callback-201',
          data: 'renewed|sub-1',
          message: { chat: { id: 'chat-1' }, message_id: 78, text: 'Same name' },
        },
      },
    },
    res
  );

  assert.equal(res.body.ok, true);
  assert.equal(holder.value.subscriptions[0].nextBillingDate, '2026-08-15');
  assert.equal(holder.value.notifications[0].details.renewalFeedback, 'renewed');
});

test('inferred legacy feedback does not suppress an unprocessed current-cycle callback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => telegramOk());
  const initial = {
    settings: baseSettings('UTC'),
    subscriptions: [subscription()],
    notifications: [
      {
        id: 'inferred-notification',
        subscriptionName: 'Same name',
        type: 'renewal_reminder',
        status: 'success',
        channel: 'telegram',
        timestamp: Date.now(),
        details: {
          subscriptionId: 'sub-1',
          date: '2026-07-15',
          renewalFeedback: 'renewed',
        },
      },
    ],
  };
  const { holder, storage } = memoryStorage(initial);
  const webhook = registerWebhook(storage);
  const res = response();
  await webhook(
    {
      params: { token: BOT_TOKEN },
      body: {
        update_id: 203,
        callback_query: {
          id: 'callback-203',
          data: 'renewed|inferred-notification|2026-07-15',
          message: { chat: { id: 'chat-1' }, message_id: 81, text: 'Same name' },
        },
      },
    },
    res
  );

  assert.equal(res.body.ok, true);
  assert.equal(holder.value.subscriptions[0].nextBillingDate, '2026-08-15');
  assert.equal(
    holder.value.notifications[0].details.telegramCallbackId,
    'callback-203'
  );
});

test('ambiguous legacy Telegram buttons fail closed', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => telegramOk());
  const makeRecord = (id, date) => ({
    id,
    subscriptionName: 'Same name',
    type: 'renewal_reminder',
    status: 'success',
    channel: 'telegram',
    timestamp: Date.now(),
    details: {
      subscriptionId: 'sub-1',
      date,
      message: 'identical custom reminder',
      renewalFeedback: 'pending',
    },
  });
  const initial = {
    settings: baseSettings('UTC'),
    subscriptions: [subscription()],
    notifications: [
      makeRecord('legacy-current', '2026-07-15'),
      makeRecord('legacy-older', '2026-06-15'),
    ],
  };
  const { holder, storage } = memoryStorage(initial);
  const webhook = registerWebhook(storage);
  const res = response();
  await webhook(
    {
      params: { token: BOT_TOKEN },
      body: {
        update_id: 202,
        callback_query: {
          id: 'callback-202',
          data: 'renewed|sub-1',
          message: {
            chat: { id: 'chat-1' },
            message_id: 80,
            text: 'identical custom reminder',
          },
        },
      },
    },
    res
  );

  assert.deepEqual(res.body, { ok: false, message: 'subscription_not_found' });
  assert.equal(holder.value.subscriptions[0].nextBillingDate, '2026-07-15');
});

test('deprecated callbacks use the configured timezone for cancellation dates', async (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-07-11T16:30:00.000Z'),
  });
  t.mock.method(globalThis, 'fetch', async () => telegramOk());
  const initial = {
    settings: baseSettings('Asia/Shanghai'),
    subscriptions: [subscription()],
    notifications: [
      {
        id: 'notification-cancel',
        subscriptionName: 'Same name',
        type: 'renewal_reminder',
        status: 'success',
        channel: 'telegram',
        timestamp: Date.now(),
        details: {
          subscriptionId: 'sub-1',
          date: '2026-07-15',
          renewalFeedback: 'pending',
        },
      },
    ],
  };
  const { holder, storage } = memoryStorage(initial);
  const webhook = registerWebhook(storage);
  const res = response();
  await webhook(
    {
      params: { token: BOT_TOKEN },
      body: {
        update_id: 301,
        callback_query: {
          id: 'callback-301',
          data: 'deprecated|notification-cancel|2026-07-15',
          message: { chat: { id: 'chat-1' }, message_id: 79, text: 'Same name' },
        },
      },
    },
    res
  );

  assert.equal(res.body.ok, true);
  assert.equal(holder.value.subscriptions[0].status, 'cancelled');
  assert.equal(holder.value.subscriptions[0].cancelledAt, '2026-07-12');
  assert.equal(holder.value.subscriptions[0].nextBillingDate, '');
});

test('same-name subscriptions with different IDs each receive a reminder', async (t) => {
  const sentPayloads = [];
  const telegramMethods = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const method = String(url).split('/').at(-1);
    telegramMethods.push(method);
    if (method === 'sendMessage') sentPayloads.push(JSON.parse(options.body));
    return telegramOk();
  });
  const today = formatDateInTimeZone('UTC');
  const settings = baseSettings('UTC');
  settings.notifications.telegram.botToken = '201:same-name-reminder-token';
  const initial = {
    settings,
    subscriptions: [
      subscription({ id: 'sub-1', nextBillingDate: today, startDate: today }),
      subscription({ id: 'sub-2', nextBillingDate: today, startDate: today }),
    ],
    notifications: [],
  };
  const { holder, storage } = memoryStorage(initial);
  const reminders = createReminders({
    config: {
      adminUser: 'admin',
      publicBaseUrl: 'https://same-name.example.test',
      jwtSecret: JWT_SECRET,
      debugTelegram: false,
      notifyIntervalMs: 60_000,
    },
    storage,
    email: { async sendEmailMessage() {} },
  });

  await reminders.processRenewalReminders();

  assert.equal(sentPayloads.length, 2);
  assert.deepEqual(telegramMethods, ['setWebhook', 'sendMessage', 'sendMessage']);
  assert.equal(holder.value.notifications.length, 2);
  assert.deepEqual(
    new Set(holder.value.notifications.map((record) => record.details.subscriptionId)),
    new Set(['sub-1', 'sub-2'])
  );
  const callbacks = sentPayloads.flatMap((payload) =>
    payload.reply_markup.inline_keyboard[0].map((button) => button.callback_data)
  );
  assert.ok(
    callbacks.every((value) =>
      /^(?:renewed|deprecated)\|[^|]+\|\d{4}-\d{2}-\d{2}$/.test(value)
    )
  );
  assert.ok(callbacks.every((value) => Buffer.byteLength(value, 'utf8') <= 64));
});

test('reminders omit action buttons when no webhook URL is configured', async (t) => {
  const sentPayloads = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(String(url), /\/sendMessage$/);
    sentPayloads.push(JSON.parse(options.body));
    return telegramOk();
  });
  const today = formatDateInTimeZone('UTC');
  const settings = baseSettings('UTC');
  settings.notifications.telegram.botToken = '202:missing-webhook-token';
  const { holder, storage } = memoryStorage({
    settings,
    subscriptions: [subscription({ nextBillingDate: today, startDate: today })],
    notifications: [],
  });
  const reminders = createReminders({
    config: {
      adminUser: 'admin',
      publicBaseUrl: '',
      jwtSecret: JWT_SECRET,
      debugTelegram: false,
    },
    storage,
    email: { async sendEmailMessage() {} },
  });

  await reminders.processRenewalReminders();

  assert.equal(sentPayloads.length, 1);
  assert.equal(Object.hasOwn(sentPayloads[0], 'reply_markup'), false);
  assert.equal(holder.value.notifications[0].status, 'success');
  assert.equal(holder.value.notifications[0].details.deliveryState, 'delivered');
});

test('webhook registration failure sends a text reminder without dead buttons', async (t) => {
  const sentPayloads = [];
  const webhookPayloads = [];
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const payload = JSON.parse(options.body);
    if (String(url).endsWith('/setWebhook')) {
      webhookPayloads.push(payload);
      return {
        ok: false,
        status: 400,
        async json() {
          return { ok: false, description: 'webhook_registration_failed' };
        },
      };
    }
    sentPayloads.push(payload);
    return telegramOk();
  });
  const today = formatDateInTimeZone('UTC');
  const settings = baseSettings('UTC');
  settings.notifications.telegram.botToken = '203:failed-webhook-token';
  const { holder, storage } = memoryStorage({
    settings,
    subscriptions: [subscription({ nextBillingDate: today, startDate: today })],
    notifications: [],
  });
  const reminders = createReminders({
    config: {
      adminUser: 'admin',
      publicBaseUrl: 'https://failed-webhook.example.test',
      jwtSecret: JWT_SECRET,
      debugTelegram: false,
    },
    storage,
    email: { async sendEmailMessage() {} },
  });

  await reminders.processRenewalReminders();

  assert.equal(webhookPayloads.length, 1);
  assert.equal(sentPayloads.length, 1);
  assert.equal(Object.hasOwn(sentPayloads[0], 'reply_markup'), false);
  assert.equal(holder.value.notifications[0].status, 'success');
  assert.equal(holder.value.notifications[0].details.deliveryState, 'delivered');
});

test('a cached successful webhook is still treated as ready for reminder buttons', async (t) => {
  const telegramMethods = [];
  const sentPayloads = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const method = String(url).split('/').at(-1);
    telegramMethods.push(method);
    if (method === 'sendMessage') sentPayloads.push(JSON.parse(options.body));
    return telegramOk();
  });
  const botToken = '205:cached-webhook-token';
  const publicBaseUrl = 'https://cached-webhook.example.test';
  const secretToken = createTelegramWebhookSecret(JWT_SECRET, botToken);
  await ensureTelegramWebhook(
    { secretToken },
    botToken,
    `${publicBaseUrl}/api/telegram/webhook`
  );
  const today = formatDateInTimeZone('UTC');
  const settings = baseSettings('UTC');
  settings.notifications.telegram.botToken = botToken;
  const { storage } = memoryStorage({
    settings,
    subscriptions: [subscription({ nextBillingDate: today, startDate: today })],
    notifications: [],
  });
  const reminders = createReminders({
    config: {
      adminUser: 'admin',
      publicBaseUrl,
      jwtSecret: JWT_SECRET,
      debugTelegram: false,
    },
    storage,
    email: { async sendEmailMessage() {} },
  });

  await reminders.processRenewalReminders();

  assert.deepEqual(telegramMethods, ['setWebhook', 'sendMessage']);
  assert.equal(sentPayloads.length, 1);
  assert.equal(Object.hasOwn(sentPayloads[0], 'reply_markup'), true);
});

test('scheduler startup replaces legacy token-bearing webhook URLs', async (t) => {
  let webhookPayload;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    webhookPayload = JSON.parse(options.body);
    return telegramOk();
  });
  const settings = baseSettings('UTC');
  settings.notifications.rules.renewalReminder = false;
  const { storage } = memoryStorage({
    settings,
    subscriptions: [],
    notifications: [],
  });
  const reminders = createReminders({
    config: {
      adminUser: 'admin',
      publicBaseUrl: 'https://subm.example.test',
      jwtSecret: JWT_SECRET,
      debugTelegram: false,
    },
    storage,
    email: { sendEmailMessage: async () => {} },
  });

  await reminders.processRenewalReminders();

  assert.equal(webhookPayload.url, 'https://subm.example.test/api/telegram/webhook');
  assert.equal(webhookPayload.url.includes(BOT_TOKEN), false);
  assert.equal(webhookPayload.secret_token, WEBHOOK_SECRET);
});

test('email reminders still send and finalize successfully', async () => {
  const today = formatDateInTimeZone('UTC');
  const settings = baseSettings('UTC');
  settings.notifications.telegram.enabled = false;
  settings.notifications.email = {
    enabled: true,
    emailAddress: 'admin@example.test',
  };
  settings.notifications.rules.channels.renewalReminder = ['email'];
  const { holder, storage } = memoryStorage({
    settings,
    subscriptions: [subscription({ nextBillingDate: today, startDate: today })],
    notifications: [],
  });
  const sent = [];
  const reminders = createReminders({
    config: {
      adminUser: 'admin',
      publicBaseUrl: '',
      debugTelegram: false,
      notifyIntervalMs: 60_000,
    },
    storage,
    email: {
      async sendEmailMessage(address, subject, message) {
        sent.push({ address, subject, message });
      },
    },
  });

  await reminders.processRenewalReminders();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].address, 'admin@example.test');
  assert.equal(holder.value.notifications.length, 1);
  assert.equal(holder.value.notifications[0].channel, 'email');
  assert.equal(holder.value.notifications[0].status, 'success');
  assert.equal(holder.value.notifications[0].details.deliveryState, 'delivered');
});

test('a durable pre-send attempt prevents duplicates when success finalization fails', async (t) => {
  let sendCount = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).endsWith('/sendMessage')) sendCount += 1;
    return telegramOk();
  });
  t.mock.method(console, 'error', () => {});
  const today = formatDateInTimeZone('UTC');
  const holder = {
    value: {
      settings: baseSettings('UTC'),
      subscriptions: [subscription({ nextBillingDate: today, startDate: today })],
      notifications: [],
    },
    updateCalls: 0,
  };
  const storage = {
    async loadUserData() {
      return structuredClone(holder.value);
    },
    async updateUserData(_username, updater) {
      holder.updateCalls += 1;
      const draft = structuredClone(holder.value);
      const next = structuredClone((await updater(draft)) || draft);
      if (holder.updateCalls === 2) throw new Error('simulated_disk_failure');
      holder.value = next;
      return structuredClone(holder.value);
    },
  };
  const reminders = createReminders({
    config: {
      adminUser: 'admin',
      publicBaseUrl: '',
      debugTelegram: false,
      notifyIntervalMs: 60_000,
    },
    storage,
    email: { async sendEmailMessage() {} },
  });

  await reminders.processRenewalReminders();
  await reminders.processRenewalReminders();

  assert.equal(sendCount, 1);
  assert.equal(holder.value.notifications.length, 1);
  assert.equal(holder.value.notifications[0].details.deliveryState, 'attempting');
});

test('an ambiguous Telegram network failure is not retried automatically', async (t) => {
  let sendCount = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).endsWith('/sendMessage')) sendCount += 1;
    throw new Error('connection_reset');
  });
  const today = formatDateInTimeZone('UTC');
  const initial = {
    settings: baseSettings('UTC'),
    subscriptions: [subscription({ nextBillingDate: today, startDate: today })],
    notifications: [],
  };
  const { holder, storage } = memoryStorage(initial);
  const reminders = createReminders({
    config: {
      adminUser: 'admin',
      publicBaseUrl: '',
      debugTelegram: false,
      notifyIntervalMs: 60_000,
    },
    storage,
    email: { async sendEmailMessage() {} },
  });

  await reminders.processRenewalReminders();
  await reminders.processRenewalReminders();

  assert.equal(sendCount, 1);
  assert.equal(holder.value.notifications.length, 1);
  assert.equal(holder.value.notifications[0].status, 'failed');
  assert.equal(holder.value.notifications[0].details.deliveryState, 'unknown');
});

test('a definitive send failure reuses the same notification row', async (t) => {
  let sendCount = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).endsWith('/sendMessage')) sendCount += 1;
    return {
      ok: false,
      status: 400,
      async json() {
        return { ok: false, description: 'chat not found' };
      },
    };
  });
  const today = formatDateInTimeZone('UTC');
  const initial = {
    settings: baseSettings('UTC'),
    subscriptions: [subscription({ nextBillingDate: today, startDate: today })],
    notifications: [],
  };
  const { holder, storage } = memoryStorage(initial);
  const reminders = createReminders({
    config: {
      adminUser: 'admin',
      publicBaseUrl: '',
      debugTelegram: false,
      notifyIntervalMs: 60_000,
    },
    storage,
    email: { async sendEmailMessage() {} },
  });

  await reminders.processRenewalReminders();
  const firstId = holder.value.notifications[0].id;
  await reminders.processRenewalReminders();

  assert.equal(sendCount, 2);
  assert.equal(holder.value.notifications.length, 1);
  assert.equal(holder.value.notifications[0].id, firstId);
  assert.equal(holder.value.notifications[0].status, 'failed');
  assert.equal(holder.value.notifications[0].details.deliveryState, 'failed');
});

test('days-until calculations follow the configured timezone calendar date', () => {
  const now = new Date('2026-07-11T16:30:00.000Z');
  assert.equal(daysUntilDate('2026-07-12', 'Asia/Shanghai', now), 0);
  assert.equal(daysUntilDate('2026-07-12', 'America/Los_Angeles', now), 1);
});

test('Telegram requests time out and diagnostics redact the bot token', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error(`aborted ${BOT_TOKEN}`)));
    })
  );

  const pending = sendTelegramMessage(
    { debug: false },
    BOT_TOKEN,
    'chat-1',
    'hello',
    null
  );
  t.mock.timers.tick(10_000);
  await assert.rejects(pending, (error) => {
    assert.equal(error.message, 'telegram_timeout');
    assert.equal(error.message.includes(BOT_TOKEN), false);
    return true;
  });
});

test('Telegram webhook registration keeps the bot token out of the public callback URL', async (t) => {
  let requestBody;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return telegramOk();
  });

  await setTelegramWebhook(
    { secretToken: WEBHOOK_SECRET },
    BOT_TOKEN,
    'https://example.test/api/telegram/webhook'
  );

  assert.equal(requestBody.url, 'https://example.test/api/telegram/webhook');
  assert.equal(requestBody.url.includes(BOT_TOKEN), false);
  assert.equal(requestBody.secret_token, WEBHOOK_SECRET);
});

test('Telegram webhook registration rejects unsafe URLs before making a request', async (t) => {
  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetchCalls += 1;
    return telegramOk();
  });

  for (const webhookUrl of [
    'http://subm.example.test/api/telegram/webhook',
    'https://subm.example.test/api/telegram/webhook?source=test',
    'https://subm.example.test/api/telegram/webhook#callback',
  ]) {
    await assert.rejects(
      setTelegramWebhook(
        { secretToken: WEBHOOK_SECRET },
        '204:invalid-webhook-url-token',
        webhookUrl
      ),
      { message: 'telegram_webhook_https_required' }
    );
  }
  assert.equal(fetchCalls, 0);
});

test('Telegram debug and error messages never contain the bot token', async (t) => {
  const logs = [];
  t.mock.method(console, 'log', (...args) => logs.push(args));
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    status: 400,
    async json() {
      return { ok: false, description: `bad webhook containing ${BOT_TOKEN}` };
    },
  }));

  await assert.rejects(
    setTelegramWebhook(
      { debug: true, secretToken: WEBHOOK_SECRET },
      BOT_TOKEN,
      'https://example.test/api/telegram/webhook'
    ),
    (error) => {
      assert.equal(error.message.includes(BOT_TOKEN), false);
      return true;
    }
  );
  assert.equal(JSON.stringify(logs).includes(BOT_TOKEN), false);
});

test('Telegram webhook error logs redact the bot token', async (t) => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  const webhook = registerWebhook({
    async loadUserData() {
      return {
        settings: baseSettings('UTC'),
        subscriptions: [],
        notifications: [],
      };
    },
    async updateUserData() {
      throw new Error(`storage failure containing ${BOT_TOKEN}`);
    },
  });
  const res = response();
  await webhook(
    {
      params: { token: BOT_TOKEN },
      body: {
        update_id: 999,
        callback_query: {
          id: 'callback-999',
          data: 'renewed|notification-999|2026-07-15',
        },
      },
    },
    res
  );

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { ok: false, message: 'server_error' });
  assert.equal(JSON.stringify(logs).includes(BOT_TOKEN), false);
});
