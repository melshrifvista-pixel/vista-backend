/**
 * Isolation Middleware
 * Enforces strict multi-tenant data isolation by ensuring every request
 * to financial endpoints is scoped to the authenticated user's ID.
 */
const isolationMiddleware = (req, res, next) => {
  if (!req.user || !req.user.userId) {
    console.error(`[ISOLATION] Access blocked: No userId in request for ${req.method} ${req.url}`);
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'User session is required for this operation.' 
    });
  }

  // Attach a helper to scope Prisma queries
  req.userScope = { userId: req.user.userId };
  
  next();
};

module.exports = isolationMiddleware;
