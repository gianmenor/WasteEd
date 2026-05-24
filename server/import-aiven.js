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
    const password = process.env.AIVEN_DB_PASSWORD;
    if (!password) {
      console.error('Missing AIVEN_DB_PASSWORD environment variable.');
      process.exit(1);
    }

    conn = await mysql.createConnection({
      host: 'mysql-291c6724-wasteed12345-e207.f.aivencloud.com',
      port: 15607,
      user: 'avnadmin',
      password,
      database: 'defaultdb',
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
