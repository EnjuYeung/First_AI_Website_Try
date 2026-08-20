import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const writeDocument = async (filePath, data, revision = 1) => {
  await fs.writeFile(filePath, JSON.stringify({
    schemaVersion: 1,
    revision,
    updatedAt: '2026-01-01T00:00:00.000Z',
    data,
  }));
};

test('loading an active overdue subscription rolls nextBillingDate forward and persists it', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subm-overdue-billing-'));
  const userDir = path.join(dataDir, 'users', 'admin');
  await fs.mkdir(userDir, { recursive: true, mode: 0o700 });
  await writeDocument(path.join(userDir, 'subscriptions.json'), [
    {
      id: 'active-overdue',
      name: 'Active Overdue',
      price: 10,
      currency: 'USD',
      frequency: 'Monthly',
      category: 'Other',
      paymentMethod: 'Credit Card',
      status: 'active',
      startDate: '2020-01-01',
      nextBillingDate: '2020-01-01',
      notificationsEnabled: true,
    },
    {
      id: 'cancelled-overdue',
      name: 'Cancelled Overdue',
      price: 10,
      currency: 'USD',
      frequency: 'Monthly',
      category: 'Other',
      paymentMethod: 'Credit Card',
      status: 'cancelled',
      startDate: '2020-01-01',
      nextBillingDate: '2020-01-01',
      cancelledAt: '2020-02-01',
      notificationsEnabled: false,
    },
    {
      id: 'future-active',
      name: 'Future Active',
      price: 10,
      currency: 'USD',
      frequency: 'Monthly',
      category: 'Other',
      paymentMethod: 'Credit Card',
      status: 'active',
      startDate: '2026-01-01',
      nextBillingDate: '2099-01-01',
      notificationsEnabled: true,
    },
  ]);
  await writeDocument(path.join(userDir, 'notifications.json'), []);
  await writeDocument(path.join(userDir, 'settings.json'), {});

  const testFileDir = path.dirname(fileURLToPath(import.meta.url));
  const storageUrl = new URL('../lib/storage.js', import.meta.url).href;
  const billingUrl = new URL('../../shared/billingDate.js', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs/promises';
    import path from 'node:path';
    import { createStorage } from ${JSON.stringify(storageUrl)};
    import { advanceOverdueNextBillingDateYMD } from ${JSON.stringify(billingUrl)};
    const storage = createStorage({
      adminUser: 'admin',
      adminPass: 'password',
      timeZone: 'UTC',
    });
    const loaded = await storage.loadUserData('admin');
    const today = new Date().toISOString().slice(0, 10);
    const expected = advanceOverdueNextBillingDateYMD(
      '2020-01-01',
      'Monthly',
      '2020-01-01',
      today
    );
    assert.equal(loaded.subscriptions[0].nextBillingDate, expected);
    assert.ok(expected > '2020-01-01');
    assert.ok(expected >= today);
    assert.equal(loaded.subscriptions[1].nextBillingDate, '2020-01-01');
    assert.equal(loaded.subscriptions[2].nextBillingDate, '2099-01-01');
    assert.ok(loaded.revisions.subscriptions > 1);
    const persisted = JSON.parse(await fs.readFile(path.join(process.env.DATA_DIR, 'users', 'admin', 'subscriptions.json'), 'utf8'));
    assert.equal(persisted.data[0].nextBillingDate, expected);
    assert.equal(persisted.data[1].nextBillingDate, '2020-01-01');
    assert.equal(persisted.data[2].nextBillingDate, '2099-01-01');
    assert.equal(persisted.revision, loaded.revisions.subscriptions);
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: testFileDir,
    env: { ...process.env, DATA_DIR: dataDir },
    encoding: 'utf8',
  });
  await fs.rm(dataDir, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
