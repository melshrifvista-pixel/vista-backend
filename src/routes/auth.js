const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middlewares/auth');
const sendEmail = require('../utils/email');
const { authLimiter } = require('../middlewares/rateLimiter');
const { generateOTP, hashOTP, verifyOTP } = require('../utils/otp');
const { generateTokens, rotateRefreshToken, revokeSession } = require('../utils/session');
const logAudit = require('../utils/audit');
const crypto = require('crypto');

const router = express.Router();
const prisma = new PrismaClient();

// Register a new user
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    let { username, password, fullName, email } = req.body;
    
    // Normalize and trim
    username = username?.trim().toLowerCase();
    email = email?.trim().toLowerCase();
    fullName = fullName?.trim();

    // Validation
    if (!username || !password || !fullName || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hashedPassword,
        fullName,
        isVerified: false
      }
    });

    // Generate and send OTP
    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);
    await prisma.oTP.create({
      data: {
        userId: user.id,
        otpHash: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      }
    });

    await sendEmail({
      to: email,
      subject: 'VISTA - Verify Your Account',
      text: `Your verification code is: ${otp}. It expires in 5 minutes.`,
      html: `<h1>Welcome to VISTA</h1><p>Your verification code is: <strong>${otp}</strong></p><p>It expires in 5 minutes.</p>`
    });

    await logAudit(user.id, 'USER_REGISTERED', { email }, req);

    res.status(201).json({
      message: 'Registration successful. Please check your email for the verification code.'
    });
  } catch (err) {
    next(err);
  }
});

// Verify OTP
router.post('/verify-otp', authLimiter, async (req, res, next) => {
  try {
    let { email, otp } = req.body;
    email = email?.trim().toLowerCase();
    otp = otp?.trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otpRecord = await prisma.oTP.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ error: 'OTP expired or not found' });
    }

    if (otpRecord.attempts >= 3) {
      return res.status(400).json({ error: 'Too many failed attempts. Please resend OTP.' });
    }

    const isMatch = await verifyOTP(otp, otpRecord.otpHash);
    if (!isMatch) {
      await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } }
      });
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true }
    });

    await prisma.oTP.deleteMany({ where: { userId: user.id } });

    await logAudit(user.id, 'EMAIL_VERIFIED', {}, req);

    res.json({ message: 'Account verified successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

// Resend Verification OTP
router.post('/resend-verification', authLimiter, async (req, res, next) => {
  try {
    let { email } = req.body;
    email = email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'Account is already verified' });

    // Delete existing OTPs
    await prisma.oTP.deleteMany({ where: { userId: user.id } });

    // Generate and send new OTP
    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);
    await prisma.oTP.create({
      data: {
        userId: user.id,
        otpHash: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      }
    });

    await sendEmail({
      to: email,
      subject: 'VISTA - Verify Your Account',
      text: `Your verification code is: ${otp}. It expires in 5 minutes.`,
      html: `<h1>Welcome to VISTA</h1><p>Your verification code is: <strong>${otp}</strong></p><p>It expires in 5 minutes.</p>`
    });

    await logAudit(user.id, 'VERIFICATION_RESENT', { email }, req);

    res.json({ message: 'Verification code resent successfully.' });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    let { username, password } = req.body;
    username = username?.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Account Lock Check
    if (user.isLocked && user.lockUntil > new Date()) {
      return res.status(403).json({ 
        error: 'Account locked', 
        message: `Too many failed attempts. Try again after ${user.lockUntil.toISOString()}` 
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Account not verified. Please verify your email.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const attempts = user.failedLoginAttempts + 1;
      const isLocked = attempts >= 5;
      const lockUntil = isLocked ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: { 
          failedLoginAttempts: attempts,
          isLocked,
          lockUntil
        }
      });

      await logAudit(user.id, 'LOGIN_FAILED', { attempts }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed attempts on success
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, isLocked: false, lockUntil: null }
    });

    const tokens = await generateTokens(user, req);

    await logAudit(user.id, 'LOGIN_SUCCESS', { sessionId: tokens.sessionId }, req);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      },
      ...tokens
    });
  } catch (err) {
    next(err);
  }
});

