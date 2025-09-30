import { PrismaClient } from '../../generated/prisma/index.js';

const prisma = new PrismaClient();

// GET /api/waste/records
// Optimized for TanStack React Table with pagination, search, and filters
// Query parameters: 
// - page=1 (page number, 1-based)
// - pageSize=10 (items per page, max 100)
// - search="" (global search across all fields)
// - sortBy=date (field to sort by: date, recyclable, biodegradable, nonBiodegradable, total)
// - sortOrder=desc (asc or desc)
// - dateFrom=YYYY-MM-DD (filter from date)
// - dateTo=YYYY-MM-DD (filter to date)
// - minTotal=0 (minimum daily total filter)
// - maxTotal=1000 (maximum daily total filter)
// - minRecyclable, maxRecyclable, minBiodegradable, maxBiodegradable, minNonBiodegradable, maxNonBiodegradable
const getWasteRecords = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      search = '',
      sortBy = 'date',
      sortOrder = 'desc',
      dateFrom,
      dateTo,
      minTotal,
      maxTotal,
      minRecyclable,
      maxRecyclable,
      minBiodegradable,
      maxBiodegradable,
      minNonBiodegradable,
      maxNonBiodegradable
    } = req.query;

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);

    if (pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be 1 or greater.',
        received: pageNum
      });
    }

    if (pageSizeNum < 1 || pageSizeNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Page size must be between 1 and 100.',
        received: pageSizeNum
      });
    }

    // Validate sort parameters
    const validSortFields = ['date', 'recyclable', 'biodegradable', 'nonBiodegradable', 'total', 'createdAt', 'updatedAt'];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`,
        received: sortBy
      });
    }

    const validSortOrders = ['asc', 'desc'];
    if (!validSortOrders.includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sortOrder. Must be "asc" or "desc".',
        received: sortOrder
      });
    }

    // Build where clause for filtering
    let whereClause = {};

    // Date range filtering
    if (dateFrom || dateTo) {
      whereClause.date = {};
      
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (isNaN(fromDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid dateFrom format. Please use YYYY-MM-DD format.',
            received: dateFrom
          });
        }
        fromDate.setHours(0, 0, 0, 0);
        whereClause.date.gte = fromDate;
      }
      
      if (dateTo) {
        const toDate = new Date(dateTo);
        if (isNaN(toDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid dateTo format. Please use YYYY-MM-DD format.',
            received: dateTo
          });
        }
        toDate.setHours(23, 59, 59, 999);
        whereClause.date.lte = toDate;
      }
    }

    // Numeric range filters
    const numericFilters = [
      { param: minRecyclable, field: 'recyclable', type: 'gte' },
      { param: maxRecyclable, field: 'recyclable', type: 'lte' },
      { param: minBiodegradable, field: 'biodegradable', type: 'gte' },
      { param: maxBiodegradable, field: 'biodegradable', type: 'lte' },
      { param: minNonBiodegradable, field: 'nonBiodegradable', type: 'gte' },
      { param: maxNonBiodegradable, field: 'nonBiodegradable', type: 'lte' }
    ];

    numericFilters.forEach(({ param, field, type }) => {
      if (param !== undefined) {
        const value = parseInt(param);
        if (!isNaN(value) && value >= 0) {
          if (!whereClause[field]) whereClause[field] = {};
          whereClause[field][type] = value;
        }
      }
    });

    // Build query options
    let queryOptions = {
      where: whereClause,
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum
    };

    // Handle sorting (special case for 'total' which is calculated)
    if (sortBy === 'total') {
      // For total sorting, we'll sort by the sum of all three fields
      queryOptions.orderBy = [
        { recyclable: sortOrder },
        { biodegradable: sortOrder },
        { nonBiodegradable: sortOrder }
      ];
    } else {
      queryOptions.orderBy = { [sortBy]: sortOrder };
    }

    // Get records and total count
    const [allRecords, totalCount] = await Promise.all([
      prisma.waste_items.findMany(queryOptions),
      prisma.waste_items.count({ where: whereClause })
    ]);

    // Apply search filter if provided (post-database filter for flexibility)
    let filteredRecords = allRecords;
    if (search.trim()) {
      const searchTerm = search.toLowerCase();
      filteredRecords = allRecords.filter(record => {
        const total = record.recyclable + record.biodegradable + record.nonBiodegradable;
        const dateStr = record.date.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        return (
          dateStr.includes(searchTerm) ||
          record.recyclable.toString().includes(searchTerm) ||
          record.biodegradable.toString().includes(searchTerm) ||
          record.nonBiodegradable.toString().includes(searchTerm) ||
          total.toString().includes(searchTerm)
        );
      });
    }

    // Apply total range filters (post-database filter)
    if (minTotal !== undefined || maxTotal !== undefined) {
      filteredRecords = filteredRecords.filter(record => {
        const total = record.recyclable + record.biodegradable + record.nonBiodegradable;
        const minTotalNum = minTotal ? parseInt(minTotal) : 0;
        const maxTotalNum = maxTotal ? parseInt(maxTotal) : Infinity;
        return total >= minTotalNum && total <= maxTotalNum;
      });
    }

    // Sort by total if needed (since we did post-filter)
    if (sortBy === 'total') {
      filteredRecords.sort((a, b) => {
        const totalA = a.recyclable + a.biodegradable + a.nonBiodegradable;
        const totalB = b.recyclable + b.biodegradable + b.nonBiodegradable;
        return sortOrder === 'desc' ? totalB - totalA : totalA - totalB;
      });
    }

    // Calculate statistics for the filtered results
    const statistics = filteredRecords.reduce((stats, record) => {
      const total = record.recyclable + record.biodegradable + record.nonBiodegradable;
      stats.totalRecyclable += record.recyclable;
      stats.totalBiodegradable += record.biodegradable;
      stats.totalNonBiodegradable += record.nonBiodegradable;
      stats.grandTotal += total;
      stats.maxDaily = Math.max(stats.maxDaily, total);
      stats.minDaily = Math.min(stats.minDaily, total);
      return stats;
    }, {
      totalRecyclable: 0,
      totalBiodegradable: 0,
      totalNonBiodegradable: 0,
      grandTotal: 0,
      maxDaily: 0,
      minDaily: Infinity
    });

    if (filteredRecords.length === 0) {
      statistics.minDaily = 0;
    }

    // Format response data for TanStack Table
    const formattedRecords = filteredRecords.map(record => ({
      id: record.id,
      date: record.date.toISOString().split('T')[0], // YYYY-MM-DD format for frontend
      recyclable: record.recyclable,
      biodegradable: record.biodegradable,
      nonBiodegradable: record.nonBiodegradable,
      total: record.recyclable + record.biodegradable + record.nonBiodegradable,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSizeNum);
    const hasNextPage = pageNum < totalPages;
    const hasPreviousPage = pageNum > 1;

    return res.status(200).json({
      success: true,
      message: `Retrieved ${filteredRecords.length} waste record(s)`,
      data: formattedRecords,
      meta: {
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total: totalCount,
          totalPages,
          hasNextPage,
          hasPreviousPage,
          startIndex: (pageNum - 1) * pageSizeNum + 1,
          endIndex: Math.min(pageNum * pageSizeNum, totalCount)
        },
        statistics: {
          ...statistics,
          averagePerDay: filteredRecords.length > 0 ? Math.round(statistics.grandTotal / filteredRecords.length) : 0,
          recordCount: filteredRecords.length
        },
        filters: {
          search: search || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          sortBy,
          sortOrder,
          appliedFilters: Object.keys(req.query).filter(key => 
            !['page', 'pageSize', 'sortBy', 'sortOrder'].includes(key) && req.query[key]
          )
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving waste records:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving waste records',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  } finally {
    await prisma.$disconnect();
  }
};

// GET /api/waste/records/:id
// Get a single waste record by ID
const getWasteRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const recordId = parseInt(id);

    if (isNaN(recordId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid record ID. Must be a number.',
        received: id
      });
    }

    const record = await prisma.waste_items.findUnique({
      where: { id: recordId }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Waste record not found',
        id: recordId
      });
    }

    const formattedRecord = {
      id: record.id,
      date: record.date,
      recyclable: record.recyclable,
      biodegradable: record.biodegradable,
      nonBiodegradable: record.nonBiodegradable,
      dailyTotal: record.recyclable + record.biodegradable + record.nonBiodegradable,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };

    return res.status(200).json({
      success: true,
      message: 'Waste record retrieved successfully',
      data: formattedRecord
    });

  } catch (error) {
    console.error('Error retrieving waste record:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving waste record',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  } finally {
    await prisma.$disconnect();
  }
};

// GET /api/waste/summary
// Get summary statistics for all waste records
const getWasteSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let whereClause = {};
    
    // Handle date range
    if (startDate || endDate) {
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid startDate format. Please use YYYY-MM-DD format.',
            received: startDate
          });
        }
        start.setHours(0, 0, 0, 0);
        whereClause.date = { ...whereClause.date, gte: start };
      }
      
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid endDate format. Please use YYYY-MM-DD format.',
            received: endDate
          });
        }
        end.setHours(23, 59, 59, 999);
        whereClause.date = { ...whereClause.date, lte: end };
      }
    }

    const [records, totalRecords] = await Promise.all([
      prisma.waste_items.findMany({
        where: whereClause,
        orderBy: { date: 'desc' }
      }),
      prisma.waste_items.count({ where: whereClause })
    ]);

    const summary = records.reduce((acc, record) => {
      acc.totalRecyclable += record.recyclable;
      acc.totalBiodegradable += record.biodegradable;
      acc.totalNonBiodegradable += record.nonBiodegradable;
      return acc;
    }, {
      totalRecyclable: 0,
      totalBiodegradable: 0,
      totalNonBiodegradable: 0
    });

    const grandTotal = summary.totalRecyclable + summary.totalBiodegradable + summary.totalNonBiodegradable;

    return res.status(200).json({
      success: true,
      message: 'Waste summary retrieved successfully',
      data: {
        summary: {
          ...summary,
          grandTotal,
          averagePerDay: totalRecords > 0 ? Math.round(grandTotal / totalRecords) : 0
        },
        period: {
          totalDays: totalRecords,
          startDate: startDate || null,
          endDate: endDate || null
        },
        lastUpdated: records.length > 0 ? records[0].updatedAt : null
      }
    });

  } catch (error) {
    console.error('Error retrieving waste summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving waste summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  } finally {
    await prisma.$disconnect();
  }
};

// Export functions
export { getWasteRecords as default, getWasteRecordById, getWasteSummary };
