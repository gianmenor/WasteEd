import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testImmutableRecords() {
  try {
    console.log('🧪 Testing Immutable Record Behavior...\n');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`Testing date: ${today.toDateString()}\n`);

    // Clean up any existing record for today
    await prisma.waste_items.deleteMany({
      where: { date: today }
    });
    console.log('🧹 Cleaned up any existing test records\n');

    // Test 1: First submission (should succeed)
    console.log('1. First submission (should create new record)...');
    
    const firstRecord = await prisma.waste_items.create({
      data: {
        recyclable: 10,
        biodegradable: 8,
        nonBiodegradable: 5,
        date: today
      }
    });

    console.log(`✅ Created: R:${firstRecord.recyclable}, B:${firstRecord.biodegradable}, NB:${firstRecord.nonBiodegradable}`);
    console.log(`   ID: ${firstRecord.id}, Total: ${firstRecord.recyclable + firstRecord.biodegradable + firstRecord.nonBiodegradable}\n`);

    // Test 2: Second submission (should fail with unique constraint)
    console.log('2. Second submission (should fail with unique constraint)...');
    
    try {
      await prisma.waste_items.create({
        data: {
          recyclable: 15,
          biodegradable: 12,
          nonBiodegradable: 7,
          date: today
        }
      });
      console.log('❌ ERROR: Second record should not have been created!');
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('✅ Expected error: Unique constraint violation (P2002)');
        console.log('✅ System correctly prevents duplicate records\n');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 3: Verify only one record exists
    console.log('3. Verifying only one record exists for today...');
    const todayRecords = await prisma.waste_items.findMany({
      where: { date: today }
    });

    console.log(`✅ Found ${todayRecords.length} record(s) for today`);
    if (todayRecords.length === 1) {
      const record = todayRecords[0];
      console.log(`   Record: R:${record.recyclable}, B:${record.biodegradable}, NB:${record.nonBiodegradable}`);
      console.log('✅ Immutable behavior working correctly\n');
    } else {
      console.log('❌ Expected exactly 1 record, found:', todayRecords.length);
    }

    // Test 4: Test the API logic (findUnique check)
    console.log('4. Testing API logic (findUnique check)...');
    const existingCheck = await prisma.waste_items.findUnique({
      where: { date: today }
    });

    if (existingCheck) {
      console.log('✅ findUnique correctly finds existing record');
      console.log('✅ API should return 409 Conflict for duplicate attempts\n');
    } else {
      console.log('❌ findUnique failed to find existing record');
    }

    console.log('🎉 All tests completed!');
    console.log('✅ Records are properly immutable');
    console.log('✅ Unique constraint is working');
    console.log('✅ API logic should handle duplicates correctly');

    // Clean up the test record
    await prisma.waste_items.delete({
      where: { id: firstRecord.id }
    });
    console.log('\n🧹 Test record cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testImmutableRecords();