import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

import { UPLOADS_DIR } from './storagePaths.js';
import { registerRoutes } from './routes.js';

export const createApp = ({ config, auth, storage, exchangeRate, email }) => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ?? false);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.path.startsWith('/api/') && !req.path.startsWith('/api/uploads/')) {
      res.setHeader('Cache-Control', 'private, no-store');
    }
    next();
  });

  app.use(
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
    email,
    crypto,
    uploadsDir: UPLOADS_DIR,
  });

  app.use((err, _req, res, next) => {
    if (err?.code === 'cors_origin_denied') {
      return res.status(403).json({ message: 'cors_origin_denied' });
    }
    return next(err);
  });

  return app;
};
