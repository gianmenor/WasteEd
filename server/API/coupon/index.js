import express from 'express';
import { prisma, retryOperation } from '../../utils/database.js';

const router = express.Router();

// GET /api/coupon/balance - Get current coupon balance
router.get('/balance', async (req, res) => {
  try {
    const coupon = await retryOperation(async () => {
      return await prisma.coupon.findFirst({
        orderBy: { id: 'desc' }
      });
    });

    if (!coupon) {
      // Initialize if doesn't exist
      const newCoupon = await retryOperation(async () => {
        return await prisma.coupon.create({
          data: { balance: 0, used: 0 }
        });
      });

      return res.json({
        success: true,
        data: {
          balance: newCoupon.balance,
          used: newCoupon.used,
          available: newCoupon.balance
        }
      });
    }

    res.json({
      success: true,
      data: {
        balance: coupon.balance,
        used: coupon.used,
        available: coupon.balance
      }
    });
  } catch (error) {
    console.error('Error fetching coupon balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupon balance',
      error: error.message
    });
  }
});

// GET /api/coupon/transactions - Get transaction history with filters
router.get('/transactions', async (req, res) => {
  try {
    const { 
      period = 'all',  // all, year, month, week, day, hour
      year,
      month,
      page = 1,
      limit = 50,
      type  // ADD, USE, ADJUST
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build date filter
    const dateFilter = {};
    const now = new Date();

    if (period === 'year' || year) {
      const targetYear = year ? parseInt(year) : now.getFullYear();
      dateFilter.gte = new Date(targetYear, 0, 1);
      dateFilter.lt = new Date(targetYear + 1, 0, 1);
    } else if (period === 'month' || month) {
      const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
      const targetYear = year ? parseInt(year) : now.getFullYear();
      dateFilter.gte = new Date(targetYear, targetMonth, 1);
      dateFilter.lt = new Date(targetYear, targetMonth + 1, 1);
    } else if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter.gte = weekAgo;
    } else if (period === 'day') {
      dateFilter.gte = new Date(now.setHours(0, 0, 0, 0));
    } else if (period === 'hour') {
      const hourAgo = new Date(now);
      hourAgo.setHours(hourAgo.getHours() - 1);
      dateFilter.gte = hourAgo;
    }

    const where = {};
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }
    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      retryOperation(async () => {
        return await prisma.couponTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum
        });
      }),
      retryOperation(async () => {
        return await prisma.couponTransaction.count({ where });
      })
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum < Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// POST /api/coupon/add - Admin adds coupons
router.post('/add', async (req, res) => {
  try {
    const { amount, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Get current balance
    let coupon = await retryOperation(async () => {
      return await prisma.coupon.findFirst({
        orderBy: { id: 'desc' }
      });
    });

    if (!coupon) {
      coupon = await retryOperation(async () => {
        return await prisma.coupon.create({
          data: { balance: 0, used: 0 }
        });
      });
    }

    const newBalance = coupon.balance + amount;

    // Update balance and create transaction
    const [updatedCoupon, transaction] = await Promise.all([
      retryOperation(async () => {
        return await prisma.coupon.update({
          where: { id: coupon.id },
          data: { balance: newBalance }
        });
      }),
      retryOperation(async () => {
        return await prisma.couponTransaction.create({
          data: {
            type: 'ADD',
            amount,
            balance: newBalance,
            reason: 'Admin added coupons',
            notes
          }
        });
      })
    ]);

    res.json({
      success: true,
      message: `Added ${amount} coupons successfully`,
      data: {
        previousBalance: coupon.balance,
        addedAmount: amount,
        newBalance: updatedCoupon.balance,
        transaction
      }
    });
  } catch (error) {
    console.error('Error adding coupons:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add coupons',
      error: error.message
    });
  }
});

