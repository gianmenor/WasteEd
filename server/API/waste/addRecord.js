import { prisma, retryOperation } from '../../utils/database.js';
import { consumeCoupons } from '../coupon/index.js';
import { broadcastBinNotification } from '../bin/notifications.js';

// POST /api/waste/add
// Expected body: { recyclable: number, biodegradable: number, nonBiodegradable: number }
// Date is automatically set to today's date on the server
// Now supports multiple entries per day with different timestamps
export const addWasteRecord = async (req, res) => {
  try {
    const { recyclable, biodegradable, nonBiodegradable } = req.body;

    // Validate required fields
    if (recyclable === undefined || biodegradable === undefined || nonBiodegradable === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields. Please provide recyclable, biodegradable, and nonBiodegradable amounts.',
        required: ['recyclable', 'biodegradable', 'nonBiodegradable']
      });
    }

    // Validate data types
    if (typeof recyclable !== 'number' || typeof biodegradable !== 'number' || typeof nonBiodegradable !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'All waste amounts must be numbers.',
        received: { recyclable: typeof recyclable, biodegradable: typeof biodegradable, nonBiodegradable: typeof nonBiodegradable }
      });
    }

    // Validate non-negative values
    if (recyclable < 0 || biodegradable < 0 || nonBiodegradable < 0) {
      return res.status(400).json({
        success: false,
        message: 'Waste amounts cannot be negative.',
        received: { recyclable, biodegradable, nonBiodegradable }
      });
    }

    // Automatically use today's date (server time)
    const today = new Date();
    // Create a date string in YYYY-MM-DD format for MySQL Date field
    const todayDateString = today.getFullYear() + '-' + 
                           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(today.getDate()).padStart(2, '0');
    const todayDate = new Date(todayDateString);
    const recordedAt = new Date(); // Exact timestamp for multiple entries per day

    try {
      // Create the record with timestamp (allows multiple entries per day)
      const result = await retryOperation(async () => {
        return await prisma.waste_items.create({
          data: {
            recyclable,
            biodegradable,
            nonBiodegradable,
            date: todayDate,
            recordedAt: recordedAt
          }
        });
      });

      // Deduct coupons for ALL waste types (recyclable, wet, dry)
      const couponRate = parseInt(process.env.COUPON_CONSUMPTION_RATE || '1');
      const totalWaste = (recyclable || 0) + (biodegradable || 0) + (nonBiodegradable || 0);
      if (totalWaste > 0) {
        try {
          await consumeCoupons(result.id, totalWaste * couponRate);
          console.log(`✓ Consumed ${totalWaste * couponRate} coupons for waste record ${result.id}`.green);
        } catch (error) {
          console.warn('Could not consume coupons:', error.message);
          // Don't fail the request if coupon consumption fails
        }
      }

      // Broadcast real-time update to connected clients
      try {
        broadcastBinNotification({
          type: 'WASTE_INSERTED',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Could not broadcast update:', error.message);
      }

      // Create waste notification (for the notification system)
      try {
        await retryOperation(async () => {
          return await prisma.wasteNotification.create({
            data: {
              type: 'WASTE_INSERTED',
              wasteType: recyclable > 0 ? 'RECYCLABLE' : (biodegradable > 0 ? 'WET' : 'DRY'),
              wasteRecordId: result.id,
              quantity: recyclable + biodegradable + nonBiodegradable,
              isRead: false
            }
          });
        });
      } catch (error) {
        console.warn('Could not create notification:', error.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Waste record created successfully',
        action: 'created',
        data: {
          id: result.id,
          date: result.date,
          recordedAt: result.recordedAt,
          recyclable: result.recyclable,
          biodegradable: result.biodegradable,
          nonBiodegradable: result.nonBiodegradable,
          total: result.recyclable + result.biodegradable + result.nonBiodegradable,
          createdAt: result.createdAt
        }
      });

    } catch (createError) {
      // Handle any database errors
      console.error('Error creating waste record:', createError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create waste record',
        error: createError.message
      });
    }

  } catch (error) {
    console.error('Error adding waste record:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P1001') {
      return res.status(503).json({
        success: false,
        message: 'Database connection failed. Please try again.',
        error: 'Database unavailable'
      });
    }
    
    // Handle Prisma unique constraint violation (fallback - shouldn't reach here now)
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A waste record for today already exists. Records cannot be updated once created.',
        error: 'RECORD_ALREADY_EXISTS'
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Record not found during operation.',
        error: 'RECORD_NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating waste record',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
  // Note: Removed prisma.$disconnect() to maintain connection pool
};

// Export as default for easier importing
export default addWasteRecord;
