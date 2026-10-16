import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteJson } from '../lib/storage/jsonFiles.js';

test('permission failure before a JSON replacement keeps the committed file and removes temporary data', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'subm-json-permissions-'));
  const target = path.join(directory, 'credentials.json');
  const originalChmod = fs.chmod;
  try {
    await fs.writeFile(target, JSON.stringify({ tokenVersion: 1 }), { mode: 0o600 });
    t.mock.method(fs, 'chmod', async (file, mode) => {
      if (file === target || String(file).startsWith(`${target}.tmp-`)) {
        const error = new Error('synthetic permission failure');
        error.code = 'EPERM';
        throw error;
      }
      return originalChmod(file, mode);
    });
    await assert.rejects(atomicWriteJson(target, { tokenVersion: 2 }), { code: 'EPERM' });
    assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), { tokenVersion: 1 });
    assert.deepEqual(await fs.readdir(directory), ['credentials.json']);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
