import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Starting to seed the database...');

    // Clear existing data
    await prisma.waste_items.deleteMany();
    await prisma.account.deleteMany();
    console.log('🗑️  Cleared existing accounts and waste items');

    // Read account data from JSON file
    const accountJsonPath = path.join(process.cwd(), 'prisma', 'Data', 'account.json');
    let accountData;
    
    try {
      const accountJsonData = fs.readFileSync(accountJsonPath, 'utf8');
      accountData = JSON.parse(accountJsonData);
    } catch (error) {
      console.warn('⚠️  Could not read account.json, using default data');
      accountData = { username: 'admin', password: '123456' };
    }

    // Hash passwords
    const saltRounds = 10;
    const hashedPasswordFromJson = await bcrypt.hash(accountData.password, saltRounds);
    const hashedPassword1 = await bcrypt.hash('password123', saltRounds);
    const hashedPassword2 = await bcrypt.hash('securepass', saltRounds);

    // Create sample accounts (including the one from JSON)
    const accounts = await prisma.account.createMany({
      data: [
        {
          username: accountData.username,
          password: hashedPasswordFromJson,
        },
        {
          username: 'testuser',
          password: hashedPassword1,
        },
        {
          username: 'johndoe',
          password: hashedPassword2,
        },
      ],
    });

    console.log(`✅ Created ${accounts.count} accounts`);

    // Create waste items for the last 20 days (one record per day)
    const wasteItems = [];
    const currentDate = new Date();

    // Generate 20 daily waste records
    for (let i = 0; i < 20; i++) {
      const daysAgo = 19 - i; // Start from 19 days ago to today
      const itemDate = new Date(currentDate);
      itemDate.setDate(currentDate.getDate() - daysAgo);
      
      // Reset time to start of day for consistent date formatting
      itemDate.setHours(0, 0, 0, 0);
      
      // Generate random amounts for each category (0-50 units)
      const recyclableAmount = Math.floor(Math.random() * 51);
      const biodegradableAmount = Math.floor(Math.random() * 51);
      const nonBiodegradableAmount = Math.floor(Math.random() * 51);

      wasteItems.push({
        recyclable: recyclableAmount,
        biodegradable: biodegradableAmount,
        nonBiodegradable: nonBiodegradableAmount,
        date: itemDate,
      });
    }

    // Insert waste items
    const createdWasteItems = await prisma.waste_items.createMany({
      data: wasteItems,
    });

    console.log(`✅ Created ${createdWasteItems.count} waste items`);

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

    // Fetch and display created waste items
    const allWasteItems = await prisma.waste_items.findMany({
      orderBy: {
        date: 'asc',
      },
    });

    console.log('📋 Created waste items:');
    allWasteItems.forEach((item, index) => {
      console.log(`  - ${index + 1}. ${item.date.toDateString()}: R:${item.recyclable}, B:${item.biodegradable}, NB:${item.nonBiodegradable}`);
    });

    // Summary statistics
    const totalRecyclable = allWasteItems.reduce((sum, item) => sum + item.recyclable, 0);
    const totalBiodegradable = allWasteItems.reduce((sum, item) => sum + item.biodegradable, 0);
    const totalNonBiodegradable = allWasteItems.reduce((sum, item) => sum + item.nonBiodegradable, 0);

    console.log('📊 Waste items summary (20 days):');
    console.log(`  - Total Recyclable: ${totalRecyclable} units`);
    console.log(`  - Total Biodegradable: ${totalBiodegradable} units`);
    console.log(`  - Total Non-Biodegradable: ${totalNonBiodegradable} units`);
    console.log(`  - Grand Total: ${totalRecyclable + totalBiodegradable + totalNonBiodegradable} units`);

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();