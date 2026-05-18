import bcrypt from 'bcrypt';
import { prisma } from '../utils/database.js';

const username = 'wasteed';
const newPassword = 'wasteed1234';
const saltRounds = 10;

async function main() {
  const hashed = await bcrypt.hash(newPassword, saltRounds);

  const result = await prisma.account.upsert({
    where: { username },
    update: { password: hashed },
    create: {
      username,
      password: hashed,
      role: 'admin',
    }
  });

  console.log(`Password for "${username}" set (upserted). Account id: ${result.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error updating password:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
