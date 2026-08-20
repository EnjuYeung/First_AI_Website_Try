import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_REMINDER_TEMPLATE_STRING } from '../../shared/reminderTemplate.js';
import { createReminders } from '../lib/reminders.js';
import {
  daysUntilDate,
  formatDateInTimeZone,
} from '../lib/dates.js';
import { sendTelegramMessage } from '../lib/telegram.js';

const BOT_TOKEN = '123456:super-secret-bot-token';

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

const reminderConfig = () => ({
  adminUser: 'admin',
  debugTelegram: false,
  notifyIntervalMs: 60_000,
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
    config: reminderConfig(),
    storage,
    email: { async sendEmailMessage() {} },
  });

  await reminders.processRenewalReminders();

  assert.equal(sentPayloads.length, 2);
  assert.deepEqual(telegramMethods, ['sendMessage', 'sendMessage']);
  assert.ok(sentPayloads.every((payload) => Object.hasOwn(payload, 'reply_markup') === false));
  assert.equal(holder.value.notifications.length, 2);
  assert.deepEqual(
    new Set(holder.value.notifications.map((record) => record.details.subscriptionId)),
    new Set(['sub-1', 'sub-2'])
  );
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
    config: reminderConfig(),
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
    config: reminderConfig(),
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
    config: reminderConfig(),
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
    config: reminderConfig(),
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
    'hello'
  );
  t.mock.timers.tick(10_000);
  await assert.rejects(pending, (error) => {
    assert.equal(error.message, 'telegram_timeout');
    assert.equal(error.message.includes(BOT_TOKEN), false);
    return true;
  });
});

test('Telegram debug and error messages never contain the bot token', async (t) => {
  const logs = [];
  t.mock.method(console, 'log', (...args) => logs.push(args));
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    status: 400,
    async json() {
      return { ok: false, description: `bad send containing ${BOT_TOKEN}` };
    },
  }));

  await assert.rejects(
    sendTelegramMessage({ debug: true }, BOT_TOKEN, 'chat-1', 'hello'),
    (error) => {
      assert.equal(error.message.includes(BOT_TOKEN), false);
      return true;
    }
  );
  assert.equal(JSON.stringify(logs).includes(BOT_TOKEN), false);
});
