import speakeasy from 'speakeasy';
import { isIP } from 'node:net';
import { isStrongPassword } from '../securityPolicy.js';

export const registerAuthRoutes = ({ app, auth, storage }) => {
  const attempts = new Map();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const maxRateLimitEntries = 1000;
  const loginFields = new Set(['username', 'password', 'code']);
  const loginBodyIsValid = (body) =>
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Object.keys(body).length <= loginFields.size &&
    Object.keys(body).every((key) => key.length <= 32 && loginFields.has(key)) &&
    typeof body.username === 'string' &&
    body.username.length >= 1 &&
    body.username.length <= 128 &&
    typeof body.password === 'string' &&
    body.password.length >= 1 &&
    body.password.length <= 128 &&
    (body.code === undefined ||
      (typeof body.code === 'string' && body.code.length <= 16));
  const clientIp = (req) => {
    const candidate = String(req.ip || req.socket?.remoteAddress || '');
    return candidate.length <= 64 && isIP(candidate) ? candidate.toLowerCase() : '';
  };
  const checkRateLimit = (req, res) => {
    const key = clientIp(req);
    if (!key) {
      res.status(400).json({ message: 'invalid_login_request' });
      return null;
    }
    const now = Date.now();
    const state = attempts.get(key);
    if (!state || state.resetAt <= now) {
      if (state) attempts.delete(key);
      return { key, count: 0, resetAt: now + windowMs };
    }
    if (state.count >= maxAttempts) {
      res.setHeader('Retry-After', String(Math.ceil((state.resetAt - now) / 1000)));
      res.status(429).json({ message: 'too_many_login_attempts' });
      return null;
    }
    return { key, ...state };
  };
  const failLogin = (state) => {
    const now = Date.now();
    if (!attempts.has(state.key) && attempts.size >= maxRateLimitEntries) {
      for (const [key, value] of attempts) {
        if (value.resetAt <= now) attempts.delete(key);
      }
      while (attempts.size >= maxRateLimitEntries) {
        const oldestKey = attempts.keys().next().value;
        if (oldestKey === undefined) break;
        attempts.delete(oldestKey);
      }
    }
    attempts.set(state.key, { count: state.count + 1, resetAt: state.resetAt });
  };
  const verifyCurrentTotp = (security, code) =>
    !security.twoFactorEnabled ||
    (typeof code === 'string' &&
      speakeasy.totp.verify({
        secret: security.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      }));

  app.post('/api/login', async (req, res) => {
    if (!loginBodyIsValid(req.body)) {
      return res.status(400).json({ message: 'invalid_login_request' });
    }
    const { username, password, code } = req.body || {};
    const rateState = checkRateLimit(req, res);
    if (!rateState) return;
    if (username !== auth.getAdminUsername() || !(await auth.verifyAdminPassword(password))) {
      failLogin(rateState);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const data = await storage.loadUserData(username);
    const security = data.settings?.security || {};
    if (security.twoFactorEnabled && security.twoFactorSecret) {
      if (!code) return res.status(403).json({ message: 'two_factor_required' });
      const verified = speakeasy.totp.verify({
        secret: security.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      });
      if (!verified) {
        failLogin(rateState);
        return res.status(401).json({ message: 'invalid_2fa' });
      }
    }
    attempts.delete(rateState.key);
    const token = auth.signToken({ username });
    auth.setAuthCookie(res, req, token);
    res.json({ ok: true, username });
  });

  app.post('/api/logout', (req, res) => {
    auth.clearAuthCookie(res, req);
    res.json({ success: true });
  });
  app.get('/api/me', auth.authMiddleware, (req, res) => res.json({ username: req.user.username }));

  app.post('/api/2fa/init', auth.authMiddleware, async (req, res) => {
    const { currentPassword, code } = req.body || {};
    if (!(await auth.verifyAdminPassword(currentPassword))) {
      return res.status(401).json({ message: 'reauthentication_required' });
    }
    const existing = await storage.loadUserData(req.user.username);
    if (!verifyCurrentTotp(existing.settings.security, code)) {
      return res.status(401).json({ message: 'invalid_2fa' });
    }
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `Subm (${req.user.username})`,
      issuer: 'Subm',
    });
    await storage.updateUserData(req.user.username, (current) => {
      current.settings.security.pendingTwoFactorSecret = secret.base32;
      return current;
    });
    res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url });
  });

  app.post('/api/2fa/verify', auth.authMiddleware, async (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ message: 'Missing code' });
    const data = await storage.loadUserData(req.user.username);
    const secret =
      data.settings?.security?.pendingTwoFactorSecret || data.settings?.security?.twoFactorSecret;
    if (!secret) return res.status(400).json({ message: 'No pending secret' });
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!verified) return res.status(400).json({ message: 'Invalid code' });
    await storage.updateUserData(req.user.username, (current) => {
      const security = current.settings.security;
      if (security.pendingTwoFactorSecret !== secret && security.twoFactorSecret !== secret) {
        throw new Error('two_factor_secret_changed');
      }
      Object.assign(security, {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        pendingTwoFactorSecret: '',
      });
      return current;
    });
    res.json({ success: true });
  });

  app.post('/api/2fa/disable', auth.authMiddleware, async (req, res) => {
    const { currentPassword, code } = req.body || {};
    if (!(await auth.verifyAdminPassword(currentPassword))) {
      return res.status(401).json({ message: 'reauthentication_required' });
    }
    const existing = await storage.loadUserData(req.user.username);
    if (!verifyCurrentTotp(existing.settings.security, code)) {
      return res.status(401).json({ message: 'invalid_2fa' });
    }
    await storage.updateUserData(req.user.username, (current) => {
      Object.assign(current.settings.security, {
        twoFactorEnabled: false,
        twoFactorSecret: '',
        pendingTwoFactorSecret: '',
      });
      return current;
    });
    res.json({ success: true });
  });

  app.post('/api/change-password', auth.authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing password fields' });
    }
    if (!(await auth.verifyAdminPassword(currentPassword))) {
      return res.status(401).json({ message: 'Invalid current password' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ message: 'weak_password' });
    }
    await auth.changeAdminPassword(newPassword);
    const lastPasswordChange = new Date().toISOString();
    try {
      await storage.updateUserData(req.user.username, (current) => {
        current.settings.security.lastPasswordChange = lastPasswordChange;
        return current;
      });
    } catch (metadataError) {
      // The credential write is already committed and all tokens are revoked.
      // Do not report the password change as failed because optional display
      // metadata could not be updated.
      console.error('Failed to update password-change metadata', {
        message: metadataError?.message || 'metadata_update_failed',
      });
    }
    auth.clearAuthCookie(res, req);
    res.json({ success: true, lastPasswordChange });
  });
};
