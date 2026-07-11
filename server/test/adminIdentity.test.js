import test from 'node:test';
import assert from 'node:assert/strict';

import { assertAdminIdentity } from '../lib/bootstrap.js';

test('startup accepts the configured persisted administrator identity', () => {
  assert.doesNotThrow(() => assertAdminIdentity('admin', 'admin'));
});

test('startup fails closed when ADMIN_USER drifts from persisted credentials', () => {
  assert.throws(
    () => assertAdminIdentity('new-admin', 'existing-admin'),
    /does not match persisted credentials/
  );
});
