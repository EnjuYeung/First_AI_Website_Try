import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_REMINDER_TEMPLATE_STRING } from '../../shared/reminderTemplate.js';
import { registerNotificationRoutes } from '../lib/routes/notificationRoutes.js';

const JWT_SECRET = 'notification-route-jwt-secret-0123456789abcdef';

const telegramOk = () => ({
  ok: true,
  status: 200,
  async json() {
    return { ok: true };
  },
});

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

const registerTestRoute = ({ config, botToken }) => {
  let handler;
  registerNotificationRoutes({
    app: {
      post(route, _middleware, callback) {
        assert.equal(route, '/api/notifications/test-telegram');
        handler = callback;
      },
    },
    config: {
      allowedOrigins: [],
      debugTelegram: false,
      jwtSecret: JWT_SECRET,
      ...config,
    },
    auth: { authMiddleware() {} },
    storage: {
      async loadUserData() {
        return {
          settings: {
            notifications: {
              telegram: { enabled: true, botToken, chatId: 'chat-1' },
              rules: { template: DEFAULT_REMINDER_TEMPLATE_STRING },
            },
          },
        };
      },
    },
  });
  return handler;
};

const request = ({ protocol = 'http', host = 'internal.example.test', body = {} } = {}) => ({
  user: { username: 'admin' },
  body,
  protocol,
  get(name) {
    return String(name).toLowerCase() === 'host' ? host : undefined;
  },
});

test('test notification sends a Telegram message', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return telegramOk();
  });
  const handler = registerTestRoute({
    botToken: '101:configured-route-token',
  });
  const res = response();

  await handler(request(), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/sendMessage$/);
  assert.equal(calls[0].body.chat_id, 'chat-1');
});

test('monthly summary template tests render the monthly sample payload', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return telegramOk();
  });
  const handler = registerTestRoute({
    botToken: '106:monthly-summary-token',
  });
  const res = response();

  await handler(request({
    body: {
      templateType: 'monthlySummary',
      template: JSON.stringify({ lines: ['SUMMARY {{month}} / {{activeSubscriptions}}'] }),
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0].body.text, /SUMMARY 2026年7月 \/ 8/);
});

test('Telegram send failures are returned by the test endpoint', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return {
      ok: false,
      status: 400,
      async json() {
        return { ok: false, description: 'telegram_send_failed' };
      },
    };
  });
  const handler = registerTestRoute({
    botToken: '104:failed-route-token',
  });
  const res = response();

  await handler(request(), res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { ok: false, message: 'telegram_send_failed' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/sendMessage$/);
});
