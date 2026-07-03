import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

test('storage migrates to feature files, prunes notifications, enforces revisions and permissions', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subm-storage-v2-'));
  const username = 'admin';
  const now = Date.now();
  await fs.writeFile(
    path.join(dataDir, `${username}.json`),
    JSON.stringify({
      subscriptions: [],
      notifications: [
        { id: 'old', type: 'renewal_reminder', timestamp: now - 91 * 86400000, details: {} },
        { id: 'recent', type: 'renewal_reminder', timestamp: now, details: {} },
      ],
      settings: {
        language: 'zh',
        timezone: 'Asia/Shanghai',
        theme: 'system',
        notifications: { rules: { reminderDays: 3 } },
      },
    })
  );

  const testFileDir = path.dirname(fileURLToPath(import.meta.url));
  const storageUrl = new URL('../lib/storage.js', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs/promises';
    import path from 'node:path';
    const { createStorage } = await import(${JSON.stringify(storageUrl)});
    const storage = createStorage({ adminUser: 'admin', adminPass: 'password' });
    const data = await storage.loadUserData('admin');
    assert.deepEqual(data.notifications.map((item) => item.id), ['recent']);
    assert.equal(data.revisions.subscriptions, 1);
    data.subscriptions.push({ id: 'mutated-outside-cache' });
    const cachedData = await storage.loadUserData('admin');
    assert.deepEqual(cachedData.subscriptions, []);
    const subscriptionsPath = path.join(
      process.env.DATA_DIR,
      'users',
      'admin',
      'subscriptions.json'
    );
    await fs.writeFile(
      subscriptionsPath,
      JSON.stringify({
        schemaVersion: 1,
        revision: 99,
        updatedAt: new Date().toISOString(),
        data: [{ id: 'external-change' }],
      })
    );
    const cachedAfterExternalWrite = await storage.loadUserData('admin');
    assert.equal(cachedAfterExternalWrite.revisions.subscriptions, 1);
    assert.deepEqual(cachedAfterExternalWrite.subscriptions, []);
    const created = await storage.updateUserFeature('admin', 'subscriptions', 1, (items) => [
      ...items,
      { id: 'sub-1' }
    ]);
    assert.equal(created.revision, 2);
    const persisted = JSON.parse(await fs.readFile(subscriptionsPath, 'utf8'));
    assert.equal(persisted.revision, 2);
    assert.deepEqual(persisted.data, [{ id: 'sub-1' }]);
    const updatedData = await storage.updateUserData('admin', (current) => {
      current.settings.theme = 'dark';
      return current;
    });
    assert.equal(updatedData.settings.theme, 'dark');
    const settingsPath = path.join(
      process.env.DATA_DIR,
      'users',
      'admin',
      'settings.json'
    );
    const persistedSettings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    assert.equal(persistedSettings.data.theme, 'dark');
    assert.equal(persistedSettings.revision, 2);
    await assert.rejects(
      () => storage.updateUserFeature('admin', 'subscriptions', 1, (items) => items),
      (error) => error.statusCode === 409
    );
    const userDir = path.join(process.env.DATA_DIR, 'users', 'admin');
    for (const feature of ['subscriptions', 'notifications', 'settings']) {
      assert.equal((await fs.stat(path.join(userDir, feature + '.json'))).mode & 0o777, 0o600);
    }
    assert.equal((await fs.stat(userDir)).mode & 0o777, 0o700);
    await assert.rejects(() => fs.access(path.join(process.env.DATA_DIR, 'admin.json')));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: testFileDir,
    env: { ...process.env, DATA_DIR: dataDir },
    encoding: 'utf8',
  });
  await fs.rm(dataDir, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
