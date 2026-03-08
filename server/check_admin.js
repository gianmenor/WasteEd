import { prisma } from './utils/database.js';
import bcrypt from 'bcrypt';

async function checkAdmin() {
  try {
    const user = await prisma.account.findFirst({
      where: { username: 'admin' }
    });
    
    if (!user) {
      console.log('❌ Admin user NOT FOUND in database');
      console.log('Run: npm run seed');
      return;
    }
    
    console.log('✅ Admin user found:');
    console.log('   Username:', user.username);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Has password:', !!user.password);
    
    // Test password
    const testPassword = '123456';
    const isValid = await bcrypt.compare(testPassword, user.password);
    console.log(`   Password '${testPassword}' valid:`, isValid);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();
