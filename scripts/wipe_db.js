const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function wipeDatabase() {
  console.log('Starting database wipe...');
  try {
    // Delete in order to satisfy foreign key constraints if not cascaded
    await prisma.transaction.deleteMany({});
    await prisma.contract.deleteMany({});
    await prisma.financialEntity.deleteMany({});
    await prisma.oTP.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    
    console.log('SUCCESS: All data wiped successfully.');
  } catch (err) {
    console.error('FAILURE: Error wiping database:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

wipeDatabase();
