import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverNotificationAttempt } from '../lib/notificationDelivery.js';

const fixture = (type) => {
  let value = { notifications: [] };
  let queue = Promise.resolve();
  let writes = 0;
  let failAt = 0;
  const storage = {
    updateUserData(_username, updater) {
      const result = queue.then(async () => {
        writes += 1;
        const draft = structuredClone(value);
        const updated = await updater(draft);
        if (writes === failAt) throw new Error('disk unavailable');
        value = structuredClone(updated);
        return structuredClone(value);
      });
      queue = result.catch(() => {});
      return result;
    },
  };
  const args = {
    storage, username: 'admin',
    record: { id: 'attempt', type, channel: 'telegram', timestamp: Date.now(), details: { periodKey: '2026-09' } },
    canClaim: () => true,
    findExisting: current => current.notifications.find(n => n.type === type),
  };
  return { args, read: () => value, failWrite: number => { failAt = number; } };
};

for (const type of ['renewal_reminder', 'monthly_summary']) {
  test(`${type}: concurrent claims send only once after durable attempting state`, async () => {
    const f = fixture(type);
    let sends = 0;
    const send = async () => {
      assert.equal(f.read().notifications[0].details.deliveryState, 'attempting');
      sends += 1;
    };
    await Promise.all([deliverNotificationAttempt({ ...f.args, send }), deliverNotificationAttempt({ ...f.args, send })]);
    assert.equal(sends, 1);
    assert.equal(f.read().notifications[0].details.deliveryState, 'delivered');
  });
  test(`${type}: failed pre-send persistence never calls the channel`, async (t) => {
    t.mock.method(console, 'error', () => {});
    const f = fixture(type);
    f.failWrite(1);
    let sends = 0;
    const result = await deliverNotificationAttempt({ ...f.args, send: async () => { sends += 1; } });
    assert.equal(result.state, 'unpersisted');
    assert.equal(sends, 0);
    assert.equal(f.read().notifications.length, 0);
  });
  test(`${type}: timeout is unknown and failed finalization remains non-retryable`, async (t) => {
    t.mock.method(console, 'error', () => {});
    for (const failFinalization of [false, true]) {
      const f = fixture(type);
      if (failFinalization) f.failWrite(2);
      let sends = 0;
      const send = async () => { sends += 1; throw new Error('telegram_timeout'); };
      await deliverNotificationAttempt({ ...f.args, send });
      await deliverNotificationAttempt({ ...f.args, send });
      assert.equal(sends, 1);
      assert.equal(f.read().notifications[0].details.deliveryState, failFinalization ? 'attempting' : 'unknown');
    }
  });
}
