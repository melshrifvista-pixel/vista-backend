const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Connecting to database via Prisma...');
    await prisma.$connect();
    console.log('Connected successfully!');
    const count = await prisma.user.count();
    console.log('Total users in DB:', count);
    await prisma.$disconnect();
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();
