import { prisma } from '../../utils/database.js';

const analytics = async (req, res) => {
  try {
    const { period = 'monthly', metric = 'weight' } = req.query;
    
    // Calculate date range and grouping based on period
    const now = new Date();
    let startDate = new Date();
    let groupBy = 'day'; // default grouping
    
    switch (period) {
      case 'daily':
        startDate.setDate(now.getDate() - 30); // Last 30 days for daily view
        groupBy = 'day';
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 12); // Last 12 months for monthly view
        groupBy = 'month';
        break;
      case 'yearly':
        startDate.setFullYear(now.getFullYear() - 5); // Last 5 years for yearly view
        groupBy = 'year';
        break;
      default:
        startDate.setMonth(now.getMonth() - 12);
        groupBy = 'month';
    }

    // Get waste records within date range
    const records = await prisma.waste_items.findMany({
      where: {
        date: {
          gte: startDate,
          lte: now
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Calculate trends data based on groupBy period
    const trendsMap = new Map();
    
    const getGroupKey = (date, groupBy) => {
      switch (groupBy) {
        case 'day':
          return date.toISOString().split('T')[0]; // YYYY-MM-DD
        case 'month':
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        case 'year':
          return date.getFullYear().toString(); // YYYY
        default:
          return date.toISOString().split('T')[0];
      }
    };
    
    records.forEach(record => {
      const groupKey = getGroupKey(record.date, groupBy);
      
      if (!trendsMap.has(groupKey)) {
        trendsMap.set(groupKey, {
          date: groupKey,
          weight: 0,
          volume: 0,
          count: 0,
          recyclable: 0,
          organic: 0,
          general: 0,
          hazardous: 0
        });
      }
      
      const periodData = trendsMap.get(groupKey);
      // Use the actual waste amounts from the database
      periodData.weight += (record.recyclable + record.biodegradable + record.nonBiodegradable) || 0;
      periodData.volume += (record.recyclable + record.biodegradable + record.nonBiodegradable) * 1.2 || 0; // Estimate volume
      periodData.count += 1;
      
      // Categorize by waste type
      periodData.recyclable += record.recyclable || 0;
      periodData.organic += record.biodegradable || 0;
      periodData.general += record.nonBiodegradable || 0;
    });

    const trends = Array.from(trendsMap.values());

    // Calculate summary statistics in a single pass for efficiency
    let totalRecords = records.length;
    let totalRecyclable = 0;
    let totalBiodegradable = 0;
    let totalNonBiodegradable = 0;

    records.forEach(record => {
      totalRecyclable += record.recyclable || 0;
      totalBiodegradable += record.biodegradable || 0;
      totalNonBiodegradable += record.nonBiodegradable || 0;
    });

    const totalItems = totalRecyclable + totalBiodegradable + totalNonBiodegradable;

    // Calculate percentages based on items, not records
    const recyclablePercentage = totalItems > 0 ? ((totalRecyclable / totalItems) * 100).toFixed(1) : 0;
    const biodegradablePercentage = totalItems > 0 ? ((totalBiodegradable / totalItems) * 100).toFixed(1) : 0;
    const nonBiodegradablePercentage = totalItems > 0 ? ((totalNonBiodegradable / totalItems) * 100).toFixed(1) : 0;
    
    // Calculate efficiency as recyclable percentage
    const efficiency = recyclablePercentage;

    res.json({
      success: true,
      data: {
        totalRecords,
        totalItems,
        recyclableCount: totalRecyclable,
        biodegradableCount: totalBiodegradable,
        nonBiodegradableCount: totalNonBiodegradable,
        recyclablePercentage,
        biodegradablePercentage,
        nonBiodegradablePercentage,
        efficiency,
        dailyTrends: trends,
        monthlyData: generateMonthlyData(trends),
        peakDay: findPeakDay(trends),
        trends: {
          total: totalRecords > 0 ? 12.5 : 0 // Mock trend
        }
      }
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch analytics data',
      message: error.message 
    });
  }
};

// Helper function to generate monthly data
const generateMonthlyData = (dailyTrends) => {
  const monthlyMap = new Map();
  
  dailyTrends.forEach(day => {
    const month = day.date.substring(0, 7); // YYYY-MM
    
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        label: new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        total: 0,
        recyclable: 0,
        biodegradable: 0,
        nonBiodegradable: 0
      });
    }
    
    const monthData = monthlyMap.get(month);
    monthData.total += day.count;
    monthData.recyclable += day.recyclable;
    monthData.biodegradable += day.organic;
    monthData.nonBiodegradable += day.general;
  });
  
  return Array.from(monthlyMap.values()).slice(-6); // Last 6 months
};

// Helper function to find peak day
const findPeakDay = (dailyTrends) => {
  if (!dailyTrends.length) return null;
  
  const peak = dailyTrends.reduce((max, day) => 
    day.count > max.count ? day : max, dailyTrends[0]
  );
  
  return peak.date;
};

export default analytics;