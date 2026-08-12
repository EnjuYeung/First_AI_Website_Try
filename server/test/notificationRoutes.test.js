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
      publicBaseUrl: '',
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

test('configured HTTPS public base URL is used behind an HTTP proxy hop', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return telegramOk();
  });
  const handler = registerTestRoute({
    botToken: '101:configured-route-token',
    config: { publicBaseUrl: 'https://subm.example.test' },
  });
  const res = response();

  await handler(request(), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/setWebhook$/);
  assert.equal(calls[0].body.url, 'https://subm.example.test/api/telegram/webhook');
  assert.equal(typeof calls[0].body.secret_token, 'string');
  assert.match(calls[1].url, /\/sendMessage$/);
});

test('trusted HTTPS request origin can be used when public base URL is unset', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return telegramOk();
  });
  const handler = registerTestRoute({
    botToken: '102:inferred-route-token',
    config: { allowedOrigins: ['https://subm.example.test'] },
  });
  const res = response();

  await handler(request({ protocol: 'https', host: 'SUBM.EXAMPLE.TEST:443' }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].body.url, 'https://subm.example.test/api/telegram/webhook');
});

test('monthly summary template tests render the monthly sample payload', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return telegramOk();
  });
  const handler = registerTestRoute({
    botToken: '106:monthly-summary-token',
    config: { publicBaseUrl: 'https://subm.example.test' },
  });
  const res = response();

  await handler(request({
    body: {
      templateType: 'monthlySummary',
      template: JSON.stringify({ lines: ['SUMMARY {{month}} / {{activeSubscriptions}}'] }),
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[1].body.text, /SUMMARY 2026年7月 \/ 8/);
});

test('HTTP and untrusted inferred origins are rejected before calling Telegram', async (t) => {
  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetchCalls += 1;
    return telegramOk();
  });
  const handler = registerTestRoute({
    botToken: '103:rejected-route-token',
    config: { allowedOrigins: ['https://subm.example.test'] },
  });

  for (const req of [
    request({ protocol: 'http', host: 'subm.example.test' }),
    request({ protocol: 'https', host: 'attacker.example.test' }),
  ]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      ok: false,
      message: 'telegram_webhook_https_required',
    });
  }
  const missingAllowlistHandler = registerTestRoute({
    botToken: '105:missing-allowlist-token',
    config: { allowedOrigins: undefined },
  });
  const missingAllowlistResponse = response();
  await missingAllowlistHandler(
    request({ protocol: 'https', host: 'subm.example.test' }),
    missingAllowlistResponse
  );
  assert.equal(missingAllowlistResponse.statusCode, 400);
  assert.equal(fetchCalls, 0);
});

test('test message is not sent when webhook registration fails', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return {
      ok: false,
      status: 400,
      async json() {
        return { ok: false, description: 'webhook_registration_failed' };
      },
    };
  });
  const handler = registerTestRoute({
    botToken: '104:failed-route-token',
    config: { publicBaseUrl: 'https://subm.example.test' },
  });
  const res = response();

  await handler(request(), res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { ok: false, message: 'webhook_registration_failed' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/setWebhook$/);
});
