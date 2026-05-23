import fs from 'fs';
import mysql from 'mysql2/promise';

const dumpFile = 'wasteed.sql';
if (!fs.existsSync(dumpFile)) {
  console.error(`Missing ${dumpFile}. Run mysqldump first.`);
  process.exit(1);
}

const rawSql = fs.readFileSync(dumpFile, 'utf8');
const sql = rawSql
  .replace(/CREATE DATABASE .*?;/gi, '')
  .replace(/USE `?.*?`?;/gi, '')
  .replace(/USE .*?;/gi, '');

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.AIVEN_HOST || '<AIVEN_HOST>',
      port: Number(process.env.AIVEN_PORT || 15607),
      user: process.env.AIVEN_USER || '<AIVEN_USER>',
      password: process.env.AIVEN_PASSWORD || '<AIVEN_PASSWORD>',
      database: process.env.AIVEN_DATABASE || '<AIVEN_DATABASE>',
      ssl: { rejectUnauthorized: false },
      multipleStatements: true,
    });
    console.log('Connected to Aiven. Starting import...');
    await conn.query(sql);
    console.log('Import to Aiven completed successfully.');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
