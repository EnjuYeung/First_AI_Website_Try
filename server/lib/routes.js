import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerDataRoutes } from './routes/dataRoutes.js';
import { registerExchangeRateRoutes } from './routes/exchangeRateRoutes.js';
import { registerNotificationRoutes } from './routes/notificationRoutes.js';

export const registerRoutes = (dependencies) => {
  const { app, config } = dependencies;
  registerAuthRoutes(dependencies);
  registerDataRoutes({
    ...dependencies,
    maxIconBytes: config.maxIconBytes,
    maxWallpaperBytes: config.maxWallpaperBytes,
  });
  registerExchangeRateRoutes(dependencies);
  registerNotificationRoutes(dependencies);
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
};
