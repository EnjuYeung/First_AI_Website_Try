import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

// Linux/Docker integration check. Only synthetic servers and temporary files
// are used; the production application, configuration and data are untouched.
const exec = promisify(execFile);
const docker = async (...args) => (await exec('docker', args)).stdout.trim();
const listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});
const headers = ['content-security-policy', 'referrer-policy', 'x-content-type-options', 'x-frame-options', 'permissions-policy'];
const backend = http.createServer((req, res) => {
  if (req.url === '/api/stall') return;
  let bytes = 0;
  req.on('data', (chunk) => { bytes += chunk.length; });
  req.on('end', () => {
    for (const name of headers) res.setHeader(name, 'synthetic-upstream-copy');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ bytes }));
  });
});
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'subm-proxy-'));
const name = `subm-proxy-check-${randomUUID().slice(0, 8)}`;
let containerStarted = false;
let proxyPort;

const request = (route, { body, requestHeaders = {}, headersOnly = false } = {}) => new Promise((resolve, reject) => {
  let receivedResponse = false;
  const req = http.request({
    host: '127.0.0.1', port: proxyPort, path: route,
    method: body || headersOnly ? 'POST' : 'GET', headers: requestHeaders,
  }, (res) => {
    receivedResponse = true;
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('error', reject);
    res.on('end', () => {
      req.destroy();
      resolve({ status: res.statusCode, rawHeaders: res.rawHeaders, body: Buffer.concat(chunks).toString() });
    });
  });
  req.on('error', (error) => { if (!receivedResponse) reject(error); });
  req.setTimeout(45000, () => req.destroy(new Error('proxy_test_timeout')));
  if (headersOnly) req.flushHeaders();
  else req.end(body);
});
const check = (response, status) => {
  assert.equal(response.status, status);
  for (const header of headers) {
    const indices = response.rawHeaders.flatMap((name, i) => i % 2 === 0 && name.toLowerCase() === header ? [i] : []);
    assert.equal(indices.length, 1, `${header}: one effective edge header`);
    assert.notEqual(response.rawHeaders[indices[0] + 1], 'synthetic-upstream-copy');
  }
};

try {
  const backendPort = await listen(backend);
  const reservation = http.createServer();
  proxyPort = await listen(reservation);
  await new Promise((resolve) => reservation.close(resolve));
  const template = await fs.readFile(new URL('../deploy/openresty.conf', import.meta.url), 'utf8');
  const config = `worker_processes 1;
events { worker_connections 128; }
http {
  access_log off;
  error_log /dev/stderr error;
  server {
    listen 127.0.0.1:${proxyPort};
    ${template.replaceAll('127.0.0.1:33001', `127.0.0.1:${backendPort}`)}
  }
}
`;
  const configPath = path.join(directory, 'nginx.conf');
  await fs.writeFile(configPath, config);
  await docker('run', '--rm', '-d', '--name', name, '--network', 'host',
    '--mount', `type=bind,src=${configPath},dst=/etc/nginx/nginx.conf,readonly`,
    process.env.PROXY_TEST_IMAGE || 'nginx:alpine');
  containerStarted = true;
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { check(await request('/api/echo'), 200); ready = true; break; }
    catch { await delay(100); }
  }
  assert.ok(ready, 'synthetic gateway starts');

  const withinLimit = Buffer.alloc(8 * 1024 * 1024 + 512 * 1024);
  const allowed = await request('/api/echo', { body: withinLimit, requestHeaders: { 'Content-Length': withinLimit.length } });
  check(allowed, 200);
  assert.equal(JSON.parse(allowed.body).bytes, withinLimit.length);
  check(await request('/api/echo', {
    headersOnly: true, requestHeaders: { 'Content-Length': 9 * 1024 * 1024 + 1, Expect: '100-continue' },
  }), 413);
  check(await request('/api/echo', {
    body: Buffer.alloc(9 * 1024 * 1024 + 1), requestHeaders: { 'Transfer-Encoding': 'chunked' },
  }), 413);
  console.log('Gateway accepts 8.5 MiB and rejects oversized fixed/chunked bodies with security headers');

  const started = Date.now();
  check(await request('/api/stall'), 504);
  assert.ok(Date.now() - started >= 29000, 'API gateway enforces its 30-second read timeout');
  console.log('Gateway 30-second stalled-upstream timeout and security headers passed');

  backend.closeAllConnections();
  await new Promise((resolve) => backend.close(resolve));
  check(await request('/api/echo'), 502);
  console.log('Gateway unavailable-upstream security headers passed');
} finally {
  if (containerStarted) await docker('rm', '-f', name);
  backend.closeAllConnections();
  if (backend.listening) await new Promise((resolve) => backend.close(resolve));
  await fs.rm(directory, { recursive: true, force: true });
}
