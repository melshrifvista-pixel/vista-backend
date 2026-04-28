const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up database...');
  
  const transactions = await prisma.transaction.deleteMany({});
  console.log(`Deleted ${transactions.count} transactions`);
  
  const contracts = await prisma.contract.deleteMany({});
  console.log(`Deleted ${contracts.count} contracts`);
  
  const entities = await prisma.financialEntity.deleteMany({});
  console.log(`Deleted ${entities.count} entities`);
  
  console.log('Cleanup complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
