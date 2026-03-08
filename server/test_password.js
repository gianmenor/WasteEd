import { prisma } from './utils/database.js';
import bcrypt from 'bcrypt';

async function testPasswords() {
  try {
    const user = await prisma.account.findFirst({
      where: { username: 'admin' }
    });
    
    if (!user) {
      console.log('❌ Admin user NOT FOUND');
      return;
    }
    
    console.log('Testing different passwords against stored hash:');
    console.log('Stored hash:', user.password);
    console.log('');
    
    const testPasswords = ['123456', 'admin', 'password', 'admin123', ''];
    
    for (const pwd of testPasswords) {
      const isValid = await bcrypt.compare(pwd, user.password);
      console.log(`  '${pwd}' => ${isValid ? '✅ VALID' : '❌ Invalid'}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPasswords();
