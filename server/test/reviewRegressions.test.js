import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { telegramRequest } from '../lib/telegram.js';
import { matchesSubscription } from '../../shared/notificationIdentity.js';

test('Telegram timeout covers a response body that stalls after headers', async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.flushHeaders();
    const timer = setTimeout(() => res.end('{"ok":true}'), 500);
    res.on('close', () => clearTimeout(timer));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const originalFetch = globalThis.fetch;
  let bodyStarted = false;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const response = await originalFetch(`http://127.0.0.1:${server.address().port}`, options);
    bodyStarted = true;
    return response;
  });
  await assert.rejects(telegramRequest('fake-token', 'getUpdates', {}, { timeoutMs: 100 }), /telegram_timeout/);
  assert.equal(bodyStarted, true);
});

test('notification identity does not fall back from a deleted ID or ambiguous name', () => {
  const subscription = { id: 'new', name: 'Same' };
  assert.equal(matchesSubscription({ details: { subscriptionId: 'deleted' }, subscriptionName: 'Same' }, subscription, 1), false);
  assert.equal(matchesSubscription({ subscriptionName: 'Same' }, subscription, 2), false);
  assert.equal(matchesSubscription({ subscriptionName: 'Same' }, subscription, 1), true);
});

test('cold-start normalization persists retention and respects deleted and ambiguous identities', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'subm-review-'));
  try {
    const userDir = path.join(dir, 'users', 'admin');
    await fs.mkdir(userDir, { recursive: true });
    const doc = data => ({ schemaVersion: 1, revision: 1, updatedAt: new Date().toISOString(), data });
    const subscription = { id: 'new', name: 'Same', status: 'active', frequency: 'Monthly', startDate: '2020-01-01', nextBillingDate: '2099-01-01' };
    const record = { id: 'deleted', type: 'renewal_reminder', subscriptionName: 'Same', timestamp: Date.now(),
      details: { subscriptionId: 'deleted', date: '2020-01-01', renewalFeedback: 'pending' } };
    await fs.writeFile(path.join(userDir, 'subscriptions.json'), JSON.stringify(doc([subscription, { ...subscription, id: 'second' }])));
    await fs.writeFile(path.join(userDir, 'settings.json'), JSON.stringify(doc({})));
    await fs.writeFile(path.join(userDir, 'notifications.json'), JSON.stringify(doc([
      record,
      { ...record, id: 'legacy', details: { date: '2020-01-01', renewalFeedback: 'pending' } },
      { ...record, id: 'expired', timestamp: Date.now() - 91 * 86400000 },
    ])));
    const script = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs/promises';
      import { createStorage } from ${JSON.stringify(new URL('../lib/storage.js', import.meta.url).href)};
      const store = createStorage({ adminUser: 'admin', adminPass: 'synthetic-password', timeZone: 'UTC' });
      const data = await store.loadUserData('admin');
      assert.equal(data.notifications.length, 2);
      assert.ok(data.notifications.every(n => n.details.renewalFeedback === 'pending'));
      const persisted = JSON.parse(await fs.readFile(${JSON.stringify(path.join(userDir, 'notifications.json'))}, 'utf8'));
      assert.equal(persisted.data.length, 2);
      assert.equal(persisted.revision, 2);
      const again = await store.loadUserData('admin');
      assert.equal(again.revisions.notifications, 2);
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, DATA_DIR: dir }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
