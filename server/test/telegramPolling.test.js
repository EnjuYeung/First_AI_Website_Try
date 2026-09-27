import test from 'node:test';
import assert from 'node:assert/strict';
import { processTelegramCallback, createTelegramPolling } from '../lib/telegramPolling.js';
import { formatDateInTimeZone } from '../lib/dates.js';
import { addBillingCycleYMD } from '../../shared/billingDate.js';

const setup = () => {
  const date = formatDateInTimeZone('UTC');
  const telegram = { enabled: true, botToken: 'test-token', chatId: '123' };
  let data = { settings: { notifications: { telegram } },
    subscriptions: [{ id: 's', status: 'active', startDate: date, nextBillingDate: date, frequency: 'Monthly' }],
    notifications: [{ id: 'n', type: 'renewal_reminder', channel: 'telegram', status: 'success',
      details: { subscriptionId: 's', date, renewalFeedback: 'pending' } }] };
  const storage = {
    async loadUserData() { return structuredClone(data); },
    async updateUserData(_user, updater) { data = await updater(structuredClone(data)); },
  };
  const args = { storage, config: { adminUser: 'admin', timeZone: 'UTC' }, telegram, chatId: 123 };
  const update = (action = 'renewed', chat = 123, billingDate = date) => ({ update_id: 1,
    callback_query: { id: 'callback', data: `${action}|n|${billingDate}`,
      message: { chat: { id: chat }, message_id: 5 } } });
  return { args, update, date, data: () => data };
};
const mockApi = (t, handler = () => ({})) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const method = url.split('/').at(-1);
    const body = JSON.parse(options.body);
    calls.push({ method, body });
    return { ok: true, async json() { return { ok: true, result: handler(method, body) }; } };
  });
  return calls;
};

test('renewal advances once; repeated or conflicting clicks do not change another period', async (t) => {
  mockApi(t);
  const s = setup();
  await processTelegramCallback({ ...s.args, update: s.update() });
  assert.equal(s.data().subscriptions[0].nextBillingDate, addBillingCycleYMD(s.date, 'Monthly'));
  assert.equal(s.data().notifications[0].details.renewalFeedback, 'renewed');
  const snapshot = structuredClone(s.data());
  await processTelegramCallback({ ...s.args, update: s.update() });
  await processTelegramCallback({ ...s.args, update: s.update('deprecated') });
  assert.deepEqual(s.data(), snapshot);
});

test('cancellation stops billing; wrong chats, dates and changed credentials cannot mutate data', async (t) => {
  mockApi(t);
  const s = setup();
  const snapshot = structuredClone(s.data());
  await processTelegramCallback({ ...s.args, update: s.update('deprecated', 999) });
  await processTelegramCallback({ ...s.args, update: s.update('deprecated', 123, '2020-01-01') });
  await processTelegramCallback({ ...s.args, telegram: { ...s.args.telegram, botToken: 'old' }, update: s.update() });
  assert.deepEqual(s.data(), snapshot);
  await processTelegramCallback({ ...s.args, update: s.update('deprecated') });
  assert.equal(s.data().subscriptions[0].status, 'cancelled');
  assert.equal(s.data().subscriptions[0].nextBillingDate, '');
  assert.equal(s.data().notifications[0].details.renewalFeedback, 'deprecated');
});

test('poller migrates webhook, resolves chat and advances offset after handling updates', async (t) => {
  const s = setup();
  const calls = mockApi(t, (method, body) => {
    if (method === 'getChat') return { id: 123 };
    if (method === 'getUpdates') return body.offset === 0 ? [s.update()] : [];
    return true;
  });
  const poller = createTelegramPolling(s.args);
  await poller.pollOnce();
  await poller.pollOnce();
  assert.equal(calls.filter((c) => c.method === 'deleteWebhook').length, 1);
  assert.deepEqual(calls.filter((c) => c.method === 'getUpdates').map((c) => c.body.offset), [0, 2]);
  assert.equal(s.data().notifications[0].details.renewalFeedback, 'renewed');
});

test('failed persistence leaves update unacknowledged for retry', async (t) => {
  const s = setup();
  const calls = mockApi(t, (method) => method === 'getChat' ? { id: 123 } : method === 'getUpdates' ? [s.update()] : true);
  t.mock.method(console, 'error', () => {});
  const original = s.args.storage.updateUserData;
  s.args.storage.updateUserData = async () => { throw new Error('disk failure'); };
  const poller = createTelegramPolling(s.args);
  await poller.pollOnce();
  s.args.storage.updateUserData = original;
  await poller.pollOnce();
  assert.deepEqual(calls.filter((c) => c.method === 'getUpdates').map((c) => c.body.offset), [0, 0]);
  assert.equal(s.data().notifications[0].details.renewalFeedback, 'renewed');
});

for (const action of ['renewed', 'deprecated']) {
  test(`test ${action} callback confirms and replaces message without writing subscriptions`, async (t) => {
    const calls = mockApi(t);
    const s = setup();
    const snapshot = structuredClone(s.data());
    s.args.storage.updateUserData = async () => assert.fail('test callback must not write subscriptions');
    const update = s.update();
    update.callback_query.data = `test_renewal|${action}`;
    await processTelegramCallback({ ...s.args, update });
    assert.deepEqual(s.data(), snapshot);
    assert.deepEqual(calls.map((c) => c.method), ['answerCallbackQuery', 'editMessageText']);
    assert.match(calls[0].body.text, /测试成功/);
    assert.match(calls[1].body.text, action === 'renewed' ? /测试续订成功/ : /测试弃用成功/);
    assert.match(calls[1].body.text, /未修改真实订阅/);
    assert.equal(calls[1].body.chat_id, 123);
    assert.equal(calls[1].body.message_id, 5);
    assert.deepEqual(calls[1].body.reply_markup, { inline_keyboard: [] });
  });
}

test('test callbacks reject wrong chat, stale credentials, disabled settings and unknown actions', async (t) => {
  const calls = mockApi(t);
  const s = setup();
  const update = s.update();
  update.callback_query.data = 'test_renewal|renewed';
  await processTelegramCallback({ ...s.args, chatId: 999, update });
  await processTelegramCallback({ ...s.args, telegram: { ...s.args.telegram, botToken: 'old' }, update });
  update.callback_query.data = 'test_renewal|invalid';
  await processTelegramCallback({ ...s.args, update });
  update.callback_query.data = 'test_renewal|renewed';
  s.data().settings.notifications.telegram.enabled = false;
  await processTelegramCallback({ ...s.args, update });
  assert.deepEqual(calls, []);
});

test('expired test callback popup does not prevent the message result', async (t) => {
  const calls = mockApi(t, (method) => {
    if (method === 'answerCallbackQuery') throw new Error('expired');
    return true;
  });
  t.mock.method(console, 'error', () => {});
  const s = setup();
  const update = s.update();
  update.callback_query.data = 'test_renewal|renewed';
  await processTelegramCallback({ ...s.args, update });
  assert.deepEqual(calls.map((c) => c.method), ['answerCallbackQuery', 'editMessageText']);
});
