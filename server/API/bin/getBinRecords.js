import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma, retryOperation } from '../../utils/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

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

    // Try to resolve the authenticated user for read status
    let userId = null;
    const includeReadStatus = req.query.includeReadStatus === 'true';
    if (includeReadStatus) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, JWT_SECRET);
          const user = await prisma.account.findUnique({
            where: { id: decoded.userId }
          });
          if (user) {
            userId = user.id;
          }
        } catch (error) {
          console.warn('Bin records read status auth failed:', error.message);
        }
      }
    }

    const allowedSortBy = ['fullAt', 'createdAt', 'binType', 'id'];
    const sortField = allowedSortBy.includes(sortBy) ? sortBy : 'fullAt';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions = [];
    const values = [];

    if (dateFrom) {
      conditions.push('b.fullAt >= ?');
      values.push(new Date(dateFrom));
    }
    if (dateTo) {
      conditions.push('b.fullAt <= ?');
      values.push(new Date(dateTo));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get records with retry operation for reliability
    const [records, totalCount] = await retryOperation(async () => {
      const recordsQuery = `
        SELECT
          b.id,
          b.fullAt,
          b.binType,
          b.createdAt,
          EXISTS(
            SELECT 1 FROM bin_notification_reads r
            WHERE r.accountId = ? AND r.binId = b.id
          ) AS isRead
        FROM bin_records b
        ${whereClause}
        ORDER BY b.${sortField} ${sortDirection}
        LIMIT ?
        OFFSET ?
      `;

      const recordsResult = await prisma.$queryRawUnsafe(
        recordsQuery,
        userId || 0,
        ...values,
        limitNum,
        skip
      );

      const countResult = await prisma.bin.count({ where: dateFilter });

      return [recordsResult, countResult];
    });

    const formattedRecords = records.map((record) => ({
      ...record,
      isRead: Boolean(record.isRead)
    }));

    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      message: 'Bin records retrieved successfully',
      data: {
        records: formattedRecords,
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