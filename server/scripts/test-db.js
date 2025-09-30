import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Test if we can query the database
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('🔍 Database query test:', result);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    if (error.code === 'P1001') {
      console.log('💡 Make sure MySQL server is running and accessible at localhost:3306');
      console.log('💡 Verify that the database "recyclist" exists');
      console.log('💡 Check your credentials: username=sean-brix');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();