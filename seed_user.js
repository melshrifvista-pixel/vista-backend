const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  const hashedPassword = await bcrypt.hash('test123', 12);
  const user = await prisma.user.create({
    data: {
      username: 'test',
      email: 'test@vista.local',
      fullName: 'Test User',
      passwordHash: hashedPassword,
      isVerified: true
    }
  });
  console.log('Created user:', user.username);
}

seed().catch(console.error).finally(() => prisma.$disconnect());
