const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = 'admin';
  const email = 'admin@vista.com';
  const password = 'admin';
  const fullName = 'المدير العام';

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    console.log('User admin already exists.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      fullName,
      role: 'ADMIN',
      isVerified: true
    }
  });

  console.log(`User created successfully: ${user.username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
