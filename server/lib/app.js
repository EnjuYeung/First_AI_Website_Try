import express from 'express';
import cors from 'cors';

import { FRONTEND_DIR, UPLOADS_DIR } from './paths.js';
import { registerRoutes } from './routes.js';
import { applyHttpPolicy } from './httpPolicy.js';
import { registerFrontend } from './frontend.js';

export const createApp = ({ config, auth, storage, exchangeRate, frontendDir = FRONTEND_DIR }) => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ?? false);

  app.use(applyHttpPolicy);

  app.all(/^\/api$/, (req, res) => {
    const query = req.originalUrl.indexOf('?');
    res.redirect(301, `/api/${query >= 0 ? req.originalUrl.slice(query) : ''}`);
  });

  app.use(
    '/api',
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (config.allowedOrigins.includes(origin)) return cb(null, true);
        const error = new Error('cors_origin_denied');
        error.code = 'cors_origin_denied';
        return cb(error);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: config.jsonBodyLimit }));

  app.use(
    '/api/uploads',
    (req, res, next) => {
      if (req.path?.toLowerCase?.().endsWith('.svg')) return res.status(404).end();
      next();
    },
    express.static(UPLOADS_DIR, {
      fallthrough: false,
      maxAge: '365d',
      immutable: true,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    })
  );

  registerRoutes({
    app,
    config,
    auth,
    storage,
    exchangeRate,
    uploadsDir: UPLOADS_DIR,
  });

  registerFrontend(app, {
    directory: frontendDir,
    required: process.env.NODE_ENV === 'production',
  });

  app.use((err, _req, res, next) => {
    if (err?.code === 'cors_origin_denied') {
      return res.status(403).json({ message: 'cors_origin_denied' });
    }
    return next(err);
  });

  return app;
};
