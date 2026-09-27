import dotenv from 'dotenv';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';

import { bootstrap } from './lib/bootstrap.js';

dotenv.config();

// Telegram IPv4 connections can take longer than Node's default 250 ms.
// Allow time to connect before falling back to potentially unavailable IPv6.
setDefaultAutoSelectFamilyAttemptTimeout(1000);

const { config, app, services } = await bootstrap();

app.listen(config.port, () => {
  console.log(`Auth server running on :${config.port}`);
});

services.reminders.startReminderScheduler();
services.exchangeRate.startExchangeRateScheduler({ username: config.adminUser });

services.telegram.start();
