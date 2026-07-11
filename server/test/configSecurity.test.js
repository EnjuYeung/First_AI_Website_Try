import test from 'node:test';
import assert from 'node:assert/strict';

import { getConfig } from '../lib/config.js';

const REQUIRED_ENV = {
  ADMIN_USER: 'admin',
  ADMIN_PASS: 'Config-test-Password-1!',
  JWT_SECRET: 'config-test-jwt-secret-0123456789abcdef',
  DATA_ENCRYPTION_KEY: 'config-test-data-key-0123456789abcdef',
};
const CONFIG_ENV = ['ALLOWED_ORIGINS', 'TRUST_PROXY'];

const withEnvironment = (values, callback) => {
  const keys = [...new Set([...Object.keys(REQUIRED_ENV), ...CONFIG_ENV, ...Object.keys(values)])];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, REQUIRED_ENV, values);
  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test('CORS origins and trusted proxies are explicitly configurable', () => {
  withEnvironment({
    ALLOWED_ORIGINS: 'https://one.example, http://localhost:4321/',
    TRUST_PROXY: 'loopback, 10.0.0.0/8',
  }, () => {
    const config = getConfig();
    assert.deepEqual(config.allowedOrigins, [
      'https://one.example',
      'http://localhost:4321',
    ]);
    assert.equal(config.trustProxy, 'loopback, 10.0.0.0/8');
  });
});

test('default browser origins include the Compose frontend', () => {
  withEnvironment({}, () => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.TRUST_PROXY;
    const config = getConfig();
    assert.ok(config.allowedOrigins.includes('http://localhost:3001'));
    assert.match(String(config.trustProxy), /uniquelocal/);
  });
});

test('invalid configured CORS origins fail closed at startup', () => {
  withEnvironment({ ALLOWED_ORIGINS: 'https://allowed.example/path' }, () => {
    assert.throws(() => getConfig(), /ALLOWED_ORIGINS contains invalid origin/);
  });
});

test('an admin username that cannot fit the login boundary fails at startup', () => {
  withEnvironment({ ADMIN_USER: 'x'.repeat(129) }, () => {
    assert.throws(() => getConfig(), /ADMIN_USER must be 1-128 characters/);
  });
});
