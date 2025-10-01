import express from 'express';
import { prisma, retryOperation } from '../../utils/database.js';

// Route Path ( '/api/bin/analytics' )
const router = express.Router();

// GET /api/bin/analytics/daily - Get daily bin full statistics
router.get('/daily', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = parseInt(days);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const dailyStats = await retryOperation(async () => {
      return await prisma.$queryRaw`
        SELECT 
          DATE(fullAt) as date,
          COUNT(*) as binFullCount
        FROM bin_records 
        WHERE fullAt >= ${startDate} AND fullAt <= ${endDate}
        GROUP BY DATE(fullAt)
        ORDER BY date DESC
      `;
    });

    // Format the response to ensure all dates are included (even with 0 count)
    const dateMap = new Map();
    for (let i = 0; i < daysNum; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dateMap.set(dateStr, 0);
    }

    // Fill in actual counts
    dailyStats.forEach(stat => {
      const dateStr = new Date(stat.date).toISOString().split('T')[0];
      dateMap.set(dateStr, Number(stat.binFullCount));
    });

    // Convert to array format
    const formattedStats = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, binFullCount: count }))
      .reverse(); // Show oldest to newest

    res.status(200).json({
      success: true,
      message: 'Daily bin analytics retrieved successfully',
      data: {
        period: `${daysNum} days`,
        stats: formattedStats,
        summary: {
          totalDays: daysNum,
          totalBinFulEvents: formattedStats.reduce((sum, stat) => sum + stat.binFullCount, 0),
          averagePerDay: (formattedStats.reduce((sum, stat) => sum + stat.binFullCount, 0) / daysNum).toFixed(2)
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving daily bin analytics:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve daily bin analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/bin/analytics/monthly - Get monthly bin full statistics
router.get('/monthly', async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const monthsNum = parseInt(months);

    const monthlyStats = await retryOperation(async () => {
      return await prisma.$queryRaw`
        SELECT 
          YEAR(fullAt) as year,
          MONTH(fullAt) as month,
          COUNT(*) as binFullCount
        FROM bin_records 
        WHERE fullAt >= DATE_SUB(NOW(), INTERVAL ${monthsNum} MONTH)
        GROUP BY YEAR(fullAt), MONTH(fullAt)
        ORDER BY year DESC, month DESC
      `;
    });

    // Format the response
    const formattedStats = monthlyStats.map(stat => ({
      year: Number(stat.year),
      month: Number(stat.month),
      monthName: new Date(stat.year, stat.month - 1).toLocaleString('default', { month: 'long' }),
      binFullCount: Number(stat.binFullCount)
    }));

    res.status(200).json({
      success: true,
      message: 'Monthly bin analytics retrieved successfully',
      data: {
        period: `${monthsNum} months`,
        stats: formattedStats,
        summary: {
          totalMonths: formattedStats.length,
          totalBinFullEvents: formattedStats.reduce((sum, stat) => sum + stat.binFullCount, 0),
          averagePerMonth: formattedStats.length > 0 
            ? (formattedStats.reduce((sum, stat) => sum + stat.binFullCount, 0) / formattedStats.length).toFixed(2)
            : 0
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving monthly bin analytics:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve monthly bin analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/bin/analytics/summary - Get overall bin statistics summary
router.get('/summary', async (req, res) => {
  try {
    const [totalCount, todayCount, thisWeekCount, thisMonthCount, lastRecord] = await retryOperation(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const thisWeek = new Date();
      thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay()); // Start of week (Sunday)
      thisWeek.setHours(0, 0, 0, 0);
      
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      return await Promise.all([
        // Total count
        prisma.bin.count(),
        
        // Today count
        prisma.bin.count({
          where: {
            fullAt: {
              gte: today
            }
          }
        }),
        
        // This week count
        prisma.bin.count({
          where: {
            fullAt: {
              gte: thisWeek
            }
          }
        }),
        
        // This month count
        prisma.bin.count({
          where: {
            fullAt: {
              gte: thisMonth
            }
          }
        }),
        
        // Last record
        prisma.bin.findFirst({
          orderBy: {
            fullAt: 'desc'
          }
        })
      ]);
    });

    res.status(200).json({
      success: true,
      message: 'Bin analytics summary retrieved successfully',
      data: {
        totalBinFullEvents: totalCount,
        todayCount,
        thisWeekCount,
        thisMonthCount,
        lastBinFull: lastRecord ? lastRecord.fullAt : null,
        timeSinceLastFull: lastRecord 
          ? Math.floor((new Date() - new Date(lastRecord.fullAt)) / (1000 * 60 * 60)) // Hours since last full
          : null
      }
    });

  } catch (error) {
    console.error('Error retrieving bin analytics summary:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bin analytics summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;