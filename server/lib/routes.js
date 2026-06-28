import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerDataRoutes } from './routes/dataRoutes.js';
import { registerExchangeRateRoutes } from './routes/exchangeRateRoutes.js';
import { registerNotificationRoutes } from './routes/notificationRoutes.js';
import { registerTelegramWebhookRoutes } from './routes/telegramWebhookRoutes.js';

export const registerRoutes = (dependencies) => {
  const { app, config } = dependencies;
  registerTelegramWebhookRoutes(dependencies);
  registerAuthRoutes(dependencies);
  registerDataRoutes({ ...dependencies, maxIconBytes: config.maxIconBytes });
  registerExchangeRateRoutes(dependencies);
  registerNotificationRoutes(dependencies);
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
};
