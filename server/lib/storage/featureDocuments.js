import { readJson, atomicWriteJson } from './jsonFiles.js';
import { userFeaturePath } from '../paths.js';

export const FEATURES = ['subscriptions', 'notifications', 'settings'];
export const makeDocument = (data, revision = 1) => ({
  schemaVersion: 1, revision, updatedAt: new Date().toISOString(), data,
});

/** Per-storage-instance cache. All callers hold the user write queue. */
export const createFeatureDocuments = () => {
  const cache = new Map();
  const key = (username, feature) => `${username}\0${feature}`;
  const write = async (username, feature, document) => {
    await atomicWriteJson(userFeaturePath(username, feature), document);
    cache.set(key(username, feature), structuredClone(document));
    return structuredClone(document);
  };
  const read = async (username, feature) => {
    const cached = cache.get(key(username, feature));
    if (cached) return structuredClone(cached);
    const raw = await readJson(userFeaturePath(username, feature));
    const document = {
      schemaVersion: 1,
      revision: Number.isInteger(raw.revision) ? raw.revision : 1,
      updatedAt: raw.updatedAt || new Date(0).toISOString(),
      data: raw.data,
    };
    cache.set(key(username, feature), structuredClone(document));
    return structuredClone(document);
  };
  const persist = async (username, feature, previous, data, force = false) => {
    if (!force && JSON.stringify(previous.data) === JSON.stringify(data)) return previous;
    return write(username, feature, makeDocument(data, previous.revision + 1));
  };
  return { read, write, persist };
};
