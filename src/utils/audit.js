const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Record an audit log entry
 */
const logAudit = async (userId, action, metadata = {}, req = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        metadata,
        ipAddress: req ? req.ip : null
      }
    });
  } catch (err) {
    console.error(`[AUDIT] Failed to record log: ${err.message}`);
    // We don't throw here to avoid interrupting the main flow
  }
};

module.exports = logAudit;
