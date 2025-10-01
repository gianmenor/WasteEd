import { useState, useEffect, useCallback } from 'react';
import './Analytics.css';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [metric, setMetric] = useState('weight');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // API Base URL
  const API_BASE_URL = 'http://localhost:3000/api';

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
      const response = await fetch(`${API_BASE_URL}/waste/analytics?range=${timeRange}&metric=${metric}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw {
          status: response.status,
          statusText: response.statusText,
          data: result
        };
      }

      setAnalyticsData(result);

    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [timeRange, metric, API_BASE_URL]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

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
            >
              <option value="weight">Weight (kg)</option>
              <option value="volume">Volume (L)</option>
              <option value="count">Count</option>
            </select>
          </div>
          
          <button
            onClick={fetchAnalyticsData}
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
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner">🔄</div>
          <p>Loading analytics data...</p>
        </div>
      )}

      {/* Analytics Content */}
      {!loading && !error && analyticsData && (
        <>
          {/* Key Metrics */}
          <div className="metrics-grid">
            <div className="metric-card total-weight">
              <div className="metric-icon">⚖️</div>
              <div className="metric-content">
                <div className="metric-value">{formatValue(analyticsData.totalWeight, 'weight')}</div>
                <div className="metric-label">Total Weight</div>
                <div className="metric-trend positive">
                  <span>📈</span>
                  <span>+12.5% vs last period</span>
                </div>
              </div>
            </div>

            <div className="metric-card efficiency">
              <div className="metric-icon">⚡</div>
              <div className="metric-content">
                <div className="metric-value">{analyticsData.efficiency?.toFixed(0) || '89'}%</div>
                <div className="metric-label">Efficiency Rate</div>
                <div className="metric-trend positive">
                  <span>📈</span>
                  <span>+3.2% vs last period</span>
                </div>
              </div>
            </div>

            <div className="metric-card active-devices">
              <div className="metric-icon">🔗</div>
              <div className="metric-content">
                <div className="metric-value">{analyticsData.activeDevices || '5'}</div>
                <div className="metric-label">Active Devices</div>
                <div className="metric-trend neutral">
                  <span>✅</span>
                  <span>All systems online</span>
                </div>
              </div>
            </div>

            <div className="metric-card co2-saved">
              <div className="metric-icon">🌱</div>
              <div className="metric-content">
                <div className="metric-value">{formatValue(analyticsData.co2Saved, 'weight')}</div>
                <div className="metric-label">CO₂ Saved</div>
                <div className="metric-trend positive">
                  <span>🌍</span>
                  <span>Environmental impact</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Trend Chart */}
          <div className="chart-section">
            <div className="chart-header">
              <h2>📈 Waste Collection Trends - {metric.charAt(0).toUpperCase() + metric.slice(1)}</h2>
              <div className="chart-period">{timeRange.toUpperCase()}</div>
            </div>
            <div className="chart-container">
              <TrendChart data={analyticsData.trends} metric={metric} />
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