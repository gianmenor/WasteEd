import { PrismaClient } from '@prisma/client';

async function checkData() {
  const prisma = new PrismaClient();
  
  try {
    // Get total count
    const totalCount = await prisma.wasteItem.count();
    console.log('Total records in database:', totalCount);
    
    // Get date range
    const firstRecord = await prisma.wasteItem.findFirst({
      orderBy: { date: 'asc' },
      select: { date: true }
    });
    
    const lastRecord = await prisma.wasteItem.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true }
    });
    
    console.log('Date range:');
    console.log('First record:', firstRecord?.date);
    console.log('Last record:', lastRecord?.date);
    
    // Get some sample dates
    const sampleRecords = await prisma.wasteItem.findMany({
      take: 10,
      orderBy: { date: 'asc' },
      select: { date: true }
    });
    
    console.log('\nFirst 10 dates:');
    sampleRecords.forEach((record, index) => {
      console.log(`${index + 1}. ${record.date.toISOString().split('T')[0]}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();