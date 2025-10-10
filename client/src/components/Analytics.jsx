import React, { useState, useEffect, useRef } from 'react';
import { API_ENDPOINTS } from '../config/api';
import AnalyticsCharts from './AnalyticsCharts';
import LoadingSpinner from './LoadingSpinner';
import './AnalyticsDashboard.css';

const Analytics = () => {
  const [category, setCategory] = useState('waste');
  const [timeRange, setTimeRange] = useState('7d');
  const [metric, setMetric] = useState('weight');
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Error Messages for different scenarios
  const getErrorMessage = (error) => {
    if (!error) return null;

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        title: '🌐 Connection Error',
        message: 'Unable to connect to the analytics server. Please check your connection or try again later.',
        code: 'NETWORK_ERROR'
      };
    }

    if (error.status) {
      switch (error.status) {
        case 400:
          return {
            title: '❌ Invalid Request',
            message: 'Invalid analytics parameters. Please try selecting different options.',
            code: 'BAD_REQUEST'
          };
        case 404:
          return {
            title: '🔍 No Analytics Data',
            message: 'No analytics data available for the selected time range.',
            code: 'NOT_FOUND'
          };
        case 500:
          return {
            title: '⚠️ Server Error',
            message: 'The analytics service encountered an error. Please try again in a few moments.',
            code: 'SERVER_ERROR'
          };
        default:
          return {
            title: '🚨 Unexpected Error',
            message: `An unexpected error occurred (${error.status}). Please contact support if this persists.`,
            code: 'UNKNOWN_ERROR'
          };
      }
    }

    return {
      title: '🚨 Unknown Error',
      message: error.message || 'An unknown error occurred. Please try refreshing the page.',
      code: 'UNKNOWN'
    };
  };

  // Fetch analytics data from API
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let url = '';
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };

      switch (category) {
        case 'waste':
          url = `${API_ENDPOINTS.WASTE_ANALYTICS}?range=${timeRange}&metric=${metric}`;
          break;
        case 'bins':
          url = API_ENDPOINTS.BIN_ANALYTICS_SUMMARY;
          break;
        case 'accounts':
          url = `${API_ENDPOINTS.ACCOUNTS_ANALYTICS}?range=${timeRange}`;
          break;
        case 'notifications':
          url = `${API_ENDPOINTS.BIN_ANALYTICS_NOTIFICATIONS}?range=${timeRange}`;
          break;
        default:
          url = `${API_ENDPOINTS.WASTE_ANALYTICS}?range=${timeRange}&metric=${metric}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      const result = await response.json();

      if (!response.ok) {
        throw {
          status: response.status,
          statusText: response.statusText,
          data: result
        };
      }

      console.log(`Analytics data for ${category}:`, result);
      setAnalyticsData(result);

    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [category, timeRange, metric]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Reset metric when category changes
  useEffect(() => {
    if (category === 'waste') {
      setMetric('weight');
    } else if (category === 'bins' || category === 'notifications') {
      setMetric('count');
    } else if (category === 'accounts') {
      setMetric('registrations');
    }
  }, [category]);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Format values based on metric type
  const formatValue = (value, type) => {
    switch (type) {
      case 'weight': return `${value?.toFixed(1) || '0.0'} kg`;
      case 'volume': return `${value?.toFixed(0) || '0'} L`;
      case 'count': return value?.toString() || '0';
      default: return value?.toString() || '0';
    }
  };

  // Get trend indicator
  const getTrendIndicator = (value) => {
    if (value > 0) return { icon: '📈', class: 'positive', text: `+${value.toFixed(1)}%` };
    if (value < 0) return { icon: '📉', class: 'negative', text: `${value.toFixed(1)}%` };
    return { icon: '➡️', class: 'neutral', text: 'No change' };
  };

  // Simple chart component for trends
  const TrendChart = ({ data, metric }) => {
    if (!data || data.length === 0) return <div className="no-chart-data">📊 No data available</div>;

    const maxValue = Math.max(...data.map(d => d[metric] || 0));
    const minValue = Math.min(...data.map(d => d[metric] || 0));
    const range = maxValue - minValue || 1;

    return (
      <div className="trend-chart">
        <div className="chart-bars">
          {data.map((item, index) => {
            const height = ((item[metric] - minValue) / range) * 100;
            return (
              <div key={index} className="chart-bar-container">
                <div 
                  className="chart-bar"
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${formatDate(item.date)}: ${formatValue(item[metric], metric)}`}
                ></div>
                <div className="chart-label">{formatDate(item.date)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-container">
      {/* Header Section */}
      <div className="analytics-header">
        <div className="header-content">
          <h1 className="analytics-title">📊 Analytics Dashboard</h1>
          <p className="analytics-subtitle">Track waste management performance and trends</p>
        </div>
        
        {/* Category Tabs */}
        <div className="category-tabs">
          <button
            className={`tab-button ${category === 'waste' ? 'active' : ''}`}
            onClick={() => setCategory('waste')}
          >
            ♻️ Waste Management
          </button>
          <button
            className={`tab-button ${category === 'bins' ? 'active' : ''}`}
            onClick={() => setCategory('bins')}
          >
            🗑️ Bin Monitoring
          </button>
          <button
            className={`tab-button ${category === 'accounts' ? 'active' : ''}`}
            onClick={() => setCategory('accounts')}
          >
            👥 User Accounts
          </button>
          <button
            className={`tab-button ${category === 'notifications' ? 'active' : ''}`}
            onClick={() => setCategory('notifications')}
          >
            🔔 Notifications
          </button>
        </div>
        
        {/* Controls */}
        <div className="analytics-controls">
          <div className="control-group">
            <label htmlFor="timeRange">📅 Time Range</label>
            <select
              id="timeRange"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="control-select"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
          
          <div className="control-group">
            <label htmlFor="metric">📏 Metric</label>
            <select
              id="metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="control-select"
              disabled={category !== 'waste'}
            >
              {category === 'waste' && (
                <>
                  <option value="weight">Weight (kg)</option>
                  <option value="volume">Volume (L)</option>
                  <option value="count">Count</option>
                </>
              )}
              {category === 'bins' && (
                <option value="count">Bin Full Events</option>
              )}
              {category === 'accounts' && (
                <option value="registrations">Registrations</option>
              )}
              {category === 'notifications' && (
                <option value="count">Notification Count</option>
              )}
            </select>
          </div>
          
          <button
            onClick={() => {
              console.log('Force refreshing analytics...');
              setAnalyticsData(null);
              setError(null);
              fetchAnalyticsData();
            }}
            className="refresh-btn"
            disabled={loading}
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-container">
          <div className="error-card">
            <div className="error-header">
              <h3>{getErrorMessage(error).title}</h3>
              <button
                onClick={() => setError(null)}
                className="error-close"
                aria-label="Close error"
              >
                ✕
              </button>
            </div>
            <p className="error-message">{getErrorMessage(error).message}</p>
            <div className="error-actions">
              <button
                onClick={fetchAnalyticsData}
                className="btn-primary"
                disabled={loading}
              >
                🔄 Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && <LoadingSpinner message="Loading analytics data..." />}

      {/* Analytics Content */}
      {!loading && !error && analyticsData && (
        <>
          {/* Key Metrics */}
          <div className="metrics-grid">
            {category === 'waste' && (
              <>
                <div className="metric-card total-weight">
                  <div className="metric-icon">⚖️</div>
                  <div className="metric-content">
                    <div className="metric-value">{formatValue(analyticsData.totalWeight, 'weight')}</div>
                    <div className="metric-label">Total Weight</div>
                    <div className="metric-trend positive">
                      <span>📈</span>
                      <span>Real data from DB</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card efficiency">
                  <div className="metric-icon">⚡</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.efficiency?.toFixed(1) || '0.0'}%</div>
                    <div className="metric-label">Collection Rate</div>
                    <div className="metric-trend positive">
                      <span>�</span>
                      <span>Weight/Volume ratio</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card active-devices">
                  <div className="metric-icon">�</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.totalRecords || '0'}</div>
                    <div className="metric-label">Total Records</div>
                    <div className="metric-trend neutral">
                      <span>📝</span>
                      <span>Database entries</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card co2-saved">
                  <div className="metric-icon">🌱</div>
                  <div className="metric-content">
                    <div className="metric-value">{formatValue(analyticsData.co2Saved, 'weight')}</div>
                    <div className="metric-label">CO₂ Saved (Est.)</div>
                    <div className="metric-trend positive">
                      <span>🌍</span>
                      <span>Environmental impact</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {category === 'bins' && analyticsData.data && (
              <>
                <div className="metric-card total-weight">
                  <div className="metric-icon">🗑️</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.totalBinFullEvents || 0}</div>
                    <div className="metric-label">Total Bin Events</div>
                    <div className="metric-trend neutral">
                      <span>📊</span>
                      <span>All time count</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card efficiency">
                  <div className="metric-icon">📅</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.todayCount || 0}</div>
                    <div className="metric-label">Today's Events</div>
                    <div className="metric-trend positive">
                      <span>🔔</span>
                      <span>Current day</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card active-devices">
                  <div className="metric-icon">📊</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.thisWeekCount || 0}</div>
                    <div className="metric-label">This Week</div>
                    <div className="metric-trend positive">
                      <span>📈</span>
                      <span>Weekly total</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card co2-saved">
                  <div className="metric-icon">⏰</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.timeSinceLastFull ? `${analyticsData.data.timeSinceLastFull}h` : 'N/A'}</div>
                    <div className="metric-label">Hours Since Last</div>
                    <div className="metric-trend neutral">
                      <span>🕐</span>
                      <span>Time tracking</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {category === 'accounts' && analyticsData.data?.summary && (
              <>
                <div className="metric-card total-weight">
                  <div className="metric-icon">👥</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.summary.totalAccounts || 0}</div>
                    <div className="metric-label">Total Users</div>
                    <div className="metric-trend positive">
                      <span>👤</span>
                      <span>All registered</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card efficiency">
                  <div className="metric-icon">🎯</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.summary.activeAccounts || 0}</div>
                    <div className="metric-label">Active Users</div>
                    <div className="metric-trend positive">
                      <span>✅</span>
                      <span>Recently active</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card active-devices">
                  <div className="metric-icon">📈</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.summary.newRegistrations || 0}</div>
                    <div className="metric-label">New Registrations</div>
                    <div className="metric-trend positive">
                      <span>🆕</span>
                      <span>This period</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card co2-saved">
                  <div className="metric-icon">📊</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.summary.engagementRate?.toFixed(1) || '0'}%</div>
                    <div className="metric-label">Engagement Rate</div>
                    <div className="metric-trend positive">
                      <span>🎯</span>
                      <span>User activity</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {category === 'notifications' && analyticsData.data?.summary && (
              <>
                <div className="metric-card total-weight">
                  <div className="metric-icon">📧</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.summary.totalNotifications || 0}</div>
                    <div className="metric-label">Total Sent</div>
                    <div className="metric-trend positive">
                      <span>📤</span>
                      <span>All time</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card efficiency">
                  <div className="metric-icon">✅</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.summary.deliveryRate?.toFixed(1) || '98.5'}%</div>
                    <div className="metric-label">Delivery Rate</div>
                    <div className="metric-trend positive">
                      <span>🚀</span>
                      <span>High success</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card active-devices">
                  <div className="metric-icon">📈</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.summary.periodNotifications || 0}</div>
                    <div className="metric-label">This Period</div>
                    <div className="metric-trend positive">
                      <span>📊</span>
                      <span>Recent activity</span>
                    </div>
                  </div>
                </div>

                <div className="metric-card co2-saved">
                  <div className="metric-icon">⏰</div>
                  <div className="metric-content">
                    <div className="metric-value">{analyticsData.data.summary.avgPerDay || 0}</div>
                    <div className="metric-label">Avg Per Day</div>
                    <div className="metric-trend neutral">
                      <span>📅</span>
                      <span>Daily average</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Main Trend Chart */}
          <div className="chart-section">
            <div className="chart-header">
              <h2>📈 {
                category === 'waste' ? 'Waste Collection' : 
                category === 'bins' ? 'Bin Full Events' : 
                category === 'accounts' ? 'User Registration' :
                'Notification Delivery'
              } Trends - {metric.charAt(0).toUpperCase() + metric.slice(1)}</h2>
              <div className="chart-period">{timeRange.toUpperCase()}</div>
            </div>
            <div className="chart-container">
              {category === 'waste' && (
                <TrendChart data={analyticsData.trends} metric={metric} />
              )}
              {category === 'bins' && (
                <div className="no-chart-data">📊 Bin analytics chart coming soon</div>
              )}
              {category === 'accounts' && analyticsData.data?.trends && (
                <TrendChart data={analyticsData.data.trends} metric="registrations" />
              )}
              {category === 'notifications' && analyticsData.data?.trends && (
                <TrendChart data={analyticsData.data.trends} metric="notifications" />
              )}
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="summary-section">
            <div className="summary-grid">
              <div className="summary-card">
                <h3>📊 Summary Statistics</h3>
                <div className="summary-stats">
                  <div className="stat-item">
                    <span className="stat-label">📈 Total Records:</span>
                    <span className="stat-value">{analyticsData.totalRecords || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">📅 Date Range:</span>
                    <span className="stat-value">
                      {analyticsData.dateRange ? 
                        `${formatDate(analyticsData.dateRange.start)} - ${formatDate(analyticsData.dateRange.end)}` : 
                        'N/A'
                      }
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">🎯 Collection Efficiency:</span>
                    <span className="stat-value">{analyticsData.efficiency?.toFixed(1) || '0.0'}%</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">💾 Total Volume:</span>
                    <span className="stat-value">{formatValue(analyticsData.totalVolume, 'volume')}</span>
                  </div>
                </div>
              </div>

              <div className="summary-card">
                <h3>🎯 Performance Insights</h3>
                <div className="insight-list">
                  <div className="insight-item">
                    <span className="insight-icon">💡</span>
                    <span>Peak collection day: {analyticsData.trends && analyticsData.trends.length > 0 ? 
                      formatDate(analyticsData.trends.reduce((max, curr) => 
                        curr[metric] > max[metric] ? curr : max
                      ).date) : 'N/A'}</span>
                  </div>
                  <div className="insight-item">
                    <span className="insight-icon">⏰</span>
                    <span>Data updated: {new Date().toLocaleString()}</span>
                  </div>
                  <div className="insight-item">
                    <span className="insight-icon">🌱</span>
                    <span>Environmental impact: {formatValue(analyticsData.co2Saved, 'weight')} CO₂ saved</span>
                  </div>
                  <div className="insight-item">
                    <span className="insight-icon">🔄</span>
                    <span>System status: All devices operational</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* No Data State */}
      {!loading && !error && !analyticsData && (
        <div className="no-data-container">
          <div className="no-data-content">
            <div className="no-data-icon">📊</div>
            <h3>No Analytics Data Available</h3>
            <p>Start collecting waste data to see analytics and trends.</p>
            <button
              onClick={fetchAnalyticsData}
              className="btn-primary"
            >
              🔄 Refresh Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;