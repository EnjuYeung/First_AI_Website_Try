import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SERVER_DIR = path.dirname(__dirname);
export const DATA_DIR = path.join(SERVER_DIR, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');
export const EXCHANGE_RATE_KEYPAIR_FILE = path.join(DATA_DIR, 'exchange-rate-keypair.json');

