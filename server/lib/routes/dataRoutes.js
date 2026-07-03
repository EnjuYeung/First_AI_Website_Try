import fs from 'fs/promises';
import path from 'path';
import { createIconUpload } from '../iconUpload.js';
import {
  validateNotifications,
  validateSettings,
  validateSubscriptions,
} from '../../../shared/dataSchema.js';

const uploadedIconFilename = (url) =>
  /^\/api\/uploads\/([a-f0-9-]+\.(?:png|jpg|webp))$/i.exec(String(url || ''))?.[1] || '';

export const registerDataRoutes = ({ app, auth, storage, uploadsDir, maxIconBytes }) => {
  const iconUpload = createIconUpload({ uploadsDir, maxIconBytes });
  const expectedRevision = (req) => {
    const raw = String(req.get('if-match') || '').replace(/^W\//, '').replaceAll('"', '');
    const revision = Number(raw);
    return Number.isInteger(revision) && revision >= 0 ? revision : null;
  };
  const updateFeature = async (req, res, feature, updater, afterSuccess) => {
    try {
      const result = await storage.updateUserFeature(
        req.user.username,
        feature,
        expectedRevision(req),
        updater
      );
      if (afterSuccess) await afterSuccess(result.data);
      res.setHeader('ETag', `"${result.revision}"`);
      return res.json({ success: true, data: result.data, revision: result.revision });
    } catch (err) {
      const status = err?.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: err?.message || 'update_failed',
        ...(err?.currentRevision ? { currentRevision: err.currentRevision } : {}),
      });
    }
  };

  app.get('/api/data', auth.authMiddleware, async (req, res) => {
    res.json(await storage.loadUserData(req.user.username));
  });

  app.post('/api/subscriptions', auth.authMiddleware, async (req, res) => {
    const subscription = req.body;
    const error = validateSubscriptions([subscription]);
    if (error) return res.status(400).json({ success: false, message: error });
    return updateFeature(req, res, 'subscriptions', (subscriptions) => {
      if (subscriptions.some((item) => item.id === subscription.id)) {
        const conflict = new Error('duplicate_subscription_id');
        conflict.statusCode = 409;
        throw conflict;
      }
      return [...subscriptions, subscription];
    });
  });

  app.put('/api/subscriptions/:id', auth.authMiddleware, async (req, res) => {
    const subscription = req.body;
    if (subscription?.id !== req.params.id) {
      return res.status(400).json({ success: false, message: 'subscription_id_mismatch' });
    }
    const error = validateSubscriptions([subscription]);
    if (error) return res.status(400).json({ success: false, message: error });
    let replacedIcon = '';
    return updateFeature(req, res, 'subscriptions', (subscriptions) => {
      if (!subscriptions.some((item) => item.id === subscription.id)) {
        const missing = new Error('subscription_not_found');
        missing.statusCode = 404;
        throw missing;
      }
      const previous = subscriptions.find((item) => item.id === subscription.id);
      if (previous?.iconUrl !== subscription.iconUrl) {
        replacedIcon = uploadedIconFilename(previous?.iconUrl);
      }
      return subscriptions.map((item) => item.id === subscription.id ? subscription : item);
    }, async (subscriptions) => {
      if (!replacedIcon || subscriptions.some((item) => uploadedIconFilename(item.iconUrl) === replacedIcon)) return;
      await fs.unlink(path.join(uploadsDir, replacedIcon)).catch((err) => {
        if (err?.code !== 'ENOENT') throw err;
      });
    });
  });

  app.delete('/api/subscriptions/:id', auth.authMiddleware, async (req, res) => {
    let removedIcon = '';
    return updateFeature(req, res, 'subscriptions', (subscriptions) => {
      const removed = subscriptions.find((item) => item.id === req.params.id);
      if (!removed) {
        const missing = new Error('subscription_not_found');
        missing.statusCode = 404;
        throw missing;
      }
      removedIcon = uploadedIconFilename(removed.iconUrl);
      return subscriptions.filter((item) => item.id !== req.params.id);
    }, async (subscriptions) => {
      if (!removedIcon || subscriptions.some((item) => uploadedIconFilename(item.iconUrl) === removedIcon)) return;
      await fs.unlink(path.join(uploadsDir, removedIcon)).catch((err) => {
        if (err?.code !== 'ENOENT') throw err;
      });
    });
  });

  app.post('/api/subscriptions/batch-delete', auth.authMiddleware, async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => typeof id === 'string') : [];
    if (!ids.length) return res.status(400).json({ success: false, message: 'missing_ids' });
    const idSet = new Set(ids);
    let removedIcons = [];
    return updateFeature(req, res, 'subscriptions', (subscriptions) => {
      removedIcons = subscriptions
        .filter((item) => idSet.has(item.id))
        .map((item) => uploadedIconFilename(item.iconUrl))
        .filter(Boolean);
      return subscriptions.filter((item) => !idSet.has(item.id));
    }, async (subscriptions) => {
      const retained = new Set(subscriptions.map((item) => uploadedIconFilename(item.iconUrl)).filter(Boolean));
      await Promise.all(removedIcons.filter((icon) => !retained.has(icon)).map((icon) =>
        fs.unlink(path.join(uploadsDir, icon)).catch((err) => {
          if (err?.code !== 'ENOENT') throw err;
        })
      ));
    });
  });

  app.put('/api/settings', auth.authMiddleware, async (req, res) => {
    const error = validateSettings(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    return updateFeature(req, res, 'settings', () => req.body);
  });

  app.delete('/api/notifications/:id', auth.authMiddleware, async (req, res) =>
    updateFeature(req, res, 'notifications', (notifications) =>
      notifications.filter((item) => item.id !== req.params.id)
    )
  );

  app.delete('/api/notifications', auth.authMiddleware, async (req, res) => {
    const error = validateNotifications([]);
    if (error) return res.status(400).json({ success: false, message: error });
    return updateFeature(req, res, 'notifications', () => []);
  });
  app.post('/api/icons', auth.authMiddleware, async (req, res) => {
    await storage.ensureDataDir();
    iconUpload.single('file')(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ ok: false, message: 'icon_too_large' });
      }
      if (err) return res.status(400).json({ ok: false, message: err.message || 'upload_failed' });
      if (!req.file?.filename) return res.status(400).json({ ok: false, message: 'missing_file' });
      res.json({ ok: true, url: `/api/uploads/${req.file.filename}` });
    });
  });
  app.delete('/api/icons/:filename', auth.authMiddleware, async (req, res) => {
    const filename = String(req.params.filename || '');
    if (!/^[a-f0-9-]+\.(png|jpg|webp)$/i.test(filename) || path.basename(filename) !== filename) {
      return res.status(400).json({ ok: false, message: 'invalid_icon_filename' });
    }
    await fs.unlink(path.join(uploadsDir, filename)).catch((err) => {
      if (err?.code !== 'ENOENT') throw err;
    });
    res.json({ ok: true });
  });
};
