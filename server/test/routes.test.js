import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';

import { registerRoutes } from '../lib/routes.js';

test('registerRoutes preserves all public API endpoints after route split', () => {
  const registered = [];
  const app = {};
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    app[method] = (route) => registered.push(`${method.toUpperCase()} ${route}`);
  }
  registerRoutes({
    app,
    config: {
      maxIconBytes: 1024,
      maxWallpaperBytes: 8192,
      timeZone: 'Asia/Shanghai',
      debugTelegram: false,
      jwtSecret: 'route-test-jwt-secret-0123456789abcdef',
    },
    auth: { authMiddleware() {}, getAdminUsername() {} },
    storage: {},
    exchangeRate: {},
    uploadsDir: path.join(os.tmpdir(), 'subm-route-test'),
  });
  assert.deepEqual(
    new Set(registered),
    new Set([
      'POST /api/login',
      'POST /api/logout',
      'GET /api/me',
      'POST /api/2fa/init',
      'POST /api/2fa/verify',
      'POST /api/2fa/disable',
      'POST /api/change-password',
      'GET /api/data',
      'POST /api/subscriptions',
      'PUT /api/subscriptions/:id',
      'DELETE /api/subscriptions/:id',
      'POST /api/subscriptions/batch-delete',
      'PUT /api/settings',
      'DELETE /api/notifications/:id',
      'DELETE /api/notifications',
      'POST /api/icons',
      'DELETE /api/icons/:filename',
      'POST /api/wallpapers',
      'DELETE /api/wallpapers/:filename',
      'POST /api/exchange-rate/config',
      'POST /api/exchange-rate/update',
      'POST /api/notifications/test-telegram',
      'GET /api/health',
    ])
  );
});
