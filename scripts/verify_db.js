const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const users = await prisma.user.count();
  const otps = await prisma.oTP.count();
  const sessions = await prisma.session.count();
  
  console.log('=== DATABASE STATUS ===');
  console.log(`Users:    ${users}`);
  console.log(`OTPs:     ${otps}`);
  console.log(`Sessions: ${sessions}`);
  
  if (users === 0) {
    console.log('\n✅ Database is CLEAN - all emails can be reused.');
  } else {
    console.log('\n⚠️  Database still has data!');
  }
  
  await prisma.$disconnect();
}

verify();
