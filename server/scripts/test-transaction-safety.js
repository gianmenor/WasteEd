import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTransactionSafety() {
  try {
    console.log('🧪 Testing Transaction-Based Duplicate Prevention...\n');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`Testing date: ${today.toDateString()}\n`);

    // Clean up any existing record for today
    await prisma.waste_items.deleteMany({
      where: { date: today }
    });
    console.log('🧹 Cleaned up any existing test records\n');

    // Simulate the transaction logic from our API
    async function simulateAPICall(requestNumber, data) {
      try {
        console.log(`Request ${requestNumber}: Starting transaction...`);
        
        const result = await prisma.$transaction(async (tx) => {
          // Check if a record already exists for today
          const existingRecord = await tx.waste_items.findUnique({
            where: { date: today }
          });

          if (existingRecord) {
            // Record already exists - throw error
            const error = new Error('RECORD_ALREADY_EXISTS');
            error.code = 'DUPLICATE_RECORD';
            error.existingRecord = existingRecord;
            throw error;
          }

          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 100));

          // Create new record since none exists for today
          return await tx.waste_items.create({
            data: {
              recyclable: data.recyclable,
              biodegradable: data.biodegradable,
              nonBiodegradable: data.nonBiodegradable,
              date: today
            }
          });
        });

        console.log(`✅ Request ${requestNumber}: SUCCESS - Created record ID ${result.id}`);
        return { success: true, result };

      } catch (error) {
        if (error.code === 'DUPLICATE_RECORD') {
          console.log(`⚠️  Request ${requestNumber}: DUPLICATE - Record already exists`);
          return { success: false, reason: 'duplicate' };
        }
        console.log(`❌ Request ${requestNumber}: ERROR - ${error.message}`);
        return { success: false, reason: 'error', error };
      }
    }

    // Test 1: Sequential requests
    console.log('1. Testing sequential requests...');
    
    const request1 = await simulateAPICall(1, { recyclable: 10, biodegradable: 8, nonBiodegradable: 5 });
    const request2 = await simulateAPICall(2, { recyclable: 15, biodegradable: 12, nonBiodegradable: 7 });

    console.log(`   Request 1: ${request1.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Request 2: ${request2.success ? 'SUCCESS' : 'FAILED'} (${request2.reason})\n`);

    // Verify only one record exists
    const recordCount = await prisma.waste_items.count({
      where: { date: today }
    });
    console.log(`✅ Total records for today: ${recordCount}`);

    // Test 2: Concurrent requests (simulating race condition)
    console.log('\n2. Testing concurrent requests (race condition simulation)...');
    
    // Clean up first
    await prisma.waste_items.deleteMany({
      where: { date: today }
    });

    // Start multiple requests simultaneously
    const concurrentPromises = [
      simulateAPICall(3, { recyclable: 20, biodegradable: 15, nonBiodegradable: 10 }),
      simulateAPICall(4, { recyclable: 25, biodegradable: 18, nonBiodegradable: 12 }),
      simulateAPICall(5, { recyclable: 30, biodegradable: 20, nonBiodegradable: 15 })
    ];

    const concurrentResults = await Promise.all(concurrentPromises);
    
    const successCount = concurrentResults.filter(r => r.success).length;
    const duplicateCount = concurrentResults.filter(r => r.reason === 'duplicate').length;

    console.log(`   Successful requests: ${successCount}`);
    console.log(`   Duplicate conflicts: ${duplicateCount}`);

    // Verify only one record exists after concurrent requests
    const finalRecordCount = await prisma.waste_items.count({
      where: { date: today }
    });
    console.log(`✅ Final records for today: ${finalRecordCount}\n`);

    if (finalRecordCount === 1 && successCount === 1) {
      console.log('🎉 Transaction-based approach working correctly!');
      console.log('✅ Prevents race conditions');
      console.log('✅ Ensures exactly one record per day');
      console.log('✅ Proper error handling for duplicates');
    } else {
      console.log('❌ Issues detected with transaction approach');
    }

    // Clean up test records
    await prisma.waste_items.deleteMany({
      where: { date: today }
    });
    console.log('\n🧹 Test records cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTransactionSafety();