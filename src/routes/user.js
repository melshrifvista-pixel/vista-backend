const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Update user profile
router.put('/update', authMiddleware(), async (req, res, next) => {
  try {
    const { fullName, profilePicture } = req.body;
    const userId = req.user.userId;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fullName || undefined,
        profilePicture: profilePicture || undefined
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        profilePicture: true
      }
    });

    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
