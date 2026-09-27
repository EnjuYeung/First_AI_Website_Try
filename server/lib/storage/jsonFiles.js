import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, UPLOADS_DIR, USERS_DIR } from '../paths.js';

export const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
};

export const atomicWriteJson = async (filePath, data) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.chmod(path.dirname(filePath), 0o700);
  const tmpPath = `${filePath}.tmp-${crypto.randomUUID()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
  await fs.rename(tmpPath, filePath);
  await fs.chmod(filePath, 0o600);
};

const pendingWrites = new Map();

export const waitForPendingWrite = async (key) => {
  const pending = pendingWrites.get(key);
  if (!pending) return;
  try {
    await pending;
  } catch {
    // ignore write failure for waiters
  }
};

export const queueWrite = async (key, writeFn) => {
  const previous = pendingWrites.get(key) || Promise.resolve();
  const next = previous.then(writeFn, writeFn);
  const tracked = next.finally(() => {
    if (pendingWrites.get(key) === tracked) pendingWrites.delete(key);
  });
  pendingWrites.set(key, tracked);
  return tracked;
};

const cleanupStaleTempFiles = async (dir) => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await cleanupStaleTempFiles(fullPath);
      return;
    }
    if (!entry.name.includes('.tmp-')) return;
    try {
      const stat = await fs.stat(fullPath);
      if (stat.mtimeMs < cutoff) await fs.unlink(fullPath);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }));
};

export const ensureDataDir = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(UPLOADS_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(USERS_DIR, { recursive: true, mode: 0o700 });
  await Promise.all([DATA_DIR, UPLOADS_DIR, USERS_DIR].map((dir) => fs.chmod(dir, 0o700)));
  await cleanupStaleTempFiles(DATA_DIR);
};
