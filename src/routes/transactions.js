const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middlewares/auth');
const isolationMiddleware = require('../middlewares/isolation');

const router = express.Router();
const prisma = new PrismaClient();

// Enforce auth and isolation
router.use(authMiddleware());
router.use(isolationMiddleware);

// Get all transactions
router.get('/', async (req, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.userId },
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
    // Verify entity ownership first
    const entity = await prisma.financialEntity.findFirst({
      where: { id: parseInt(entityId), userId: req.user.userId }
    });

    if (!entity) return res.status(404).json({ error: 'Entity not found or access denied' });

    const transactions = await prisma.transaction.findMany({
      where: { entityId: parseInt(entityId), userId: req.user.userId },
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
    const { amount, type, entityId, notes, personName, isCashReturn, receiptImagePath, timestamp, clientGuid } = req.body;

    if (amount === undefined || !type || !entityId) {
      return res.status(400).json({ error: 'Amount, type, and entityId are required' });
    }

    // Verify entity ownership
    const entity = await prisma.financialEntity.findFirst({
      where: { id: parseInt(entityId), userId: req.user.userId }
    });

    if (!entity) return res.status(404).json({ error: 'Entity not found or access denied' });

    const transaction = await prisma.transaction.create({
      data: {
        amount: parseFloat(amount),
        type,
        entityId: parseInt(entityId),
        notes,
        personName,
        isCashReturn: isCashReturn !== undefined ? isCashReturn : true,
        receiptImagePath,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        clientGuid,
        userId: req.user.userId
      }
    });

    res.status(201).json(transaction);
    req.io.emit('sync_data', { type: 'transactions', entityId, userId: req.user.userId });
  } catch (err) {
    next(err);
  }
});

// Delete a transaction
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.transaction.findFirst({
      where: { id: parseInt(id), userId: req.user.userId }
    });

    if (!existing) return res.status(404).json({ error: 'Transaction not found or access denied' });

    await prisma.transaction.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Transaction deleted successfully' });
    req.io.emit('sync_data', { type: 'transactions', userId: req.user.userId });
  } catch (err) {
    next(err);
  }
});

// Get Balance Summary
router.get('/summary', async (req, res, next) => {
  try {
    const entities = await prisma.financialEntity.findMany({
      where: { userId: req.user.userId },
      include: { transactions: true }
    });

    let revenuesIn = 0, revenuesOut = 0;
    let expensesIn = 0, expensesOut = 0;
    let netCustodyDebtTotal = 0;
    const custodyBalances = [];

    for (const entity of entities) {
      const inTotal = entity.transactions.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.amount, 0);
      const outTotal = entity.transactions.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.amount, 0);
      const outReturnTotal = entity.transactions.filter(t => t.type === 'OUT' && t.isCashReturn).reduce((acc, t) => acc + t.amount, 0);

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
        netCustodyDebtTotal += (inTotal - outReturnTotal);
      }
    }

    const netBusinessBalance = (revenuesIn - revenuesOut) - (expensesOut - expensesIn);
    const totalNetBalance = netBusinessBalance - netCustodyDebtTotal;

    res.json({
      netBalance: totalNetBalance,
      custodyBalances
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
