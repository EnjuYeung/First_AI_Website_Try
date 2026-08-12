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

const removeLegacySettingsFields = (settings) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return settings;
  const notifications = settings.notifications;
  if (!notifications || typeof notifications !== 'object' || Array.isArray(notifications)) {
    return settings;
  }
  const { scheduledTask: _scheduledTask, ...currentNotifications } = notifications;
  return { ...settings, notifications: currentNotifications };
};

const clientSettings = (settings) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return settings;
  const security = settings.security || {};
  return {
    ...settings,
    security: {
      twoFactorEnabled: Boolean(security.twoFactorEnabled),
      lastPasswordChange: security.lastPasswordChange,
    },
  };
};

const clientUserData = (data) => ({
  ...data,
  settings: clientSettings(data?.settings),
});

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
      if (afterSuccess) {
        try {
          await afterSuccess(result.data);
        } catch (cleanupError) {
          // The feature write is already committed. Report success to preserve
          // truthful revision semantics and leave file cleanup as best effort.
          console.error('Post-update cleanup failed', {
            feature,
            message: cleanupError?.message || 'cleanup_failed',
          });
        }
      }
      res.setHeader('ETag', `"${result.revision}"`);
      const responseData = feature === 'settings' ? clientSettings(result.data) : result.data;
      return res.json({ success: true, data: responseData, revision: result.revision });
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
    res.json({
      ...clientUserData(await storage.loadUserData(req.user.username)),
      serverTime: Date.now(),
    });
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
    const settings = removeLegacySettingsFields(req.body);
    return updateFeature(req, res, 'settings', (currentSettings) => {
      const {
        language: _language,
        theme: _theme,
        security: _security,
        ...serverSettings
      } = settings || {};
      const nextSettings = {
        ...currentSettings,
        ...serverSettings,
        // Language and theme are client-only preferences. Preserve legacy
        // values only to keep the persisted settings schema compatible.
        language: currentSettings.language,
        theme: currentSettings.theme,
        // Exchange-rate credentials, rates, and scheduler state are server-managed.
        // Replace them before validation so stale legacy metadata from a client
        // cannot block an unrelated preference update.
        exchangeRateApi: currentSettings.exchangeRateApi,
        exchangeRates: currentSettings.exchangeRates,
        lastRatesUpdate: currentSettings.lastRatesUpdate,
        // 2FA secrets and status can only be changed by the dedicated,
        // reauthenticated /api/2fa routes.
        security: currentSettings.security,
      };
      const error = validateSettings(nextSettings);
      if (error) {
        const validationError = new Error(error);
        validationError.statusCode = 400;
        throw validationError;
      }
      return nextSettings;
    });
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
