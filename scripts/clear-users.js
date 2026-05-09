const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting data cleanup...');
  
  try {
    // Delete in order to avoid foreign key constraints
    await prisma.transaction.deleteMany({});
    console.log('Deleted all transactions');
    
    await prisma.contract.deleteMany({});
    console.log('Deleted all contracts');
    
    await prisma.financialEntity.deleteMany({});
    console.log('Deleted all financial entities');
    
    await prisma.oTP.deleteMany({});
    console.log('Deleted all OTPs');
    
    await prisma.session.deleteMany({});
    console.log('Deleted all sessions');
    
    await prisma.auditLog.deleteMany({});
    console.log('Deleted all audit logs');
    
    await prisma.user.deleteMany({});
    console.log('Deleted all users');
    
    console.log('Cleanup successful! You can now reuse your emails.');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
