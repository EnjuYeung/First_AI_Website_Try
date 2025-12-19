import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

import { UPLOADS_DIR } from './storagePaths.js';
import { registerRoutes } from './routes.js';

export const createApp = ({ config, auth, storage, reminders, exchangeRate, email }) => {
  const app = express();
  app.disable('x-powered-by');

  app.use((_, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, origin);
        if (config.allowedOrigins.includes(origin)) return cb(null, origin);
        return cb(new Error('Not allowed by CORS'));
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
    reminders,
    exchangeRate,
    email,
    crypto,
    uploadsDir: UPLOADS_DIR,
  });

  return app;
};
