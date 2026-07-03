import path from 'path';
import {
  CREDENTIALS_FILE,
  DATA_DIR,
  UPLOADS_DIR,
  LEGACY_EXCHANGE_RATE_KEYPAIR_FILE,
  USERS_DIR,
} from './paths.js';

export {
  CREDENTIALS_FILE,
  DATA_DIR,
  UPLOADS_DIR,
  LEGACY_EXCHANGE_RATE_KEYPAIR_FILE,
  USERS_DIR,
};

export const userDataPath = (username) => path.join(DATA_DIR, `${username}.json`);
export const userFeatureDir = (username) => path.join(USERS_DIR, encodeURIComponent(username));
export const userFeaturePath = (username, feature) =>
  path.join(userFeatureDir(username), `${feature}.json`);
