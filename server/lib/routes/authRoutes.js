import speakeasy from 'speakeasy';

export const registerAuthRoutes = ({ app, auth, storage }) => {
  app.post('/api/login', async (req, res) => {
    const { username, password, code } = req.body || {};
    if (username !== auth.getAdminUsername() || !(await auth.verifyAdminPassword(password))) {
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
      if (!verified) return res.status(401).json({ message: 'invalid_2fa' });
    }
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
    await auth.changeAdminPassword(newPassword);
    res.json({ success: true });
  });
};
