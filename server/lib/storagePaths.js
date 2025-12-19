import path from 'path';
import {
  CREDENTIALS_FILE,
  DATA_DIR,
  UPLOADS_DIR,
  EXCHANGE_RATE_KEYPAIR_FILE,
} from './paths.js';

export { CREDENTIALS_FILE, DATA_DIR, UPLOADS_DIR, EXCHANGE_RATE_KEYPAIR_FILE };

export const userDataPath = (username) => path.join(DATA_DIR, `${username}.json`);

