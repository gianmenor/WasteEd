import express from 'express';
import { prisma } from '../../utils/database.js';
import { verifyToken } from '../accounts/auth.js';

const router = express.Router();

// POST /api/bin/records/read - Mark one or more bin records as read for the authenticated user
router.post('/', verifyToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of notification IDs to mark as read.'
      });
    }

    const binIds = ids
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (binIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid bin record IDs were provided.'
      });
    }

    const existingBinRecords = await prisma.bin.findMany({
      where: { id: { in: binIds } },
      select: { id: true }
    });

    if (existingBinRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching bin records found for the provided IDs.'
      });
    }

    const insertValues = existingBinRecords
      .map((record) => `(${req.user.id}, ${record.id})`)
      .join(', ');

    await prisma.$executeRawUnsafe(
      `INSERT IGNORE INTO bin_notification_reads (accountId, binId) VALUES ${insertValues}`
    );

    return res.json({
      success: true,
      message: 'Notifications marked as read successfully.'
    });
  } catch (error) {
    console.error('Error marking bin records as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;
