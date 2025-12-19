import { getConfig } from './config.js';
import { createStorage, ensureDataDir } from './storage.js';
import { createAuth } from './auth.js';
import { createEmail } from './email.js';
import { createReminders } from './reminders.js';
import { createExchangeRate } from './exchangeRate.js';
import * as defaults from './defaults.js';
import { createApp } from './app.js';

export const bootstrap = async () => {
  const config = getConfig();
  await ensureDataDir();

  const storage = createStorage({ adminUser: config.adminUser, adminPass: config.adminPass });

  const auth = await createAuth({ jwtSecret: config.jwtSecret, storage });
  const email = createEmail({ smtp: config.smtp });
  const reminders = createReminders({ config, storage, email });

  const exchangeRate = createExchangeRate({ storage, defaults });

  const app = createApp({ config, auth, storage, reminders, exchangeRate, email });

  return { config, app, services: { auth, storage, reminders, exchangeRate, email } };
};
