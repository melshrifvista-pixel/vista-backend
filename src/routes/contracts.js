const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middlewares/auth');
const isolationMiddleware = require('../middlewares/isolation');

const prisma = new PrismaClient();
const router = express.Router();

// Enforce auth and isolation
router.use(authMiddleware());
router.use(isolationMiddleware);

// Get all contracts for the user
router.get('/all', async (req, res) => {
  try {
    const contracts = await prisma.contract.findMany({
      where: { userId: req.user.userId },
      orderBy: { startDate: 'desc' }
    });
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch all contracts" });
  }
});

// Get all contracts for a specific financial entity
router.get('/:entityId', async (req, res) => {
  try {
    const { entityId } = req.params;
    const parsedId = parseInt(entityId);
    
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: "Invalid entity ID" });
    }

    // Verify entity ownership
    const entity = await prisma.financialEntity.findFirst({
      where: { id: parsedId, userId: req.user.userId }
    });

    if (!entity) {
      return res.status(404).json({ error: "Access denied or entity not found" });
    }

    const contracts = await prisma.contract.findMany({
      where: { financialEntityId: parsedId, userId: req.user.userId },
      orderBy: { startDate: 'desc' }
    });
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

// Create a new contract
router.post('/', async (req, res) => {
  try {
    const { financialEntityId, tenantName, startDate, endDate, monthlyRent, clientGuid } = req.body;
    const parsedId = parseInt(financialEntityId);
    
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: "Invalid financial entity ID" });
    }

    // Verify entity ownership
    const entityExists = await prisma.financialEntity.findFirst({
      where: { id: parsedId, userId: req.user.userId }
    });

    if (!entityExists) {
      return res.status(404).json({ error: "Access denied or entity not found" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end <= start) {
      return res.status(400).json({ error: "End date must be after start date" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Deactivate old active contracts for this entity
      await tx.contract.updateMany({
        where: { financialEntityId: parsedId, userId: req.user.userId, isActive: true },
        data: { isActive: false }
      });

      return await tx.contract.create({
        data: {
          financialEntityId: parsedId,
          tenantName,
          startDate: start,
          endDate: end,
          monthlyRent: parseFloat(monthlyRent) || 0,
          isActive: true,
          clientGuid,
          userId: req.user.userId
        }
      });
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create contract", details: error.message });
  }
});

// Deactivate a contract manually
router.put('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const existing = await prisma.contract.findFirst({
      where: { id: parseInt(id), userId: req.user.userId }
    });

    if (!existing) return res.status(404).json({ error: "Access denied or contract not found" });

    const contract = await prisma.contract.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: "Failed to deactivate contract" });
  }
});

module.exports = router;
