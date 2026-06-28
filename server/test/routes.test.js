import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';

import { registerRoutes } from '../lib/routes.js';

test('registerRoutes preserves all public API endpoints after route split', () => {
  const registered = [];
  const app = {};
  for (const method of ['get', 'post', 'patch', 'delete']) {
    app[method] = (route) => registered.push(`${method.toUpperCase()} ${route}`);
  }
  registerRoutes({
    app,
    config: { maxIconBytes: 1024, publicBaseUrl: '', debugTelegram: false },
    auth: { authMiddleware() {}, getAdminUsername() {} },
    storage: {},
    exchangeRate: {},
    uploadsDir: path.join(os.tmpdir(), 'subm-route-test'),
  });
  assert.deepEqual(
    new Set(registered),
    new Set([
      'POST /api/telegram/webhook/:token',
      'POST /api/login',
      'POST /api/logout',
      'GET /api/me',
      'POST /api/2fa/init',
      'POST /api/2fa/verify',
      'POST /api/2fa/disable',
      'POST /api/change-password',
      'GET /api/data',
      'PATCH /api/data',
      'POST /api/icons',
      'DELETE /api/icons/:filename',
      'GET /api/exchange-rate/public-key',
      'POST /api/exchange-rate/config',
      'POST /api/exchange-rate/update',
      'POST /api/notifications/test-telegram',
      'GET /api/health',
    ])
  );
});
