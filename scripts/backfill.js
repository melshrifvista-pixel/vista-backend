const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill...');

  // 1. Migrate passwords to passwordHash
  const users = await prisma.user.findMany({
    where: { passwordHash: null }
  });

  console.log(`Found ${users.length} users to migrate passwords.`);
  for (const user of users) {
    if (user.password) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: user.password }
      });
      console.log(`Migrated password for user: ${user.username}`);
    }
  }

  // 2. Associate orphan financial data with the first admin user
  const firstAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' }
  });

  if (!firstAdmin) {
    console.warn('No admin user found to associate orphan data with.');
  } else {
    console.log(`Associating orphan records with user: ${firstAdmin.username} (ID: ${firstAdmin.id})`);

    const entityResult = await prisma.financialEntity.updateMany({
      where: { userId: null },
      data: { userId: firstAdmin.id }
    });
    console.log(`Updated ${entityResult.count} FinancialEntities.`);

    const contractResult = await prisma.contract.updateMany({
      where: { userId: null },
      data: { userId: firstAdmin.id }
    });
    console.log(`Updated ${contractResult.count} Contracts.`);

    const transactionResult = await prisma.transaction.updateMany({
      where: { userId: null },
      data: { userId: firstAdmin.id }
    });
    console.log(`Updated ${transactionResult.count} Transactions.`);
  }

  console.log('Backfill completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
