import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Starting to seed the database...');

    // Clear existing data
    await prisma.account.deleteMany();
    console.log('🗑️  Cleared existing accounts');

    // Hash passwords
    const saltRounds = 10;
    const hashedPassword1 = await bcrypt.hash('password123', saltRounds);
    const hashedPassword2 = await bcrypt.hash('admin456', saltRounds);

    // Create sample accounts
    const accounts = await prisma.account.createMany({
      data: [
        {
          username: 'testuser',
          password: hashedPassword1,
        },
        {
          username: 'admin',
          password: hashedPassword2,
        },
        {
          username: 'johndoe',
          password: await bcrypt.hash('securepass', saltRounds),
        },
      ],
    });

    console.log(`✅ Created ${accounts.count} accounts`);

    // Fetch and display created accounts (without passwords)
    const allAccounts = await prisma.account.findMany({
      select: {
        id: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('📋 Created accounts:');
    allAccounts.forEach(account => {
      console.log(`  - ID: ${account.id}, Username: ${account.username}, Created: ${account.createdAt}`);
    });

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();