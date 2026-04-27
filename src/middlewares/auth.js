const jwt = require('jsonwebtoken');

const authMiddleware = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[AUTH 401] No token for ${req.method} ${req.url}`);
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_vista_2026');
      req.user = decoded;

      if (roles.length && !roles.includes(req.user.role)) {
        console.log(`[AUTH 403] Insufficient role for ${req.user.username} on ${req.url}`);
        return res.status(403).json({ error: 'Forbidden: Insufficient role' });
      }

      next();
    } catch (err) {
      console.log(`[AUTH 401] Invalid token for ${req.url}: ${err.message}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };
};

module.exports = authMiddleware;
