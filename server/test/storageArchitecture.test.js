import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const runIsolated = async (script) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'subm-storage-architecture-'));
  try {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, DATA_DIR: dir }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
};
const moduleUrl = relative => JSON.stringify(new URL(relative, import.meta.url).href);

test('interrupted migration resumes using persisted subscriptions and only removes legacy data after success', () => runIsolated(`
  import assert from 'node:assert/strict';
  import fs from 'node:fs/promises';
  import { createFeatureDocuments, makeDocument } from ${moduleUrl('../lib/storage/featureDocuments.js')};
  import { createUserMigration } from ${moduleUrl('../lib/storage/migrations.js')};
  import { reconcileUserData } from ${moduleUrl('../lib/userDataLifecycle.js')};
  import { userDataPath, userFeaturePath } from ${moduleUrl('../lib/paths.js')};
  import { defaultUserData } from ${moduleUrl('../lib/defaults.js')};
  import { ensureDataDir } from ${moduleUrl('../lib/storage/jsonFiles.js')};
  await ensureDataDir();
  const legacy = defaultUserData();
  legacy.subscriptions = [{ id: 'one', name: 'One', status: 'active', startDate: '2020-01-01', nextBillingDate: '2020-01-01', frequency: 'Monthly' }];
  legacy.notifications = [{ id: 'note', type: 'renewal_reminder', timestamp: Date.now(), details: { subscriptionId: 'one', date: '2020-01-01', renewalFeedback: 'pending' } }];
  await fs.writeFile(userDataPath('admin'), JSON.stringify(legacy));
  const documents = createFeatureDocuments();
  const cancelled = [{ ...legacy.subscriptions[0], status: 'cancelled', nextBillingDate: '' }];
  await documents.write('admin', 'subscriptions', makeDocument(cancelled, 7));
  let writes = 0;
  const unreliable = { ...documents, write: async (...args) => {
    writes += 1;
    if (writes === 2) throw new Error('simulated failure');
    return documents.write(...args);
  } };
  const migrate = createUserMigration(unreliable, data => reconcileUserData(data, 'UTC'));
  await assert.rejects(migrate('admin'), /simulated failure/);
  await fs.access(userDataPath('admin'));
  await migrate('admin');
  await assert.rejects(fs.access(userDataPath('admin')), { code: 'ENOENT' });
  const subscriptions = JSON.parse(await fs.readFile(userFeaturePath('admin', 'subscriptions')));
  const notifications = JSON.parse(await fs.readFile(userFeaturePath('admin', 'notifications')));
  assert.equal(subscriptions.revision, 7);
  assert.equal(subscriptions.data[0].status, 'cancelled');
  assert.equal(notifications.data[0].details.renewalFeedback, 'deprecated');
`));

test('storage serializes conflicting writers and isolates cached and returned snapshots', () => runIsolated(`
  import assert from 'node:assert/strict';
  import { createStorage } from ${moduleUrl('../lib/storage.js')};
  const config = { adminUser: 'admin', adminPass: 'synthetic-password', timeZone: 'UTC' };
  const storage = createStorage(config);
  const initial = await storage.loadUserData('admin');
  const revision = initial.revisions.settings;
  initial.settings.customCategories.push('should not persist');
  const results = await Promise.allSettled(['A', 'B'].map(name =>
    storage.updateUserFeature('admin', 'settings', revision, current => ({ ...current, customCategories: [name] }))
  ));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.statusCode, 409);
  assert.equal(rejected.reason.currentRevision, revision + 1);
  const loaded = await storage.loadUserData('admin');
  const fromDisk = await createStorage(config).loadUserData('admin');
  assert.deepEqual(loaded, fromDisk);
  assert.deepEqual(loaded.settings.customCategories, ['A']);
  loaded.settings.customCategories.push('another mutation');
  assert.deepEqual((await storage.loadUserData('admin')).settings.customCategories, ['A']);
`));
