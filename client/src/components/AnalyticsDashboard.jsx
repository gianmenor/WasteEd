import { useState, useEffect, useCallback } from 'react';
import { useSettings } from './Dashboard';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = () => {
  const { settings } = useSettings();
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wasteData, setWasteData] = useState([]);
  const [binData, setBinData] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [binAnalytics, setBinAnalytics] = useState(null); // derived analytics for bin events

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
      generateWasteAnalytics(allData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch bin records data (pagination loop)
  const fetchBinData = useCallback(async () => {
    try {
      let allRecords = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({ page: page.toString(), limit: '100', sortBy: 'fullAt', sortOrder: 'asc' });
        const res = await fetch(`http://localhost:3000/api/bin/records?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch bin records: ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error('Invalid bin records response');
        const records = json.data?.records || [];
        allRecords = [...allRecords, ...records];
        const pagination = json.data?.pagination;
        hasMore = pagination?.hasNext || pagination?.hasNextPage || false;
        page++;
      }
      setBinData(allRecords);
      generateBinAnalytics(allRecords);
    } catch (e) {
      console.error('Error fetching bin records:', e);
    }
  }, []);

  // Generate comprehensive waste analytics from raw data
  const generateWasteAnalytics = (data) => {
    if (!data.length) return;

    // Filter data by time range
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (period) {
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
      case 'all':
        cutoffDate.setTime(0); // include everything
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

    const averageDaily = filteredData.length > 0 ? (totals.total / filteredData.length).toFixed(1) : 0;
    const monthlyAverage = monthlyData.length > 0 ? (totals.total / monthlyData.length).toFixed(1) : 0;
    setAnalyticsData({
      totals,
      percentages,
      trend: parseFloat(trend),
      dailyTrends,
      monthlyData,
      averageDaily,
      monthlyAverage,
      recordCount: filteredData.length,
      peakDay: findPeakDay(filteredData)
    });
  };

  // Derive bin analytics (daily & monthly counts) respecting period
  const generateBinAnalytics = (records) => {
    if (!records.length) return;
    const now = new Date();
    const cutoff = new Date();
    switch (period) {
      case '7d': cutoff.setDate(now.getDate() - 7); break;
      case '30d': cutoff.setDate(now.getDate() - 30); break;
      case '90d': cutoff.setDate(now.getDate() - 90); break;
      case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
      case 'all': cutoff.setTime(0); break;
      default: cutoff.setDate(now.getDate() - 30);
    }
    const filtered = records.filter(r => new Date(r.fullAt) >= cutoff);
    // Build continuous day range for selected period (default cap 120 days for performance)
    const dayRangeLimit = period === '1y' || period === 'all' ? 365 : 120;
    const dayStart = new Date(Math.max(cutoff.getTime(), now.getTime() - dayRangeLimit * 86400000));
    const dayMap = new Map();
    for (let d = new Date(dayStart); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      dayMap.set(key, 0);
    }
    filtered.forEach(r => {
      const key = new Date(r.fullAt).toISOString().split('T')[0];
      if (dayMap.has(key)) dayMap.set(key, dayMap.get(key) + 1);
    });
    const dailyTrends = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // monthly
    const monthlyMap = new Map();
    filtered.forEach(r => {
      const d = new Date(r.fullAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
    });
    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
    const dailyAverage = dailyTrends.length > 0 ? (filtered.length / dailyTrends.length).toFixed(2) : 0;
    const monthlyAverage = monthlyData.length > 0 ? (filtered.length / monthlyData.length).toFixed(2) : 0;
    setBinAnalytics({ total: filtered.length, dailyTrends, monthlyData, dailyAverage, monthlyAverage });
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
    fetchBinData();
  }, [fetchWasteData, fetchBinData]);

  useEffect(() => {
    if (wasteData.length > 0) generateWasteAnalytics(wasteData);
    if (binData.length > 0) generateBinAnalytics(binData);
  }, [period, wasteData, binData]);

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
      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-header">
          <h1 className="analytics-title">
            <span className="title-icon">📊</span>
            Analytics Dashboard
          </h1>
        </div>
        
        <div className="filters-controls">
          <div className="filters-left">
            <div className="filter-group">
              <label className="filter-label" htmlFor="timeRange">Time Period</label>
              <select
                id="timeRange"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="filter-select"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
          
          <div className="filters-right">
            <button onClick={() => { fetchWasteData(); fetchBinData(); }} className="refresh-button">
              🔄 Refresh Data
            </button>
          </div>
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

            {/* Bin Records Metric */}
            <div className="metric-card bin-records">
              <div className="metric-header">
                <span className="metric-icon">🗑️</span>
                <span className="metric-status">Records</span>
              </div>
              <div className="metric-value">{binAnalytics ? binAnalytics.total : binData.length}</div>
              <div className="metric-label">Bin Full Events</div>
              <div className="metric-subtitle">In selected period</div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-container">
            <div className="chart-grid">
              {/* Daily Waste Chart - Top Left */}
              <div className="chart-wrapper daily-waste">
                <h3>Daily Waste Items <span className="chart-meta">(Avg {analyticsData.averageDaily}/day)</span></h3>
                <div className="stacked-chart">
                  <div className="chart-container">
                    {analyticsData.dailyTrends.length > 0 ? (
                      analyticsData.dailyTrends.map((item, i) => {
                        const recyclablePercent = ((item.recyclable || 0) / (item.total || 1)) * 100;
                        const biodegradablePercent = ((item.biodegradable || 0) / (item.total || 1)) * 100;
                        const nonBiodegradablePercent = ((item.nonBiodegradable || 0) / (item.total || 1)) * 100;
                        const maxValue = Math.max(...analyticsData.dailyTrends.map(d => d.total || 1));
                        const height = ((item.total || 0) / maxValue) * 100;

                        return (
                          <div key={i} className="chart-bar" style={{ height: `${height}%` }}>
                            <div className="bar-segment recyclable" style={{ height: `${recyclablePercent}%` }}></div>
                            <div className="bar-segment biodegradable" style={{ height: `${biodegradablePercent}%` }}></div>
                            <div className="bar-segment non-biodegradable" style={{ height: `${nonBiodegradablePercent}%` }}></div>
                            <div className="bar-label">{formatDate(item.date)}</div>
                            <div className="bar-total">{item.total || 0}</div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="no-data">No data available</div>
                    )}
                  </div>
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-color recyclable"></span>
                      <span>Recyclable</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color biodegradable"></span>
                      <span>Biodegradable</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color non-biodegradable"></span>
                      <span>Non-biodegradable</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Waste Chart - Top Right */}
              <div className="chart-wrapper monthly-waste">
                <h3>Monthly Waste <span className="chart-meta">(Avg {analyticsData.monthlyAverage}/mo)</span></h3>
                <div className="horizontal-line-graph" style={{ '--line-color': '#10b981' }}>
                  {analyticsData.monthlyData.length > 0 ? (
                    <div className="chart-area">
                      <div className="y-labels">
                        {[...analyticsData.monthlyData].reverse().map((item, i) => (
                          <span key={i}>{item.month}</span>
                        ))}
                      </div>
                      <div className="horizontal-bars">
                        {(() => {
                          const maxValue = Math.max(...analyticsData.monthlyData.map(d => d.total || 1));
                          return [...analyticsData.monthlyData].reverse().map((item, i) => {
                            const width = ((item.total || 0) / maxValue) * 100;
                            return (
                              <div key={i} className="horizontal-bar">
                                <div 
                                  className="bar-line" 
                                  style={{ width: `${width}%` }}
                                >
                                  <div className="bar-value">{item.total || 0}</div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="no-data">No data available</div>
                  )}
                </div>
              </div>

              {/* Daily Bin Events - Bottom Left */}
              <div className="chart-wrapper daily-bin">
                <h3>Daily Bin Events {binAnalytics && <span className="chart-meta">(Avg {binAnalytics.dailyAverage}/day)</span>}</h3>
                <div className="line-graph" style={{ '--bar-color': '#3b82f6' }}>
                  {binAnalytics && binAnalytics.dailyTrends.length > 0 ? (
                    <>
                      <div className="grid-lines">
                        {[0, 1, 2, 3, 4].map((_, i) => <span key={i}></span>)}
                      </div>
                      <div className="y-axis-labels">
                        {(() => {
                          const maxValue = Math.max(...binAnalytics.dailyTrends.map(d => d.count || 1));
                          const yLabels = [maxValue, Math.floor(maxValue * 0.75), Math.floor(maxValue * 0.5), Math.floor(maxValue * 0.25), 0];
                          return yLabels.map((val, i) => <span key={i}>{val}</span>);
                        })()}
                      </div>
                      <div className="bars">
                        {binAnalytics.dailyTrends.map((item, i) => {
                          const maxValue = Math.max(...binAnalytics.dailyTrends.map(d => d.count || 1));
                          const height = ((item.count || 0) / maxValue) * 100;
                          return (
                            <div
                              key={i}
                              className="bar"
                              style={{ height: `${height}%` }}
                            >
                              <div className="bar-value">{item.count || 0}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="bar-labels">
                        {binAnalytics.dailyTrends.map((item, i) => (
                          <span key={i}>{formatDate(item.date)}</span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="no-data">No bin data available</div>
                  )}
                </div>
              </div>

              {/* Monthly Bin Events - Bottom Right */}
              <div className="chart-wrapper monthly-bin">
                <h3>Monthly Bin Events {binAnalytics && <span className="chart-meta">(Avg {binAnalytics.monthlyAverage}/mo)</span>}</h3>
                <div className="horizontal-line-graph" style={{ '--line-color': '#3b82f6' }}>
                  {binAnalytics && binAnalytics.monthlyData.length > 0 ? (
                    <div className="chart-area">
                      <div className="y-labels">
                        {[...binAnalytics.monthlyData].reverse().map((item, i) => (
                          <span key={i}>{item.month}</span>
                        ))}
                      </div>
                      <div className="horizontal-bars">
                        {(() => {
                          const maxValue = Math.max(...binAnalytics.monthlyData.map(d => d.count || 1));
                          return [...binAnalytics.monthlyData].reverse().map((item, i) => {
                            const width = ((item.count || 0) / maxValue) * 100;
                            return (
                              <div key={i} className="horizontal-bar">
                                <div 
                                  className="bar-line" 
                                  style={{ width: `${width}%` }}
                                >
                                  <div className="bar-value">{item.count || 0}</div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="no-data">No bin data available</div>
                  )}
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
                  {binAnalytics && (
                    <div className="insight-item">
                      <span className="insight-icon">🗑️</span>
                      <span>Bin events this period: {binAnalytics.total}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="insight-card">
                <h3 className="insight-title">� Activity Analytics</h3>
                <div className="recommendation-list">
                  <div className="recommendation-item">
                    <span className="rec-icon">🏆</span>
                    <span>Most active day: {(() => {
                      if (!analyticsData.dailyTrends.length) return 'No data';
                      const mostActive = analyticsData.dailyTrends.reduce((max, day) => 
                        (day.total || 0) > (max.total || 0) ? day : max
                      );
                      return `${formatDate(mostActive.date)} (${mostActive.total} items)`;
                    })()}</span>
                  </div>
                  <div className="recommendation-item">
                    <span className="rec-icon">📅</span>
                    <span>Most active month: {(() => {
                      if (!analyticsData.monthlyData.length) return 'No data';
                      const mostActive = analyticsData.monthlyData.reduce((max, month) => 
                        (month.total || 0) > (max.total || 0) ? month : max
                      );
                      return `${mostActive.month} (${mostActive.total} items)`;
                    })()}</span>
                  </div>
                  {binAnalytics && binAnalytics.dailyTrends.length > 0 && (
                    <div className="recommendation-item">
                      <span className="rec-icon">🗑️</span>
                      <span>Busiest bin day: {(() => {
                        const busiestDay = binAnalytics.dailyTrends.reduce((max, day) => 
                          (day.count || 0) > (max.count || 0) ? day : max
                        );
                        return `${formatDate(busiestDay.date)} (${busiestDay.count} events)`;
                      })()}</span>
                    </div>
                  )}
                  <div className="recommendation-item">
                    <span className="rec-icon">�</span>
                    <span>Collection streak: {(() => {
                      if (!analyticsData.dailyTrends.length) return '0 days';
                      let streak = 0;
                      for (let i = analyticsData.dailyTrends.length - 1; i >= 0; i--) {
                        if ((analyticsData.dailyTrends[i].total || 0) > 0) {
                          streak++;
                        } else {
                          break;
                        }
                      }
                      return `${streak} days`;
                    })()}</span>
                  </div>
                  <div className="recommendation-item">
                    <span className="rec-icon">♻️</span>
                    <span>Top category: {(() => {
                      const totals = analyticsData.totals;
                      const categories = [
                        { name: 'Recyclable', value: totals.recyclable },
                        { name: 'Biodegradable', value: totals.biodegradable },
                        { name: 'Non-biodegradable', value: totals.nonBiodegradable }
                      ];
                      const top = categories.reduce((max, cat) => cat.value > max.value ? cat : max);
                      return `${top.name} (${top.value} items)`;
                    })()}</span>
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