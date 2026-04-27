const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Require auth removed for simplified direct access mode
// router.use(authMiddleware(['ADMIN', 'ACCOUNTANT', 'VIEWER']));

// Get all entities
router.get('/', async (req, res, next) => {
  try {
    const entities = await prisma.financialEntity.findMany({
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
    const { name, type, initialBalance, contract } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // Use transaction if contract is provided
    const result = await prisma.$transaction(async (tx) => {
      const entity = await tx.financialEntity.create({
        data: {
          name,
          type, // 'REVENUE', 'EXPENSE', 'CUSTODY'
          initialBalance: parseFloat(initialBalance) || 0.0
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
            isActive: true
          }
        });
      }

      return entity;
    });

    res.status(201).json(result);
    req.io.emit('sync_data', { type: 'entities' });
  } catch (err) {
    console.error("[CREATE ENTITY ERROR]", err);
    next(err);
  }
});

// Update an entity
router.put('/:id', authMiddleware(['ADMIN', 'ACCOUNTANT']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, initialBalance } = req.body;

    const entity = await prisma.financialEntity.update({
      where: { id: parseInt(id) },
      data: { name, type, initialBalance }
    });

    res.json(entity);
    req.io.emit('sync_data', { type: 'entities', id });
  } catch (err) {
    next(err);
  }
});

// Delete an entity (Admin only)
router.delete('/:id', authMiddleware(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.financialEntity.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Entity deleted successfully' });
    req.io.emit('sync_data', { type: 'entities' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
