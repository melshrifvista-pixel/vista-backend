const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connected!');

    console.log('Checking tables...');
    const users = await prisma.user.count();
    const sessions = await prisma.session.count();
    const otps = await prisma.oTP.count();
    const logs = await prisma.auditLog.count();

    console.log(`Users: ${users}`);
    console.log(`Sessions: ${sessions}`);
    console.log(`OTPs: ${otps}`);
    console.log(`AuditLogs: ${logs}`);

    console.log('Database schema seems correct.');
  } catch (err) {
    console.error('Database check failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
