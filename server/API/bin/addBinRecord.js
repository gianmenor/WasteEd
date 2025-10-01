import express from 'express';
import { prisma, retryOperation } from '../../utils/database.js';
import { broadcastBinNotification } from './notifications.js';

// Route Path ( '/api/bin/full' )
const router = express.Router();

// POST /api/bin/full - Called by the machine when bin becomes full
router.post('/', async (req, res) => {
  try {
    console.log('Bin full notification received at:', new Date().toISOString());
    
    // Create a new bin record using retry operation for reliability
    const newBinRecord = await retryOperation(async () => {
      return await prisma.bin.create({
        data: {
          fullAt: new Date(),
        },
      });
    });

    console.log('Bin record created:', newBinRecord);
    
    // Broadcast real-time notification to all connected clients
    broadcastBinNotification(newBinRecord);
    
    res.status(201).json({
      success: true,
      message: 'Bin full notification recorded successfully',
      data: {
        id: newBinRecord.id,
        fullAt: newBinRecord.fullAt,
        createdAt: newBinRecord.createdAt
      }
    });

  } catch (error) {
    console.error('Error recording bin full notification:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to record bin full notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;