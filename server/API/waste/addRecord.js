import { prisma, retryOperation } from '../../utils/database.js';

// POST /api/waste/add
// Expected body: { recyclable: number, biodegradable: number, nonBiodegradable: number }
// Date is automatically set to today's date on the server
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

    try {
      // Try to create the record directly with retry logic
      const result = await retryOperation(async () => {
        return await prisma.waste_items.create({
          data: {
            recyclable,
            biodegradable,
            nonBiodegradable,
            date: todayDate
          }
        });
      });

      return res.status(201).json({
        success: true,
        message: 'Daily waste record created successfully',
        action: 'created',
        data: {
          id: result.id,
          date: result.date,
          recyclable: result.recyclable,
          biodegradable: result.biodegradable,
          nonBiodegradable: result.nonBiodegradable,
          total: result.recyclable + result.biodegradable + result.nonBiodegradable,
          createdAt: result.createdAt
        }
      });

    } catch (createError) {
      // If we get unique constraint violation, fetch the existing record and return 409
      if (createError.code === 'P2002') {
        try {
          const existingRecord = await retryOperation(async () => {
            return await prisma.waste_items.findUnique({
              where: { date: todayDate }
            });
          });

          return res.status(409).json({
            success: false,
            message: 'A waste record for today already exists. Records cannot be updated once created.',
            error: 'RECORD_ALREADY_EXISTS',
            existingRecord: existingRecord ? {
              id: existingRecord.id,
              date: existingRecord.date,
              recyclable: existingRecord.recyclable,
              biodegradable: existingRecord.biodegradable,
              nonBiodegradable: existingRecord.nonBiodegradable,
              total: existingRecord.recyclable + existingRecord.biodegradable + existingRecord.nonBiodegradable,
              createdAt: existingRecord.createdAt
            } : null
          });
        } catch (findError) {
          // If we can't find the existing record, just return conflict without details
          return res.status(409).json({
            success: false,
            message: 'A waste record for today already exists. Records cannot be updated once created.',
            error: 'RECORD_ALREADY_EXISTS'
          });
        }
      }
      
      // Re-throw other errors to be handled by main catch block
      throw createError;
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
