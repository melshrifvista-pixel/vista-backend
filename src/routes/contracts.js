const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get all contracts (global)
router.get('/all', async (req, res) => {
  try {
    const contracts = await prisma.contract.findMany({
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
    console.log(`[GET CONTRACTS] Requested EntityId: ${entityId}, Parsed: ${parsedId}`);
    
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: "Invalid entity ID" });
    }

    // Best Practice: Check if the center exists first
    const entity = await prisma.financialEntity.findUnique({ where: { id: parsedId } });
    if (!entity) {
      return res.status(404).json({ error: "المستند غير موجود: المركز المذكور غير مسجل على الخادم" });
    }

    const contracts = await prisma.contract.findMany({
      where: { financialEntityId: parsedId },
      orderBy: { startDate: 'desc' }
    });
    console.log(`[GET CONTRACTS] Found ${contracts.length} contracts for Entity ${parsedId}`);
    res.json(contracts);
  } catch (error) {
    console.error("[GET CONTRACTS ERROR]", error);
    res.status(500).json({ error: "Failed to fetch contracts", details: error.message });
  }
});

// Get active contract for a specific financial entity
router.get('/:entityId/active', async (req, res) => {
  try {
    const { entityId } = req.params;
    const parsedId = parseInt(entityId);
    if (isNaN(parsedId)) return res.status(400).json({ error: "Invalid entity ID" });

    const activeContract = await prisma.contract.findFirst({
      where: { financialEntityId: parsedId, isActive: true }
    });
    
    if (!activeContract) {
      return res.status(404).json({ error: "No active contract found" });
    }
    
    res.json(activeContract);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch active contract" });
  }
});

// Create a new contract
router.post('/', async (req, res) => {
  try {
    const { financialEntityId, tenantName, startDate, endDate, monthlyRent, clientGuid } = req.body;
    const parsedId = parseInt(financialEntityId);
    console.log(`[CREATE CONTRACT] EntityId: ${financialEntityId} (${parsedId}), Tenant: ${tenantName}`);
    
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: "Invalid financial entity ID" });
    }

    // Check if the entity actually exists on the backend
    const entityExists = await prisma.financialEntity.findUnique({ where: { id: parsedId } });
    if (!entityExists) {
      console.log(`[CREATE CONTRACT] Entity ${parsedId} not found on server`);
      return res.status(404).json({ error: "هذا المركز غير موجود على الخادم حالياً. يرجى الانتظار للمزامنة أو المحاولة لاحقاً." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end <= start) {
      return res.status(400).json({ error: "End date must be after start date" });
    }

    // Deactivate current active, create/upsert new
    const result = await prisma.$transaction(async (tx) => {
      // If we're creating a NEW contract (no existing Guid), we deactivate old ones.
      // If it's an update of an existing Guid, we don't necessarily want to toggle everything unless it's a real new contract.
      // But for simplicity, we keep the deactivation logic for the first time it hits the server.
      
      const existing = clientGuid ? await tx.contract.findUnique({ where: { clientGuid } }) : null;
      
      if (!existing) {
        await tx.contract.updateMany({
          where: { financialEntityId: parsedId, isActive: true },
          data: { isActive: false }
        });
      }

      return await tx.contract.upsert({
        where: { clientGuid: clientGuid || 'no-guid-con-' + Date.now() },
        update: {
          financialEntityId: parsedId,
          tenantName,
          startDate: start,
          endDate: end,
          monthlyRent: parseFloat(monthlyRent) || 0,
          isActive: true
        },
        create: {
          financialEntityId: parsedId,
          tenantName,
          startDate: start,
          endDate: end,
          monthlyRent: parseFloat(monthlyRent) || 0,
          isActive: true,
          clientGuid
        }
      });
    });

    console.log(`[CREATE CONTRACT] Successfully created contract ${result.id} for Entity ${parsedId}`);
    res.status(201).json(result);
  } catch (error) {
    console.error("[CONTRACT ERROR]", error);
    res.status(500).json({ error: "Failed to create contract", details: error.message });
  }
});

// Deactivate a contract manually
router.put('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
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
