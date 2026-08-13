import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

test('loading overdue active reminders does not infer renewed or rewrite the file', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subm-notify-normalize-'));
  const userDir = path.join(dataDir, 'users', 'admin');
  await fs.mkdir(userDir, { recursive: true, mode: 0o700 });
  const document = (data, revision = 1) => ({
    schemaVersion: 1,
    revision,
    updatedAt: '2026-01-01T00:00:00.000Z',
    data,
  });
  await fs.writeFile(path.join(userDir, 'subscriptions.json'), JSON.stringify(document([{
    id: 'sub-1',
    name: 'Overdue',
    status: 'active',
    nextBillingDate: '2020-01-01',
  }])));
  await fs.writeFile(path.join(userDir, 'notifications.json'), JSON.stringify(document([{
    id: 'note-1',
    subscriptionName: 'Overdue',
    type: 'renewal_reminder',
    status: 'success',
    channel: 'telegram',
    timestamp: Date.now(),
    details: {
      date: '2020-01-01',
      subscriptionId: 'sub-1',
      renewalFeedback: 'pending',
    },
  }])));
  await fs.writeFile(path.join(userDir, 'settings.json'), JSON.stringify(document({})));

  const testFileDir = path.dirname(fileURLToPath(import.meta.url));
  const storageUrl = new URL('../lib/storage.js', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs/promises';
    import path from 'node:path';
    const { createStorage } = await import(${JSON.stringify(storageUrl)});
    const storage = createStorage({
      adminUser: 'admin',
      adminPass: 'password',
      timeZone: 'UTC',
    });
    const loaded = await storage.loadUserData('admin');
    assert.equal(loaded.notifications[0].details.renewalFeedback, 'pending');
    const persisted = JSON.parse(await fs.readFile(path.join(process.env.DATA_DIR, 'users', 'admin', 'notifications.json'), 'utf8'));
    assert.equal(persisted.revision, 1);
    assert.equal(persisted.data[0].details.renewalFeedback, 'pending');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: testFileDir,
    env: { ...process.env, DATA_DIR: dataDir },
    encoding: 'utf8',
  });
  await fs.rm(dataDir, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
