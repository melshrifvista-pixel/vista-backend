const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Auth disabled for direct mode
// router.use(authMiddleware(['ADMIN', 'ACCOUNTANT', 'VIEWER']));

// Get all transactions
router.get('/', async (req, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { entity: true },
      orderBy: { timestamp: 'desc' }
    });
    res.json(transactions);
  } catch (err) {
    next(err);
  }
});

// Get transactions for a specific entity
router.get('/entity/:entityId', async (req, res, next) => {
  try {
    const { entityId } = req.params;
    const transactions = await prisma.transaction.findMany({
      where: { entityId: parseInt(entityId) },
      orderBy: { timestamp: 'desc' }
    });
    res.json(transactions);
  } catch (err) {
    next(err);
  }
});

// Create a transaction
router.post('/', async (req, res, next) => {
  try {
    const { amount, type, entityId, notes, receiptImagePath, timestamp } = req.body;

    if (amount === undefined || !type || !entityId) {
      return res.status(400).json({ error: 'Amount, type, and entityId are required' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount: parseFloat(amount),
        type, // 'IN' or 'OUT'
        entityId: parseInt(entityId),
        notes,
        receiptImagePath,
        timestamp: timestamp ? new Date(timestamp) : new Date()
      }
    });

    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
});

// Delete a transaction
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.transaction.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Get Balance Summary (Net balance and Custody balances)
router.get('/summary', async (req, res, next) => {
  try {
    // This could be optimized into a single query, but for simplicity we fetch all and calculate
    const entities = await prisma.financialEntity.findMany({
      include: { transactions: true }
    });

    let revenuesIn = 0, revenuesOut = 0;
    let expensesIn = 0, expensesOut = 0;

    const custodyBalances = [];

    for (const entity of entities) {
      const inTotal = entity.transactions.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.amount, 0);
      const outTotal = entity.transactions.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.amount, 0);

      if (entity.type === 'REVENUE') {
        revenuesIn += inTotal;
        revenuesOut += outTotal;
      } else if (entity.type === 'EXPENSE') {
        expensesIn += inTotal;
        expensesOut += outTotal;
      } else if (entity.type === 'CUSTODY') {
        custodyBalances.push({
          id: entity.id,
          name: entity.name,
          balance: entity.initialBalance + inTotal - outTotal
        });
      }
    }

    const netBalance = (revenuesIn - revenuesOut) - (expensesOut - expensesIn);

    res.json({
      netBalance,
      custodyBalances
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