// Refresh Token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken, sessionId } = req.body;
    if (!refreshToken || !sessionId) return res.status(400).json({ error: 'Refresh token and session ID required' });

    const session = await prisma.session.findUnique({ 
      where: { id: sessionId },
      include: { user: true }
    });

    if (!session || !session.isValid || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const isMatch = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!isMatch) {
      await revokeSession(sessionId); // Security risk: revoke session if token doesn't match hash
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = await rotateRefreshToken(refreshToken, sessionId, session.user, req);

    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

// Logout
router.post('/logout', authMiddleware(), async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (sessionId) {
      await revokeSession(sessionId);
      await logAudit(req.user.userId, 'LOGOUT', { sessionId }, req);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// Profile
router.get('/me', authMiddleware(), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isVerified: true,
        createdAt: true
      }
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});



// Social Login (Google/Apple) - Logic Placeholder
router.post('/social-login', authLimiter, async (req, res, next) => {
  try {
    const { provider, idToken } = req.body;
    
    // In a real implementation, we would validate the idToken with Google/Apple SDK
    // For this example, we'll assume the token is valid and contains email/name
    let socialEmail, socialName;
    
    if (provider === 'google') {
      // Validate Google Token...
      socialEmail = 'user@gmail.com'; 
      socialName = 'Google User';
    } else if (provider === 'apple') {
      // Validate Apple Token...
      socialEmail = 'user@apple.com';
      socialName = 'Apple User';
    } else {
      return res.status(400).json({ error: 'Unsupported provider' });
    }

    // Secure Linking Strategy
    let user = await prisma.user.findUnique({ where: { email: socialEmail } });

    if (user) {
      // If user exists but is not verified, verify them since social auth verified the email
      if (!user.isVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isVerified: true }
        });
      }
    } else {
      // Create new user for social login
      user = await prisma.user.create({
        data: {
          username: `${provider}_${socialEmail.split('@')[0]}`,
          email: socialEmail,
          fullName: socialName,
          passwordHash: 'SOCIAL_AUTH_ONLY', // No password login for social users unless they reset it
          isVerified: true
        }
      });
    }

    const tokens = await generateTokens(user, req);
    await logAudit(user.id, 'SOCIAL_LOGIN_SUCCESS', { provider }, req);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      },
      ...tokens
    });
  } catch (err) {
    next(err);
  }
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
// Step 1: User submits their email → send OTP
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    let { email } = req.body;
    email = email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to avoid email enumeration attacks
    if (!user) {
      return res.json({ message: 'If this email is registered, a reset code has been sent.' });
    }

    // Delete any existing OTPs for this user
    await prisma.oTP.deleteMany({ where: { userId: user.id } });

    // Generate a fresh OTP
    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);

    await prisma.oTP.create({
      data: {
        userId: user.id,
        otpHash: hashedOtp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      }
    });

    await sendEmail({
      to: email,
      subject: 'VISTA - Password Reset Code',
      text: `Your password reset code is: ${otp}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1a73e8;">VISTA Financial System</h2>
          <p>You requested a password reset. Use the code below:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a73e8; text-align: center; padding: 16px; background: #f0f4ff; border-radius: 8px; margin: 16px 0;">
            ${otp}
          </div>
          <p style="color: #666;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>
      `
    });

    await logAudit(user.id, 'FORGOT_PASSWORD_REQUESTED', { email }, req);

    res.json({ message: 'If this email is registered, a reset code has been sent.' });
  } catch (err) {
    next(err);
  }
});

// ─── Reset Password ───────────────────────────────────────────────────────────
// Step 2: User submits email + OTP + new password
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    let { email, otp, newPassword } = req.body;
    email = email?.trim().toLowerCase();
    otp = otp?.trim();

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otpRecord = await prisma.oTP.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset code expired or not found. Please request a new one.' });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new code.' });
    }

    const isMatch = await verifyOTP(otp, otpRecord.otpHash);
    if (!isMatch) {
      await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } }
      });
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    // OTP is valid → update password and clean up
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        failedLoginAttempts: 0,
        isLocked: false,
        lockUntil: null
      }
    });

    // Invalidate all sessions (force re-login everywhere)
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { isValid: false }
    });

    // Delete the used OTP
    await prisma.oTP.deleteMany({ where: { userId: user.id } });

    await logAudit(user.id, 'PASSWORD_RESET_SUCCESS', { email }, req);

    // Send confirmation email
    await sendEmail({
      to: email,
      subject: 'VISTA - Password Changed Successfully',
      text: 'Your password has been changed successfully. If you did not do this, please contact support immediately.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1a73e8;">VISTA Financial System</h2>
          <p>✅ Your password has been <strong>changed successfully</strong>.</p>
          <p style="color: #d32f2f;">If you did not make this change, please contact support immediately.</p>
        </div>
      `
    });

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
});

// ─── Forgot Username ─────────────────────────────────────────────────────────
router.post('/forgot-username', authLimiter, async (req, res, next) => {
  try {
    let { email } = req.body;
    email = email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to avoid email enumeration
    if (!user) {
      return res.json({ message: 'If this email is registered, your username has been sent.' });
    }

    await sendEmail({
      to: email,
      subject: 'VISTA - Your Username',
      text: `Your VISTA username is: ${user.username}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1a73e8;">VISTA Financial System</h2>
          <p>Hello ${user.fullName},</p>
          <p>You requested to retrieve your username. Your VISTA username is:</p>
          <div style="font-size: 24px; font-weight: bold; color: #1a73e8; text-align: center; padding: 16px; background: #f0f4ff; border-radius: 8px; margin: 16px 0;">
            ${user.username}
          </div>
          <p style="color: #666;">You can use this username to log in to your account.</p>
          <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>
      `
    });

    await logAudit(user.id, 'FORGOT_USERNAME_REQUESTED', { email }, req);

    res.json({ message: 'If this email is registered, your username has been sent.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


