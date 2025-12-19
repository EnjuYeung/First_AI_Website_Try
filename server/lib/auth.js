import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const createAuth = async ({ jwtSecret, storage }) => {
  let credentials = await storage.loadCredentials();
  let adminHash = credentials.passwordHash;

  const signToken = (payload) => jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

  const authMiddleware = (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Missing token' });
    try {
      req.user = jwt.verify(token, jwtSecret);
      next();
    } catch {
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
  };
};

