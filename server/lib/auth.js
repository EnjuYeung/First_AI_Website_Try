import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const createAuth = async ({ jwtSecret, storage }) => {
  let credentials = await storage.loadCredentials();
  let adminHash = credentials.passwordHash;
  const cookieName = 'auth_token';
  const tokenMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

  const isSecureRequest = (req) =>
    req.secure || req.headers?.['x-forwarded-proto'] === 'https';

  const baseCookieOptions = (req) => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    path: '/',
  });

  const parseCookies = (cookieHeader = '') => {
    const jar = {};
    cookieHeader.split(';').forEach((part) => {
      const [rawKey, ...rest] = part.split('=');
      if (!rawKey) return;
      const key = rawKey.trim();
      if (!key) return;
      const value = rest.join('=').trim();
      jar[key] = decodeURIComponent(value || '');
    });
    return jar;
  };

  const getTokenFromRequest = (req) => {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (bearer) return bearer;
    const cookies = parseCookies(req.headers?.cookie || '');
    return cookies[cookieName] || '';
  };

  const setAuthCookie = (res, req, token) => {
    res.cookie(cookieName, token, {
      ...baseCookieOptions(req),
      maxAge: tokenMaxAgeMs,
    });
  };

  const clearAuthCookie = (res, req) => {
    res.clearCookie(cookieName, baseCookieOptions(req));
  };

  const signToken = (payload) => jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

  const authMiddleware = (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ message: 'Missing token' });
    try {
      req.user = jwt.verify(token, jwtSecret);
      next();
    } catch {
      clearAuthCookie(res, req);
      return res.status(401).json({ message: 'Invalid token' });
    }
  };

  const verifyAdminPassword = async (password) => bcrypt.compare(password, adminHash);

  const changeAdminPassword = async (newPassword) => {
    const newHash = bcrypt.hashSync(newPassword, 10);
    credentials = { ...credentials, passwordHash: newHash };
    adminHash = newHash;
    await storage.saveCredentials(credentials);
  };

  return {
    getAdminUsername: () => credentials.username,
    signToken,
    authMiddleware,
    verifyAdminPassword,
    changeAdminPassword,
    setAuthCookie,
    clearAuthCookie,
  };
};

