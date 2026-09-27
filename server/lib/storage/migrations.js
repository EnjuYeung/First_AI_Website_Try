import fs from 'node:fs/promises';
import { userDataPath, userFeaturePath } from '../paths.js';
import { defaultUserData } from '../defaults.js';
import { ensureDataDir, readJson, queueWrite } from './jsonFiles.js';
import { FEATURES, makeDocument } from './featureDocuments.js';

/** Import legacy monolithic files without overwriting already migrated features. */
export const createUserMigration = (documents, normalizeInitialData) => {
  const migrated = new Set();
  return async (username) => {
    if (migrated.has(username)) return;
    await queueWrite(`migration:${username}`, async () => {
      if (migrated.has(username)) return;
      await ensureDataDir();
      const existing = await Promise.all(FEATURES.map(async feature => {
        try { await fs.access(userFeaturePath(username, feature)); return true; }
        catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
      }));
      if (!existing.every(Boolean)) {
        let legacy;
        try { legacy = await readJson(userDataPath(username)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const initial = legacy || defaultUserData();
        // A partial migration must use existing subscriptions when reconciling history.
        const complete = { ...initial };
        for (const [index, feature] of FEATURES.entries()) {
          if (existing[index]) complete[feature] = (await documents.read(username, feature)).data;
        }
        const values = normalizeInitialData(complete);
        for (const [index, feature] of FEATURES.entries()) {
          if (!existing[index]) await documents.write(username, feature, makeDocument(values[feature]));
        }
        if (legacy) await fs.unlink(userDataPath(username)).catch(error => {
          if (error.code !== 'ENOENT') throw error;
        });
      }
      migrated.add(username);
    });
  };
};
