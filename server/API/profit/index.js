import express from 'express';
import { prisma, retryOperation } from '../../utils/database.js';

const router = express.Router();

const roundTwo = (value) => {
  const num = Number(value) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

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

    // Check month first (more specific than year)
    if (period === 'month' || month) {
      const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
      const targetYear = year ? parseInt(year) : now.getFullYear();
      dateFilter.gte = new Date(targetYear, targetMonth, 1);
      dateFilter.lt = new Date(targetYear, targetMonth + 1, 1);
    } else if (period === 'year' || year) {
      const targetYear = year ? parseInt(year) : now.getFullYear();
      dateFilter.gte = new Date(targetYear, 0, 1);
      dateFilter.lt = new Date(targetYear + 1, 0, 1);
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

    const [records, total] = await retryOperation(async () => {
      return await prisma.$transaction([
        prisma.profitReward.findMany({
          where,
          orderBy: [
            { date: 'desc' },
            { createdAt: 'desc' }
          ],
          skip,
          take: limitNum
        }),
        prisma.profitReward.count({ where })
      ]);
    });

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
    const { date, profitAmount, expenseAmount, revenue, source, description } = req.body;

    // Validation
    if (profitAmount === undefined || profitAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Profit amount must be a non-negative number'
      });
    }

    let recordDate = new Date();
    if (date) {
      recordDate = new Date(`${date}T00:00:00`);
      if (Number.isNaN(recordDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
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

    const profit = roundTwo(profitAmount);
    const rewards = roundTwo(expenseAmount);
    const netProfit = roundTwo(profit - rewards);

    const record = await retryOperation(async () => {
      return await prisma.profitReward.create({
        data: {
          date: recordDate,
          profitFromRecyclables: profit,
          rewardsSpent: rewards,
          netProfit,
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
      ? roundTwo(profitFromRecyclables) 
      : roundTwo(existing.profitFromRecyclables);
    
    const rewards = rewardsSpent !== undefined 
      ? roundTwo(rewardsSpent) 
      : roundTwo(existing.rewardsSpent);
    
    const netProfit = roundTwo(profit - rewards);

    const updateData = {
      netProfit
    };

    if (date) {
      const parsedDate = new Date(`${date}T00:00:00`);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      updateData.date = parsedDate;
    }

    if (profitFromRecyclables !== undefined) {
      updateData.profitFromRecyclables = roundTwo(profitFromRecyclables);
    }

    if (rewardsSpent !== undefined) {
      updateData.rewardsSpent = roundTwo(rewardsSpent);
    }

    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    const updatedRecord = await retryOperation(async () => {
      return await prisma.profitReward.update({
        where: { id: recordId },
        data: updateData
      });
    });

    res.json({
      success: true,
      message: 'Profit/reward record updated successfully',
      data: updatedRecord
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

// DELETE /api/profit/delete/:id - Delete a profit/reward record
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recordId = parseInt(id);

    const deletedRecord = await retryOperation(async () => {
      return await prisma.profitReward.delete({
        where: { id: recordId }
      });
    });

    res.json({
      success: true,
      message: 'Profit/reward record deleted successfully',
      data: deletedRecord
    });
  } catch (error) {
    console.error('Error deleting profit record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profit record',
      error: error.message
    });
  }
});

export default router;
