import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

test('backend initializes a fresh data directory and serves health and login endpoints', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subm-startup-'));
  const env = {
    DATA_DIR: dataDir,
    ADMIN_USER: 'startup-admin',
    ADMIN_PASS: 'Startup-test-Password-1!',
    JWT_SECRET: 'startup-test-jwt-secret-0123456789abcdef',
    DATA_ENCRYPTION_KEY: 'startup-test-data-key-0123456789abcdef',
  };
  const previousEnv = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, env);
  let server;

  try {
    const { bootstrap } = await import('../lib/bootstrap.js');
    const { app } = await bootstrap();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('cache-control'), 'private, no-store');

    const login = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: process.env.ADMIN_USER,
        password: process.env.ADMIN_PASS,
      }),
    });
    assert.equal(login.status, 200);
    assert.ok(login.headers.has('set-cookie'));
    assert.equal(login.headers.get('cache-control'), 'private, no-store');

    const iconPath = path.join(dataDir, 'uploads', 'cache-test.png');
    await fs.writeFile(iconPath, 'not-a-real-image');
    const icon = await fetch(`${baseUrl}/api/uploads/cache-test.png`);
    assert.equal(icon.status, 200);
    assert.match(icon.headers.get('cache-control') || '', /max-age=31536000/);
    assert.match(icon.headers.get('cache-control') || '', /immutable/);
    assert.doesNotMatch(icon.headers.get('cache-control') || '', /no-store/);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await fs.rm(dataDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
