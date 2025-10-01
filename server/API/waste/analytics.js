import { PrismaClient } from '../../generated/prisma/index.js';

const prisma = new PrismaClient();

const analytics = async (req, res) => {
  try {
    const { range = '7d', metric = 'weight' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (range) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
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

    // Calculate trends data
    const trendsMap = new Map();
    
    records.forEach(record => {
      const date = record.date.toISOString().split('T')[0];
      
      if (!trendsMap.has(date)) {
        trendsMap.set(date, {
          date,
          weight: 0,
          volume: 0,
          count: 0,
          recyclable: 0,
          organic: 0,
          general: 0,
          hazardous: 0
        });
      }
      
      const dayData = trendsMap.get(date);
      // Use the actual waste amounts from the database
      dayData.weight += (record.recyclable + record.biodegradable + record.nonBiodegradable) || 0;
      dayData.volume += (record.recyclable + record.biodegradable + record.nonBiodegradable) * 1.2 || 0; // Estimate volume
      dayData.count += 1;
      
      // Categorize by waste type
      dayData.recyclable += record.recyclable || 0;
      dayData.organic += record.biodegradable || 0;
      dayData.general += record.nonBiodegradable || 0;
    });

    const trends = Array.from(trendsMap.values());

    // Calculate summary statistics
    const totalWeight = records.reduce((sum, record) => sum + (record.recyclable + record.biodegradable + record.nonBiodegradable || 0), 0);
    const totalVolume = totalWeight * 1.2; // Estimate volume based on weight
    const totalRecords = records.length;

    // Calculate efficiency (mock calculation based on weight vs volume ratio)
    const efficiency = totalVolume > 0 ? Math.min(95, (totalWeight / totalVolume) * 100) : 85;

    // Calculate CO2 saved (rough estimate: 1kg waste = 0.5kg CO2 saved through recycling)
    const co2Saved = totalWeight * 0.5;

    // Mock active devices count
    const activeDevices = 5;

    res.json({
      trends,
      totalWeight,
      totalVolume,
      totalRecords,
      efficiency,
      co2Saved,
      activeDevices,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      }
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics data',
      details: error.message 
    });
  }
};

export default analytics;