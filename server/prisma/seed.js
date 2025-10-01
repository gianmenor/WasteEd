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

    // Create waste items for the last year (365 days - one record per day)
    const wasteItems = [];
    const currentDate = new Date();

    // Generate 365 daily waste records (1 full year)
    for (let i = 0; i < 365; i++) {
      const daysAgo = 364 - i; // Start from 364 days ago to today
      const itemDate = new Date(currentDate);
      itemDate.setDate(currentDate.getDate() - daysAgo);
      
      // Reset time to start of day for consistent date formatting
      itemDate.setHours(0, 0, 0, 0);
      
      // Generate more realistic seasonal variation in waste amounts
      const month = itemDate.getMonth() + 1; // 1-12
      const season = Math.floor((month % 12) / 3); // 0=winter, 1=spring, 2=summer, 3=fall
      
      // Base amounts with seasonal variations
      let baseRecyclable = 15 + Math.floor(Math.random() * 20); // 15-35
      let baseBiodegradable = 10 + Math.floor(Math.random() * 15); // 10-25
      let baseNonBiodegradable = 5 + Math.floor(Math.random() * 10); // 5-15
      
      // Seasonal adjustments
      switch(season) {
        case 0: // Winter (Dec, Jan, Feb) - more packaging, less organic
          baseRecyclable += Math.floor(Math.random() * 10); // +0-10
          baseBiodegradable -= Math.floor(Math.random() * 5); // -0-5
          break;
        case 1: // Spring (Mar, Apr, May) - cleaning, gardening
          baseBiodegradable += Math.floor(Math.random() * 8); // +0-8
          break;
        case 2: // Summer (Jun, Jul, Aug) - more food waste, beverages
          baseRecyclable += Math.floor(Math.random() * 7); // +0-7
          baseBiodegradable += Math.floor(Math.random() * 10); // +0-10
          break;
        case 3: // Fall (Sep, Oct, Nov) - yard waste, holiday prep
          baseBiodegradable += Math.floor(Math.random() * 12); // +0-12
          baseRecyclable += Math.floor(Math.random() * 5); // +0-5
          break;
      }
      
      // Weekend variations (slightly more waste on weekends)
      const dayOfWeek = itemDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        baseRecyclable += Math.floor(Math.random() * 5);
        baseBiodegradable += Math.floor(Math.random() * 5);
        baseNonBiodegradable += Math.floor(Math.random() * 3);
      }
      
      // Ensure minimums and apply some randomness
      const recyclableAmount = Math.max(0, baseRecyclable + Math.floor(Math.random() * 11) - 5);
      const biodegradableAmount = Math.max(0, baseBiodegradable + Math.floor(Math.random() * 11) - 5);
      const nonBiodegradableAmount = Math.max(0, baseNonBiodegradable + Math.floor(Math.random() * 7) - 3);

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

    console.log('📋 Created waste items (showing first 10 and last 5):');
    // Show first 10 records
    allWasteItems.slice(0, 10).forEach((item, index) => {
      console.log(`  - ${index + 1}. ${item.date.toDateString()}: R:${item.recyclable}, B:${item.biodegradable}, NB:${item.nonBiodegradable}`);
    });
    if (allWasteItems.length > 15) {
      console.log(`  ... (${allWasteItems.length - 15} records omitted) ...`);
      // Show last 5 records
      allWasteItems.slice(-5).forEach((item, index) => {
        const actualIndex = allWasteItems.length - 5 + index + 1;
        console.log(`  - ${actualIndex}. ${item.date.toDateString()}: R:${item.recyclable}, B:${item.biodegradable}, NB:${item.nonBiodegradable}`);
      });
    }

    // Summary statistics
    const totalRecyclable = allWasteItems.reduce((sum, item) => sum + item.recyclable, 0);
    const totalBiodegradable = allWasteItems.reduce((sum, item) => sum + item.biodegradable, 0);
    const totalNonBiodegradable = allWasteItems.reduce((sum, item) => sum + item.nonBiodegradable, 0);
    const grandTotal = totalRecyclable + totalBiodegradable + totalNonBiodegradable;

    console.log(`📊 Waste items summary (${allWasteItems.length} days):`);
    console.log(`  - Total Recyclable: ${totalRecyclable} units`);
    console.log(`  - Total Biodegradable: ${totalBiodegradable} units`);
    console.log(`  - Total Non-Biodegradable: ${totalNonBiodegradable} units`);
    console.log(`  - Grand Total: ${grandTotal} units`);
    console.log(`  - Daily Average: ${Math.round(grandTotal / allWasteItems.length)} units`);
    console.log(`  - Date Range: ${allWasteItems[0].date.toDateString()} to ${allWasteItems[allWasteItems.length - 1].date.toDateString()}`);

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();