const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middlewares/auth');
const isolationMiddleware = require('../middlewares/isolation');

const router = express.Router();
const prisma = new PrismaClient();

// Enforce auth and isolation for all entity routes
router.use(authMiddleware());
router.use(isolationMiddleware);

// Get all entities
router.get('/', async (req, res, next) => {
  try {
    const entities = await prisma.financialEntity.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(entities);
  } catch (err) {
    next(err);
  }
});

// Create a new entity
router.post('/', async (req, res, next) => {
  try {
    const { name, type, initialBalance, contract, clientGuid } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const entity = await tx.financialEntity.create({
        data: {
          name,
          type,
          initialBalance: parseFloat(initialBalance) || 0.0,
          clientGuid,
          userId: req.user.userId
        }
      });

      if (type === 'REVENUE' && contract) {
        await tx.contract.create({
          data: {
            financialEntityId: entity.id,
            tenantName: contract.tenantName,
            startDate: new Date(contract.startDate),
            endDate: new Date(contract.endDate),
            monthlyRent: parseFloat(contract.monthlyRent) || 0.0,
            isActive: true,
            userId: req.user.userId
          }
        });
      }

      return entity;
    });

    res.status(201).json(result);
    req.io.emit('sync_data', { type: 'entities', userId: req.user.userId });
  } catch (err) {
    next(err);
  }
});

// Update an entity
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, initialBalance } = req.body;

    // Verify ownership
    const existing = await prisma.financialEntity.findFirst({
      where: { id: parseInt(id), userId: req.user.userId }
    });

    if (!existing) return res.status(404).json({ error: 'Entity not found or access denied' });

    const entity = await prisma.financialEntity.update({
      where: { id: parseInt(id) },
      data: { name, type, initialBalance }
    });

    res.json(entity);
    req.io.emit('sync_data', { type: 'entities', id, userId: req.user.userId });
  } catch (err) {
    next(err);
  }
});

// Delete an entity
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.financialEntity.findFirst({
      where: { id: parseInt(id), userId: req.user.userId }
    });

    if (!existing) return res.status(404).json({ error: 'Entity not found or access denied' });

    await prisma.financialEntity.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Entity deleted successfully' });
    req.io.emit('sync_data', { type: 'entities', userId: req.user.userId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
