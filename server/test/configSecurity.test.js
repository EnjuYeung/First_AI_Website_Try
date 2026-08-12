import test from 'node:test';
import assert from 'node:assert/strict';

import { getConfig } from '../lib/config.js';

const REQUIRED_ENV = {
  ADMIN_USER: 'admin',
  ADMIN_PASS: 'Config-test-Password-1!',
  JWT_SECRET: 'config-test-jwt-secret-0123456789abcdef',
  DATA_ENCRYPTION_KEY: 'config-test-data-key-0123456789abcdef',
};
const CONFIG_ENV = ['ALLOWED_ORIGINS', 'TRUST_PROXY', 'PUBLIC_BASE_URL', 'TIMEZONE'];

const withEnvironment = (values, callback) => {
  const keys = [...new Set([...Object.keys(REQUIRED_ENV), ...CONFIG_ENV, ...Object.keys(values)])];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of CONFIG_ENV) delete process.env[key];
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
    assert.equal(config.publicBaseUrl, '');
    assert.equal(config.timeZone, 'Asia/Shanghai');
  });
});

test('deployment timezone accepts valid IANA names and rejects invalid values', () => {
  withEnvironment({ TIMEZONE: 'America/New_York' }, () => {
    assert.equal(getConfig().timeZone, 'America/New_York');
  });
  withEnvironment({ TIMEZONE: 'Not/A-Timezone' }, () => {
    assert.throws(() => getConfig(), /TIMEZONE is not a valid IANA timezone/);
  });
});

test('invalid configured CORS origins fail closed at startup', () => {
  withEnvironment({ ALLOWED_ORIGINS: 'https://allowed.example/path' }, () => {
    assert.throws(() => getConfig(), /ALLOWED_ORIGINS contains invalid origin/);
  });
});

test('Telegram public base URL is normalized to an HTTPS origin', () => {
  withEnvironment({ PUBLIC_BASE_URL: 'https://subm.example.test/' }, () => {
    assert.equal(getConfig().publicBaseUrl, 'https://subm.example.test');
  });
});

test('invalid Telegram public base URLs fail closed at startup', () => {
  for (const publicBaseUrl of [
    'http://subm.example.test',
    'subm.example.test',
    'https://subm.example.test/path',
    'https://subm.example.test?source=test',
    'https://subm.example.test#webhook',
    'https://user:pass@subm.example.test',
  ]) {
    withEnvironment({ PUBLIC_BASE_URL: publicBaseUrl }, () => {
      assert.throws(
        () => getConfig(),
        /PUBLIC_BASE_URL must be an HTTPS origin/
      );
    });
  }
});

test('an admin username that cannot fit the login boundary fails at startup', () => {
  withEnvironment({ ADMIN_USER: 'x'.repeat(129) }, () => {
    assert.throws(() => getConfig(), /ADMIN_USER must be 1-128 characters/);
  });
});
