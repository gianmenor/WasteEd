import express from 'express';
import { prisma, retryOperation } from '../../utils/database.js';

const router = express.Router();

// GET /api/profit/records - Get all profit records with filters
router.get('/records', async (req, res) => {
  try {
    const {
      period = 'all',
      year,
      month,
      page = 1,
      limit = 50
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
    }

    const where = {};
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }

    const [records, total] = await Promise.all([
      retryOperation(async () => {
        return await prisma.profitReward.findMany({
          where,
          orderBy: { date: 'desc' },
          skip,
          take: limitNum
        });
      }),
      retryOperation(async () => {
        return await prisma.profitReward.count({ where });
      })
    ]);

    res.json({
      success: true,
      data: records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum < Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching profit records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profit records',
      error: error.message
    });
  }
});

// POST /api/profit/add - Add new profit/reward record
router.post('/add', async (req, res) => {
  try {
    const { profitAmount, expenseAmount, revenue, source, description } = req.body;

    // Validation
    if (profitAmount === undefined || profitAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Profit amount must be a non-negative number'
      });
    }

    if (expenseAmount === undefined || expenseAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Expense amount must be a non-negative number'
      });
    }

    if (profitAmount === 0 && expenseAmount === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one amount must be greater than zero'
      });
    }

    const netProfit = profitAmount - expenseAmount;

    const record = await retryOperation(async () => {
      return await prisma.profitReward.create({
        data: {
          date: new Date(),
          profitFromRecyclables: parseFloat(profitAmount),
          rewardsSpent: parseFloat(expenseAmount),
          netProfit: parseFloat(netProfit),
          notes: description || source || null
        }
      });
    });

    res.status(201).json({
      success: true,
      message: 'Profit/reward record added successfully',
      data: record
    });
  } catch (error) {
    console.error('Error adding profit record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add profit record',
      error: error.message
    });
  }
});

// PUT /api/profit/update/:id - Update existing record
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, profitFromRecyclables, rewardsSpent, notes } = req.body;

    const recordId = parseInt(id);

    // Check if record exists
    const existing = await retryOperation(async () => {
      return await prisma.profitReward.findUnique({
        where: { id: recordId }
      });
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    // Calculate new net profit
    const profit = profitFromRecyclables !== undefined 
      ? parseFloat(profitFromRecyclables) 
      : existing.profitFromRecyclables;
    
    const rewards = rewardsSpent !== undefined 
      ? parseFloat(rewardsSpent) 
      : existing.rewardsSpent;
    
    const netProfit = profit - rewards;

    const updateData = {
      netProfit
    };

    if (date) updateData.date = new Date(date);
    if (profitFromRecyclables !== undefined) updateData.profitFromRecyclables = profit;
    if (rewardsSpent !== undefined) updateData.rewardsSpent = rewards;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await retryOperation(async () => {
      return await prisma.profitReward.update({
        where: { id: recordId },
        data: updateData
      });
    });

    res.json({
      success: true,
      message: 'Record updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error updating profit record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profit record',
      error: error.message
    });
  }
});

// DELETE /api/profit/delete/:id - Delete record
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recordId = parseInt(id);

    const deleted = await retryOperation(async () => {
      return await prisma.profitReward.delete({
        where: { id: recordId }
      });
    });

    res.json({
      success: true,
      message: 'Record deleted successfully',
      data: deleted
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    console.error('Error deleting profit record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profit record',
      error: error.message
    });
  }
});

// GET /api/profit/summary - Aggregated summary
router.get('/summary', async (req, res) => {
  try {
    const { period = 'all', year, month } = req.query;

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
    }

    const where = {};
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }

    const records = await retryOperation(async () => {
      return await prisma.profitReward.findMany({ where });
    });

    const summary = {
      totalProfit: 0,
      totalRewardsSpent: 0,
      totalNetProfit: 0,
      recordCount: records.length,
      averageProfit: 0,
      averageRewards: 0,
      averageNetProfit: 0
    };

    records.forEach(record => {
      summary.totalProfit += record.profitFromRecyclables;
      summary.totalRewardsSpent += record.rewardsSpent;
      summary.totalNetProfit += record.netProfit;
    });

    if (records.length > 0) {
      summary.averageProfit = summary.totalProfit / records.length;
      summary.averageRewards = summary.totalRewardsSpent / records.length;
      summary.averageNetProfit = summary.totalNetProfit / records.length;
    }

    res.json({
      success: true,
      data: summary,
      period
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

// GET /api/profit/net-profit - Calculate net profit with filters
router.get('/net-profit', async (req, res) => {
  try {
    const { period = 'all', year, month } = req.query;

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
    }

    const where = {};
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }

    const records = await retryOperation(async () => {
      return await prisma.profitReward.findMany({
        where,
        orderBy: { date: 'asc' }
      });
    });

    const netProfitData = records.map(record => ({
      date: record.date,
      profit: record.profitFromRecyclables,
      rewards: record.rewardsSpent,
      netProfit: record.netProfit
    }));

    const totalNetProfit = records.reduce((sum, r) => sum + r.netProfit, 0);

    res.json({
      success: true,
      data: {
        totalNetProfit,
        records: netProfitData,
        count: records.length
      }
    });
  } catch (error) {
    console.error('Error calculating net profit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate net profit',
      error: error.message
    });
  }
});

export default router;
