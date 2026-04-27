const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middlewares/auth');
const sendEmail = require('../utils/email');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const prisma = new PrismaClient();

// Rate limiting for auth endpoints
// Rate limiting removed for debugging registration issues
const authLimiter = (req, res, next) => next();

// Register a new user
router.post('/register', authLimiter, async (req, res, next) => {
  console.log(`[AUTH] Register attempt for: ${req.body.username}`);
  try {
    const { username, password, fullName, email } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password, and full name are required' });
    }

    // Validate email format
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    const existingUser = await prisma.user.findFirst({ 
      where: { 
        OR: [{ username }, { email }]
      } 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await prisma.user.create({
      data: {
        username,
        email: email || `${username}@vista.local`,
        password: hashedPassword,
        fullName,
        role: 'ADMIN',
        isVerified: true
      }
    });

    res.status(201).json({ 
      message: 'تم إنشاء الحساب بنجاح. يمكنك الآن تسجيل الدخول مباشرة.'
    });
  } catch (err) {
    next(err);
  }
});

// Verify email with token
router.get('/verify', async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send('<h1>خطأ</h1><p>الرابط غير صالح.</p>');
    }

    const user = await prisma.user.findUnique({
      where: { verificationToken: token }
    });

    if (!user || user.verificationTokenExpiry < new Date()) {
      return res.status(400).send('<h1>خطأ في التفعيل</h1><p>الرابط غير صالح أو منتهي الصلاحية.</p>');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null
      }
    });

    res.send('<h1>تم تفعيل الحساب بنجاح!</h1><p>يمكنك الآن تسجيل الدخول من التطبيق.</p>');
  } catch (err) {
    next(err);
  }
});

// Resend verification email
router.post('/resend-verification', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Account is already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiry }
    });

    const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify?token=${verificationToken}`;
    
    await sendEmail({
      to: email,
      subject: 'VISTA - إعادة إرسال تفعيل الحساب',
      text: `رابط التفعيل الجديد: ${verificationUrl}`
    });

    res.json({ message: 'تم إعادة إرسال رابط التفعيل بنجاح' });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'يرجى تفعيل الحساب من البريد الإلكتروني أولاً' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'supersecretkey_vista_2026',
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get current user profile
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

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
