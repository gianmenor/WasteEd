import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });
const key = process.env.FIREBASE_PRIVATE_KEY;
console.log('len=' + key.length);
console.log('startsWith BEGIN: ' + key.startsWith('-----BEGIN PRIVATE KEY-----'));
console.log('includes literal \\n: ' + key.includes('\\n'));
console.log('first 5 chars:' + key.slice(0,5));
console.log('last 5 chars:' + key.slice(-5));
try {
  const parsed = key.replace(/\\n/g, '\n');
  console.log('parsed includes actual newline: ' + parsed.includes('\n'));
  console.log('parsed first 5 chars:' + parsed.slice(0,5));
} catch (err) {
  console.error(err);
}
