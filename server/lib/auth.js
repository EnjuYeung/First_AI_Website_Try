import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const createAuth = async ({ jwtSecret, storage }) => {
  let credentials = await storage.loadCredentials();
  let adminHash = credentials.passwordHash;
  let tokenVersion = Number.isInteger(credentials.tokenVersion) ? credentials.tokenVersion : 0;
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
      try {
        jar[key] = decodeURIComponent(value || '');
      } catch {
        // A malformed cookie must not crash authentication for the whole request.
        // Keep it raw so an invalid auth token is handled by the normal JWT check.
        jar[key] = value || '';
      }
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

  const signToken = (payload) => jwt.sign({ ...payload, tokenVersion }, jwtSecret, {
    expiresIn: '7d',
    issuer: 'subm',
    audience: 'subm-web',
  });

  const authMiddleware = (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ message: 'Missing token' });
    try {
      req.user = jwt.verify(token, jwtSecret, { issuer: 'subm', audience: 'subm-web' });
      if (req.user.tokenVersion !== tokenVersion) throw new Error('revoked_token');
      next();
    } catch {
      clearAuthCookie(res, req);
      return res.status(401).json({ message: 'Invalid token' });
    }
  };

  const verifyAdminPassword = async (password) => bcrypt.compare(password, adminHash);

  const changeAdminPassword = async (newPassword) => {
    const newHash = bcrypt.hashSync(newPassword, 10);
    tokenVersion += 1;
    credentials = { ...credentials, passwordHash: newHash, tokenVersion };
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
