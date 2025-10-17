import { prisma, retryOperation } from '../../utils/database.js';

// POST /api/waste/delete-today
// Deletes today's waste record(s) based on the date field matching today's date (server time)
export default async function deleteToday(req, res) {
  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayDate = new Date(todayStr); // normalized to midnight

    const result = await retryOperation(async () => {
      return await prisma.waste_items.deleteMany({
        where: { date: todayDate },
      });
    });

    return res.status(200).json({
      success: true,
      message: `Deleted ${result.count} record(s) for today`,
      data: { deletedCount: result.count, date: todayStr },
    });
  } catch (error) {
    console.error('Error deleting today\'s waste records:', error);

    if (error.code === 'P1001') {
      return res.status(503).json({
        success: false,
        message: 'Database connection failed. Please try again.',
        error: 'Database unavailable',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error while deleting today\'s waste records',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
    });
  }
}
