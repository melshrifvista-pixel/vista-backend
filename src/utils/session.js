const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ACCESS_TOKEN_EXPIRES_IN = '15m'; // Short-lived
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // Long-lived

/**
 * Generate Access and Refresh Tokens
 */
const generateTokens = async (user, req) => {
  const accessToken = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'supersecretkey_vista_2026',
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.REFRESH_SECRET || 'superrefreshkey_vista_2026',
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  // Hash the refresh token before storing it in the database
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  
  // Create a new session in the database
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });

  return { accessToken, refreshToken, sessionId: session.id };
};

/**
 * Rotate Refresh Token
 */
const rotateRefreshToken = async (oldRefreshToken, oldSessionId, user, req) => {
  // Invalidate old session
  await prisma.session.update({
    where: { id: oldSessionId },
    data: { isValid: false }
  });

  // Generate new tokens
  return await generateTokens(user, req);
};

/**
 * Revoke Session
 */
const revokeSession = async (sessionId) => {
  await prisma.session.update({
    where: { id: sessionId },
    data: { isValid: false }
  });
};

module.exports = {
  generateTokens,
  rotateRefreshToken,
  revokeSession
};
