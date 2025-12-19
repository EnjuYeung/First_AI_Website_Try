import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const allowedIconMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

const iconExtFromMime = (mime) => {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  return '';
};

export const createIconUpload = ({ uploadsDir, maxIconBytes }) =>
  multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = iconExtFromMime(file.mimetype) || path.extname(file.originalname || '') || '';
        cb(null, `${crypto.randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: maxIconBytes },
    fileFilter: (_req, file, cb) => {
      if (!allowedIconMimeTypes.has(file.mimetype)) return cb(new Error('unsupported_file_type'));
      cb(null, true);
    },
  });

