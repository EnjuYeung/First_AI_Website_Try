import fs from 'fs/promises';
import path from 'path';
import { createIconUpload } from '../iconUpload.js';
import { validateDataPatch } from '../../../shared/dataSchema.js';

const uploadedIconFilename = (url) =>
  /^\/api\/uploads\/([a-f0-9-]+\.(?:png|jpg|webp))$/i.exec(String(url || ''))?.[1] || '';

export const registerDataRoutes = ({ app, auth, storage, uploadsDir, maxIconBytes }) => {
  const iconUpload = createIconUpload({ uploadsDir, maxIconBytes });
  app.get('/api/data', auth.authMiddleware, async (req, res) => {
    res.json(await storage.loadUserData(req.user.username));
  });
  app.patch('/api/data', auth.authMiddleware, async (req, res) => {
    const error = validateDataPatch(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    let removed = [];
    const updated = await storage.updateUserData(req.user.username, (current) => {
      if (req.body.subscriptions) {
        const retained = new Set(
          req.body.subscriptions.map((sub) => uploadedIconFilename(sub.iconUrl)).filter(Boolean)
        );
        removed = current.subscriptions
          .map((sub) => uploadedIconFilename(sub.iconUrl))
          .filter((filename) => filename && !retained.has(filename));
      }
      return { ...current, ...req.body };
    });
    await Promise.all(
      removed.map((filename) =>
        fs.unlink(path.join(uploadsDir, filename)).catch((err) => {
          if (err?.code !== 'ENOENT') console.error('Failed to remove unused icon', err);
        })
      )
    );
    res.json({ success: true, data: updated });
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
