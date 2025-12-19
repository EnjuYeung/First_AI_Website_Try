import dotenv from 'dotenv';

import { bootstrap } from './lib/bootstrap.js';

dotenv.config();

const { config, app, services } = await bootstrap();

app.listen(config.port, () => {
  console.log(`Auth server running on :${config.port}`);
});

services.reminders.startReminderScheduler();
services.exchangeRate.startExchangeRateScheduler({ username: config.adminUser });

