import { useState, useEffect, useCallback } from 'react';
import { useSettings } from './Dashboard';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = () => {
  const { settings } = useSettings();
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wasteData, setWasteData] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Fetch waste data for analytics
  const fetchWasteData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let allData = [];
      let currentPage = 1;
      let hasMoreData = true;

      // Fetch all pages of data for comprehensive analytics
      while (hasMoreData) {
        let url = 'http://localhost:3000/api/waste/records';
        const params = new URLSearchParams();
        
        params.append('pageSize', '100');
        params.append('page', currentPage.toString());
        
        const response = await fetch(url + '?' + params.toString());
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
          allData = [...allData, ...result.data];
          hasMoreData = result.meta?.pagination?.hasNextPage || false;
          currentPage++;
        } else {
          throw new Error('Invalid data format received');
        }
      }

      setWasteData(allData);
      generateAnalytics(allData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate comprehensive analytics from raw data
  const generateAnalytics = (data) => {
    if (!data.length) return;

    // Filter data by time range
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (timeRange) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        cutoffDate.setDate(now.getDate() - 30);
    }

    const filteredData = data.filter(record => 
      new Date(record.date) >= cutoffDate
    );

    // Calculate totals and averages
    const totals = filteredData.reduce((acc, record) => {
      acc.recyclable += record.recyclable || 0;
      acc.biodegradable += record.biodegradable || 0;
      acc.nonBiodegradable += record.nonBiodegradable || 0;
      acc.total += (record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0);
      return acc;
    }, { recyclable: 0, biodegradable: 0, nonBiodegradable: 0, total: 0 });

    // Generate daily trends
    const dailyTrends = generateDailyTrends(filteredData);
    
    // Generate monthly aggregation
    const monthlyData = generateMonthlyData(filteredData);
    
    // Calculate percentages
    const percentages = {
      recyclable: totals.total > 0 ? (totals.recyclable / totals.total * 100).toFixed(1) : 0,
      biodegradable: totals.total > 0 ? (totals.biodegradable / totals.total * 100).toFixed(1) : 0,
      nonBiodegradable: totals.total > 0 ? (totals.nonBiodegradable / totals.total * 100).toFixed(1) : 0
    };

    // Calculate trends vs previous period
    const prevPeriodData = data.filter(record => {
      const recordDate = new Date(record.date);
      const prevCutoff = new Date(cutoffDate);
      prevCutoff.setDate(prevCutoff.getDate() - (cutoffDate.getDate() - new Date(cutoffDate).setDate(cutoffDate.getDate() - (now.getDate() - cutoffDate.getDate()))));
      return recordDate >= prevCutoff && recordDate < cutoffDate;
    });

    const prevTotals = prevPeriodData.reduce((acc, record) => {
      acc.total += (record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0);
      return acc;
    }, { total: 0 });

    const trend = prevTotals.total > 0 ? 
      ((totals.total - prevTotals.total) / prevTotals.total * 100).toFixed(1) : 0;

    // Environmental impact calculation (rough estimates)
    const co2Saved = (totals.recyclable * 0.5 + totals.biodegradable * 0.3).toFixed(1);
    const energySaved = (totals.recyclable * 1.2).toFixed(1);

    setAnalyticsData({
      totals,
      percentages,
      trend: parseFloat(trend),
      dailyTrends,
      monthlyData,
      averageDaily: filteredData.length > 0 ? (totals.total / filteredData.length).toFixed(1) : 0,
      recordCount: filteredData.length,
      co2Saved: parseFloat(co2Saved),
      energySaved: parseFloat(energySaved),
      peakDay: findPeakDay(filteredData),
      efficiency: calculateEfficiency(filteredData)
    });
  };

  const generateDailyTrends = (data) => {
    const dailyMap = {};
    
    data.forEach(record => {
      const date = record.date;
      if (!dailyMap[date]) {
        dailyMap[date] = { date, recyclable: 0, biodegradable: 0, nonBiodegradable: 0, total: 0 };
      }
      dailyMap[date].recyclable += record.recyclable || 0;
      dailyMap[date].biodegradable += record.biodegradable || 0;
      dailyMap[date].nonBiodegradable += record.nonBiodegradable || 0;
      dailyMap[date].total += (record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0);
    });

    return Object.values(dailyMap)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30); // Last 30 days for trends
  };

  const generateMonthlyData = (data) => {
    const monthlyMap = {};
    
    data.forEach(record => {
      const date = new Date(record.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { 
          month: monthKey, 
          recyclable: 0, 
          biodegradable: 0, 
          nonBiodegradable: 0, 
          total: 0 
        };
      }
      
      monthlyMap[monthKey].recyclable += record.recyclable || 0;
      monthlyMap[monthKey].biodegradable += record.biodegradable || 0;
      monthlyMap[monthKey].nonBiodegradable += record.nonBiodegradable || 0;
      monthlyMap[monthKey].total += (record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0);
    });

    return Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
  };

  const findPeakDay = (data) => {
    if (!data.length) return null;
    
    return data.reduce((peak, current) => {
      const currentTotal = (current.recyclable || 0) + (current.biodegradable || 0) + (current.nonBiodegradable || 0);
      const peakTotal = (peak.recyclable || 0) + (peak.biodegradable || 0) + (peak.nonBiodegradable || 0);
      return currentTotal > peakTotal ? current : peak;
    });
  };

  const calculateEfficiency = (data) => {
    if (!data.length) return 0;
    
    // Simple efficiency calculation based on recycling rate
    const totals = data.reduce((acc, record) => {
      acc.recyclable += record.recyclable || 0;
      acc.total += (record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0);
      return acc;
    }, { recyclable: 0, total: 0 });
    
    return totals.total > 0 ? (totals.recyclable / totals.total * 100).toFixed(1) : 0;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatMonth = (monthString) => {
    const [year, month] = monthString.split('-');
    return new Date(year, month - 1).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    });
  };

  useEffect(() => {
    fetchWasteData();
  }, [fetchWasteData]);

  useEffect(() => {
    if (wasteData.length > 0) {
      generateAnalytics(wasteData);
    }
  }, [timeRange, wasteData]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-error">
        <div className="error-icon">⚠️</div>
        <h3>Failed to Load Analytics</h3>
        <p>{error}</p>
        <button onClick={fetchWasteData} className="retry-button">
          🔄 Retry
        </button>
      </div>
    );
  }

  const themeClass = settings?.darkMode ? 'dark-theme' : 'light-theme';

  return (
    <div className={`analytics-dashboard ${themeClass}`}>
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">
            <span className="title-icon">📊</span>
            Analytics Dashboard
          </h1>
          <p className="dashboard-subtitle">
            Comprehensive waste management insights and trends
          </p>
        </div>
        
        <div className="header-controls">
          <div className="time-range-selector">
            <label htmlFor="timeRange">📅 Period:</label>
            <select
              id="timeRange"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="time-select"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
          
          <button onClick={fetchWasteData} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>

      {analyticsData && (
        <>
          {/* Key Metrics */}
          <div className="metrics-grid">
            <div className="metric-card total">
              <div className="metric-header">
                <span className="metric-icon">📊</span>
                <span className="metric-trend positive">
                  {analyticsData.trend >= 0 ? '📈' : '📉'} {Math.abs(analyticsData.trend)}%
                </span>
              </div>
              <div className="metric-value">{analyticsData.totals.total.toLocaleString()}</div>
              <div className="metric-label">Total Items Collected</div>
              <div className="metric-subtitle">Avg {analyticsData.averageDaily}/day</div>
            </div>

            <div className="metric-card recyclable">
              <div className="metric-header">
                <span className="metric-icon">♻️</span>
                <span className="metric-percentage">{analyticsData.percentages.recyclable}%</span>
              </div>
              <div className="metric-value">{analyticsData.totals.recyclable.toLocaleString()}</div>
              <div className="metric-label">Recyclable Items</div>
              <div className="metric-subtitle">Most sustainable</div>
            </div>

            <div className="metric-card biodegradable">
              <div className="metric-header">
                <span className="metric-icon">🍃</span>
                <span className="metric-percentage">{analyticsData.percentages.biodegradable}%</span>
              </div>
              <div className="metric-value">{analyticsData.totals.biodegradable.toLocaleString()}</div>
              <div className="metric-label">Biodegradable Items</div>
              <div className="metric-subtitle">Compostable waste</div>
            </div>

            <div className="metric-card efficiency">
              <div className="metric-header">
                <span className="metric-icon">🎯</span>
                <span className="metric-status good">Good</span>
              </div>
              <div className="metric-value">{analyticsData.efficiency}%</div>
              <div className="metric-label">Recycling Efficiency</div>
              <div className="metric-subtitle">Target: 60%+</div>
            </div>

            <div className="metric-card environmental">
              <div className="metric-header">
                <span className="metric-icon">🌱</span>
                <span className="metric-badge">Impact</span>
              </div>
              <div className="metric-value">{analyticsData.co2Saved}kg</div>
              <div className="metric-label">CO₂ Saved</div>
              <div className="metric-subtitle">Environmental benefit</div>
            </div>

            <div className="metric-card energy">
              <div className="metric-header">
                <span className="metric-icon">⚡</span>
                <span className="metric-badge">Saved</span>
              </div>
              <div className="metric-value">{analyticsData.energySaved}kWh</div>
              <div className="metric-label">Energy Saved</div>
              <div className="metric-subtitle">Through recycling</div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-section">
            {/* Daily Trends Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">📈 Daily Collection Trends</h3>
                <div className="chart-legend">
                  <span className="legend-item recyclable">♻️ Recyclable</span>
                  <span className="legend-item biodegradable">🍃 Biodegradable</span>
                  <span className="legend-item non-biodegradable">🗑️ Non-Biodegradable</span>
                </div>
              </div>
              <div className="chart-container">
                <div className="trend-chart">
                  {analyticsData.dailyTrends.map((day, index) => (
                    <div key={index} className="chart-day">
                      <div className="chart-bars">
                        <div 
                          className="chart-bar recyclable" 
                          style={{ height: `${Math.max((day.recyclable / Math.max(...analyticsData.dailyTrends.map(d => d.total))) * 100, 2)}%` }}
                          title={`Recyclable: ${day.recyclable}`}
                        ></div>
                        <div 
                          className="chart-bar biodegradable" 
                          style={{ height: `${Math.max((day.biodegradable / Math.max(...analyticsData.dailyTrends.map(d => d.total))) * 100, 2)}%` }}
                          title={`Biodegradable: ${day.biodegradable}`}
                        ></div>
                        <div 
                          className="chart-bar non-biodegradable" 
                          style={{ height: `${Math.max((day.nonBiodegradable / Math.max(...analyticsData.dailyTrends.map(d => d.total))) * 100, 2)}%` }}
                          title={`Non-Biodegradable: ${day.nonBiodegradable}`}
                        ></div>
                      </div>
                      <div className="chart-label">{formatDate(day.date)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Monthly Overview */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">📅 Monthly Overview</h3>
              </div>
              <div className="chart-container">
                <div className="monthly-chart">
                  {analyticsData.monthlyData.map((month, index) => (
                    <div key={index} className="month-item">
                      <div className="month-bar">
                        <div 
                          className="month-fill" 
                          style={{ width: `${Math.max((month.total / Math.max(...analyticsData.monthlyData.map(m => m.total))) * 100, 5)}%` }}
                        ></div>
                      </div>
                      <div className="month-info">
                        <div className="month-label">{formatMonth(month.month)}</div>
                        <div className="month-value">{month.total.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Insights Section */}
          <div className="insights-section">
            <div className="insights-grid">
              <div className="insight-card">
                <h3 className="insight-title">📊 Key Insights</h3>
                <div className="insight-list">
                  <div className="insight-item">
                    <span className="insight-icon">🏆</span>
                    <span>Peak collection day: {analyticsData.peakDay ? formatDate(analyticsData.peakDay.date) : 'N/A'}</span>
                  </div>
                  <div className="insight-item">
                    <span className="insight-icon">📈</span>
                    <span>Recycling rate: {analyticsData.percentages.recyclable}% of total waste</span>
                  </div>
                  <div className="insight-item">
                    <span className="insight-icon">🎯</span>
                    <span>Efficiency rating: {analyticsData.efficiency >= 60 ? 'Excellent' : analyticsData.efficiency >= 40 ? 'Good' : 'Needs Improvement'}</span>
                  </div>
                  <div className="insight-item">
                    <span className="insight-icon">🌍</span>
                    <span>Environmental impact: {analyticsData.co2Saved}kg CO₂ saved</span>
                  </div>
                </div>
              </div>

              <div className="insight-card">
                <h3 className="insight-title">💡 Recommendations</h3>
                <div className="recommendation-list">
                  {analyticsData.percentages.recyclable < 50 && (
                    <div className="recommendation-item">
                      <span className="rec-icon">♻️</span>
                      <span>Increase recycling efforts - currently at {analyticsData.percentages.recyclable}%</span>
                    </div>
                  )}
                  {analyticsData.percentages.nonBiodegradable > 30 && (
                    <div className="recommendation-item">
                      <span className="rec-icon">🗑️</span>
                      <span>Reduce non-biodegradable waste - currently {analyticsData.percentages.nonBiodegradable}%</span>
                    </div>
                  )}
                  <div className="recommendation-item">
                    <span className="rec-icon">📅</span>
                    <span>Best collection frequency: Every {Math.ceil(analyticsData.averageDaily / 10)} days</span>
                  </div>
                  <div className="recommendation-item">
                    <span className="rec-icon">🎯</span>
                    <span>Target: Maintain {analyticsData.efficiency}% efficiency rate</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;