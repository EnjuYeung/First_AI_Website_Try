import fs from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { CREDENTIALS_FILE } from '../paths.js';
import { ensureDataDir, waitForPendingWrite, readJson, atomicWriteJson, queueWrite } from './jsonFiles.js';

export const createCredentialStore = ({ adminUser, adminPass }) => {
  const loadCredentials = async () => {
    await ensureDataDir();
    await waitForPendingWrite(CREDENTIALS_FILE);
    try {
      const credentials = await readJson(CREDENTIALS_FILE);
      await fs.chmod(CREDENTIALS_FILE, 0o600);
      return credentials;
    } catch (err) {
      if (err.code === 'ENOENT') {
        const passwordHash = bcrypt.hashSync(adminPass, 10);
        const creds = { username: adminUser, passwordHash, tokenVersion: 0 };
        await atomicWriteJson(CREDENTIALS_FILE, creds);
        return creds;
      }
      throw err;
    }
  };

  const saveCredentials = async (creds) => {
    await ensureDataDir();
    await queueWrite(CREDENTIALS_FILE, () => atomicWriteJson(CREDENTIALS_FILE, creds));
  };

  return { loadCredentials, saveCredentials };
};
