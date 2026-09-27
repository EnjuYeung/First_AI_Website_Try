import { ensureDataDir, queueWrite } from './storage/jsonFiles.js';
import { FEATURES, createFeatureDocuments } from './storage/featureDocuments.js';
import { createUserMigration } from './storage/migrations.js';
import { createCredentialStore } from './storage/credentials.js';
import { reconcileUserData } from './userDataLifecycle.js';

export { ensureDataDir } from './storage/jsonFiles.js';

/** Coordinates file transactions. Domain changes enter only through reconcileUserData. */
export const createStorage = ({ adminUser, adminPass, timeZone = 'Asia/Shanghai' }) => {
  const documents = createFeatureDocuments();
  const normalize = data => reconcileUserData(data, timeZone);
  const migrate = createUserMigration(documents, normalize);
  const valuesOf = docs => Object.fromEntries(FEATURES.map(feature => [feature, docs[feature].data]));
  const resultOf = docs => ({
    ...valuesOf(docs),
    revisions: Object.fromEntries(FEATURES.map(feature => [feature, docs[feature].revision])),
  });
  const persist = async (username, docs, values, forceFeature) => {
    for (const feature of FEATURES) {
      docs[feature] = await documents.persist(username, feature, docs[feature], values[feature], feature === forceFeature);
    }
    return docs;
  };
  const withUserDocuments = async (username, operation) => {
    await migrate(username);
    return queueWrite(`user:${username}`, async () => {
      const docs = Object.fromEntries(await Promise.all(FEATURES.map(async feature => [feature, await documents.read(username, feature)])));
      // Explicit maintenance boundary: billing first, then notification feedback/retention.
      await persist(username, docs, normalize(valuesOf(docs)));
      return operation(docs);
    });
  };
  const loadUserData = username => withUserDocuments(username, resultOf);
  const updateUserData = (username, updater) => withUserDocuments(username, async docs => {
    const current = structuredClone(valuesOf(docs));
    const updated = (await updater(current)) || current;
    await persist(username, docs, normalize(updated));
    return resultOf(docs);
  });
  const updateUserFeature = async (username, feature, expectedRevision, updater) => {
    if (!FEATURES.includes(feature)) throw new Error('unknown_storage_feature');
    return withUserDocuments(username, async docs => {
      const document = docs[feature];
      if (!Number.isInteger(expectedRevision) || document.revision !== expectedRevision) {
        const error = new Error(Number.isInteger(expectedRevision) ? 'revision_conflict' : 'precondition_required');
        error.statusCode = Number.isInteger(expectedRevision) ? 409 : 428;
        if (error.statusCode === 409) error.currentRevision = document.revision;
        throw error;
      }
      const values = valuesOf(docs);
      values[feature] = await updater(structuredClone(document.data));
      await persist(username, docs, normalize(values), feature);
      return { data: docs[feature].data, revision: docs[feature].revision };
    });
  };
  return {
    ensureDataDir,
    ...createCredentialStore({ adminUser, adminPass }),
    loadUserData, updateUserData, updateUserFeature,
  };
};
