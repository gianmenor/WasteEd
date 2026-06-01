import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../utils/database.js';

const envPath = path.resolve(process.cwd(), 'server/.env');
dotenv.config({ path: envPath });

const CURRENT_YEAR = new Date().getFullYear();
const START_DATE = new Date(CURRENT_YEAR, 0, 1); // Jan 1
const END_DATE = new Date(CURRENT_YEAR, 4, 31); // May 31
const DAY_COUNT = Math.floor((END_DATE - START_DATE) / (24 * 60 * 60 * 1000)) + 1;
const TOTAL_WASTE_PIECES = 1000;
const TARGET_COUNTS = {
  recyclable: 600,
  biodegradable: 100,
  nonBiodegradable: 300
};
const RECORD_MIN_PIECES = 5;
const RECORD_MAX_PIECES = 15;

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const buildWasteBatches = () => {
  const pieces = [];
  pieces.push(...Array(TARGET_COUNTS.recyclable).fill('recyclable'));
  pieces.push(...Array(TARGET_COUNTS.nonBiodegradable).fill('nonBiodegradable'));
  pieces.push(...Array(TARGET_COUNTS.biodegradable).fill('biodegradable'));
  shuffle(pieces);

  const batches = [];
  let index = 0;
  while (index < pieces.length) {
    const remaining = pieces.length - index;
    let size = remaining <= RECORD_MAX_PIECES
      ? remaining
      : randomInt(RECORD_MIN_PIECES, Math.min(RECORD_MAX_PIECES, remaining - RECORD_MIN_PIECES));

    if (remaining - size > 0 && remaining - size < RECORD_MIN_PIECES) {
      size = remaining - RECORD_MIN_PIECES;
    }

    const batch = pieces.slice(index, index + size);
    batches.push(batch);
    index += size;
  }

  return batches;
};

const buildRecords = () => {
  const batches = buildWasteBatches();
  const records = batches.map((batch, idx) => {
    const date = new Date(START_DATE);
    const dayIndex = Math.min(Math.floor(idx * DAY_COUNT / batches.length), DAY_COUNT - 1);
    date.setDate(START_DATE.getDate() + dayIndex);
    date.setHours(0, 0, 0, 0);

    const recordedAt = new Date(date);
    recordedAt.setHours(randomInt(6, 20), randomInt(0, 59), randomInt(0, 59), 0);

    const recyclable = batch.filter((item) => item === 'recyclable').length;
    const biodegradable = batch.filter((item) => item === 'biodegradable').length;
    const nonBiodegradable = batch.filter((item) => item === 'nonBiodegradable').length;

    return {
      recyclable,
      biodegradable,
      nonBiodegradable,
      date,
      recordedAt
    };
  });

  return records;
};

const run = async () => {
  try {
    console.log('⏳ Resetting waste and coupon data...');

    await prisma.couponTransaction.deleteMany();
    await prisma.coupon.deleteMany();
    await prisma.waste_items.deleteMany();

    console.log('✅ Cleared existing waste_items, coupons, and coupon_transactions');

    const wasteRecords = buildRecords();
    const batchSize = 200;
    let inserted = 0;
    for (let i = 0; i < wasteRecords.length; i += batchSize) {
      const batch = wasteRecords.slice(i, i + batchSize);
      const result = await prisma.waste_items.createMany({ data: batch });
      inserted += result.count;
      console.log(`  • inserted ${inserted}/${TOTAL_RECORDS} waste records`);
    }

    const totalRecyclable = wasteRecords.reduce((sum, record) => sum + record.recyclable, 0);
    const couponBalance = Math.max(totalRecyclable + 200, 1000);

    const coupon = await prisma.coupon.create({
      data: {
        balance: couponBalance,
        used: 0
      }
    });

    await prisma.couponTransaction.create({
      data: {
        type: 'ADD',
        amount: couponBalance,
        balance: couponBalance,
        reason: 'Initial seed balance for waste dataset',
        notes: `Seeded after resetting waste items for Jan-May ${CURRENT_YEAR}`
      }
    });

    console.log(`✅ Created coupon balance ${couponBalance} with one initial transaction`);
    console.log('🎉 Reset complete');
  } catch (error) {
    console.error('❌ Error resetting data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

run();
