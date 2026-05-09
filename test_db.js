const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    await prisma.$connect();
    console.log("SUCCESS: Database connected successfully.");
    const userCount = await prisma.user.count();
    console.log(`User count in DB: ${userCount}`);
  } catch (error) {
    console.error("FAILURE: Could not connect to database.");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
