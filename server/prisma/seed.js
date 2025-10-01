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
    await prisma.bin.deleteMany();
    await prisma.account.deleteMany();
    console.log('🗑️  Cleared existing accounts, waste items, and bin records');

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

    // Create bin records for the last year
    const binRecords = [];
    
    // Generate realistic bin full events over the year
    // Bins typically get full every 2-4 days depending on season and usage
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 365);
    
    let nextBinDate = new Date(startDate);
    
    while (nextBinDate <= currentDate) {
      // Calculate days until next bin full event
      const month = nextBinDate.getMonth() + 1;
      const season = Math.floor((month % 12) / 3);
      
      let daysUntilFull = 2; // Base 2 days
      
      // Seasonal adjustments for bin frequency
      switch(season) {
        case 0: // Winter - less frequent (holidays = more waste, cold = less activity)
          daysUntilFull = 2 + Math.floor(Math.random() * 2); // 2-3 days
          break;
        case 1: // Spring - moderate (spring cleaning)
          daysUntilFull = 2 + Math.floor(Math.random() * 3); // 2-4 days
          break;
        case 2: // Summer - more frequent (more activity, BBQs, etc.)
          daysUntilFull = 1 + Math.floor(Math.random() * 2); // 1-2 days
          break;
        case 3: // Fall - moderate to frequent (back to school, leaf collection)
          daysUntilFull = 2 + Math.floor(Math.random() * 2); // 2-3 days
          break;
      }
      
      // Weekend adjustments (more waste on weekends)
      const dayOfWeek = nextBinDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        daysUntilFull = Math.max(1, daysUntilFull - 1); // Bins fill faster on weekends
      }
      
      // Random hour during business hours (6 AM to 10 PM)
      const randomHour = 6 + Math.floor(Math.random() * 16); // 6-21 (6 AM to 9 PM)
      const randomMinute = Math.floor(Math.random() * 60);
      
      nextBinDate.setHours(randomHour, randomMinute, 0, 0);
      
      // Add the bin record if it's within our date range
      if (nextBinDate <= currentDate) {
        binRecords.push({
          fullAt: new Date(nextBinDate)
        });
      }
      
      // Calculate next bin full date
      nextBinDate.setDate(nextBinDate.getDate() + daysUntilFull);
      nextBinDate.setHours(0, 0, 0, 0); // Reset to start of day for next calculation
    }
    
    // Insert bin records
    const createdBinRecords = await prisma.bin.createMany({
      data: binRecords
    });
    
    console.log(`✅ Created ${createdBinRecords.count} bin records`);

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

    // Fetch and display bin records summary
    const allBinRecords = await prisma.bin.findMany({
      orderBy: {
        fullAt: 'asc'
      }
    });

    console.log(`📊 Bin records summary (${allBinRecords.length} events):`);
    if (allBinRecords.length > 0) {
      console.log(`  - Date Range: ${allBinRecords[0].fullAt.toDateString()} to ${allBinRecords[allBinRecords.length - 1].fullAt.toDateString()}`);
      console.log(`  - Average Events per Day: ${(allBinRecords.length / 365).toFixed(2)}`);
      
      // Calculate monthly distribution
      const monthlyCount = {};
      allBinRecords.forEach(record => {
        const month = record.fullAt.getMonth() + 1;
        monthlyCount[month] = (monthlyCount[month] || 0) + 1;
      });
      
      console.log('  - Monthly Distribution:');
      Object.entries(monthlyCount).forEach(([month, count]) => {
        const monthName = new Date(2024, month - 1, 1).toLocaleString('default', { month: 'long' });
        console.log(`    ${monthName}: ${count} events`);
      });
      
      // Show first and last few records
      console.log('📋 Bin records (showing first 5 and last 5):');
      allBinRecords.slice(0, 5).forEach((record, index) => {
        console.log(`  - ${index + 1}. ${record.fullAt.toLocaleString()}`);
      });
      if (allBinRecords.length > 10) {
        console.log(`  ... (${allBinRecords.length - 10} records omitted) ...`);
        allBinRecords.slice(-5).forEach((record, index) => {
          const actualIndex = allBinRecords.length - 5 + index + 1;
          console.log(`  - ${actualIndex}. ${record.fullAt.toLocaleString()}`);
        });
      }
    }

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();