import express from 'express';
import { prisma, retryOperation } from '../../utils/database.js';

const router = express.Router();

// GET /api/bin/records - Get all bin full notifications with pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'fullAt',
      sortOrder = 'desc',
      dateFrom,
      dateTo
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build date filter if provided
    let dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.fullAt = {};
      if (dateFrom) {
        dateFilter.fullAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.fullAt.lte = new Date(dateTo);
      }
    }

    // Get records with retry operation for reliability
    const [records, totalCount] = await retryOperation(async () => {
      return await Promise.all([
        prisma.bin.findMany({
          where: dateFilter,
          orderBy: {
            [sortBy]: sortOrder
          },
          skip: skip,
          take: limitNum,
        }),
        prisma.bin.count({
          where: dateFilter
        })
      ]);
    });

    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      message: 'Bin records retrieved successfully',
      data: {
        records,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          limit: limitNum,
          hasNext: pageNum < totalPages,
          hasPrevious: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving bin records:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bin records',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/bin/records/latest - Get the most recent bin full notification
router.get('/latest', async (req, res) => {
  try {
    const latestRecord = await retryOperation(async () => {
      return await prisma.bin.findFirst({
        orderBy: {
          fullAt: 'desc'
        }
      });
    });

    if (!latestRecord) {
      return res.status(404).json({
        success: false,
        message: 'No bin records found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Latest bin record retrieved successfully',
      data: latestRecord
    });

  } catch (error) {
    console.error('Error retrieving latest bin record:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve latest bin record',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;