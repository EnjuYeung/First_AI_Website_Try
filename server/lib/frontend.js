import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';

const immutableCache = 'public, max-age=31536000, immutable';

export const registerFrontend = (app, { directory, required = false }) => {
  const indexFile = path.join(directory, 'index.html');
  if (!existsSync(indexFile)) {
    if (required) throw new Error('Frontend build missing: build the application before production startup');
    return;
  }

  app.use('/assets', (req, res, next) => {
    res.setHeader('Cache-Control', immutableCache);
    next();
  }, express.static(path.join(directory, 'assets'), {
    index: false,
    redirect: false,
    fallthrough: false,
    cacheControl: false,
  }));

  const serveFile = express.static(directory, {
    index: false,
    redirect: false,
    cacheControl: false,
  });
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || /^\/api(?:\/|$)/i.test(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    serveFile(req, res, (error) => {
      if (error) return next(error);
      res.sendFile(indexFile, { cacheControl: false }, (sendError) => {
        if (sendError) next(sendError);
      });
    });
  });
};