// POST /api/coupon/adjust - Admin manually adjusts balance
router.post('/adjust', async (req, res) => {
  try {
    const { amount, reason, notes } = req.body;

    if (!amount || amount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount cannot be zero'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for manual adjustments'
      });
    }

    let coupon = await retryOperation(async () => {
      return await prisma.coupon.findFirst({
        orderBy: { id: 'desc' }
      });
    });

    if (!coupon) {
      coupon = await retryOperation(async () => {
        return await prisma.coupon.create({
          data: { balance: 0, used: 0 }
        });
      });
    }

    const newBalance = coupon.balance + amount;

    if (newBalance < 0) {
      return res.status(400).json({
        success: false,
        message: 'Adjustment would result in negative balance'
      });
    }

    const [updatedCoupon, transaction] = await Promise.all([
      retryOperation(async () => {
        return await prisma.coupon.update({
          where: { id: coupon.id },
          data: { balance: newBalance }
        });
      }),
      retryOperation(async () => {
        return await prisma.couponTransaction.create({
          data: {
            type: 'ADJUST',
            amount,
            balance: newBalance,
            reason,
            notes
          }
        });
      })
    ]);

    res.json({
      success: true,
      message: `Adjusted coupons by ${amount}`,
      data: {
        previousBalance: coupon.balance,
        adjustment: amount,
        newBalance: updatedCoupon.balance,
        transaction
      }
    });
  } catch (error) {
    console.error('Error adjusting coupons:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to adjust coupons',
      error: error.message
    });
  }
});

// GET /api/coupon/summary - Summary by time period
router.get('/summary', async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const groupBy = {};
    const now = new Date();

    let dateFilter = {};
    if (period === 'month') {
      dateFilter = {
        gte: new Date(now.getFullYear(), 0, 1),
        lt: new Date(now.getFullYear() + 1, 0, 1)
      };
    }

    const transactions = await retryOperation(async () => {
      return await prisma.couponTransaction.findMany({
        where: dateFilter.gte ? { createdAt: dateFilter } : {},
        orderBy: { createdAt: 'asc' }
      });
    });

    // Group by period
    const summary = {};
    transactions.forEach(tx => {
      const date = new Date(tx.createdAt);
      let key;

      if (period === 'year') {
        key = date.getFullYear().toString();
      } else if (period === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'day') {
        key = date.toISOString().split('T')[0];
      } else {
        key = date.toISOString().split(':')[0]; // Hour
      }

      if (!summary[key]) {
        summary[key] = {
          period: key,
          added: 0,
          used: 0,
          adjusted: 0,
          transactions: 0
        };
      }

      summary[key].transactions++;
      if (tx.type === 'ADD') {
        summary[key].added += tx.amount;
      } else if (tx.type === 'USE') {
        summary[key].used += Math.abs(tx.amount);
      } else if (tx.type === 'ADJUST') {
        summary[key].adjusted += tx.amount;
      }
    });

    res.json({
      success: true,
      data: Object.values(summary)
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate summary',
      error: error.message
    });
  }
});

// Internal function to consume coupons (called by waste record creation)
export const consumeCoupons = async (wasteRecordId, amount = 1) => {
  try {
    let coupon = await retryOperation(async () => {
      return await prisma.coupon.findFirst({
        orderBy: { id: 'desc' }
      });
    });

    if (!coupon) {
      console.warn('No coupon record found, skipping consumption');
      return null;
    }

    if (coupon.balance < amount) {
      console.warn('Insufficient coupon balance');
      return null;
    }

    const newBalance = coupon.balance - amount;
    const newUsed = coupon.used + amount;

    const [updatedCoupon, transaction] = await Promise.all([
      retryOperation(async () => {
        return await prisma.coupon.update({
          where: { id: coupon.id },
          data: { 
            balance: newBalance,
            used: newUsed
          }
        });
      }),
      retryOperation(async () => {
        return await prisma.couponTransaction.create({
          data: {
            type: 'USE',
            amount: -amount,
            balance: newBalance,
            reason: 'Waste record processed',
            wasteRecordId,
            notes: `Auto-consumed ${amount} coupon(s) for waste processing`
          }
        });
      })
    ]);

    return { updatedCoupon, transaction };
  } catch (error) {
    console.error('Error consuming coupons:', error);
    throw error;
  }
};

export default router;
