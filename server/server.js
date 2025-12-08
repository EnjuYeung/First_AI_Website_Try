import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Environment variables (can be overridden in deployment)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'passwords';
const JWT_SECRET = process.env.JWT_SECRET || 'hAhJwsNwQLc1b2tIGLjIupRVphNue5vbdPxoAoeBMUg=';
const PORT = process.env.PORT || 3001;

// Allow only specific origins
const allowedOrigins = [
  'https://subm.junziguozi.cc',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, origin); // allow non-browser or health checks
      if (allowedOrigins.includes(origin)) return cb(null, origin);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

app.use(express.json());

// Hash admin password at startup (for production you could pre-store a hash)
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASS, 10);

const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, ADMIN_HASH);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = signToken({ username });
  res.json({ token, username });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Auth server running on :${PORT}`);
});
