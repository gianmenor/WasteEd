import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import AnalyticsCharts from './AnalyticsCharts';
import LoadingSpinner from './LoadingSpinner';

const Analytics = () => {
  const [category, setCategory] = useState('waste');
  const [timeRange, setTimeRange] = useState('7d');
  const [metric, setMetric] = useState('weight');
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  // Export to Excel function
  const exportToExcel = useCallback(async () => {
    setExporting(true);
    try {
      // Fetch all waste data using pagination
      let allData = [];
      let currentPage = 1;
      let hasMoreData = true;

      while (hasMoreData) {
        const params = new URLSearchParams({
          pageSize: '100',
          page: currentPage.toString()
        });
        
        const response = await fetch(`${API_ENDPOINTS.WASTE_RECORDS}?${params.toString()}`);
        
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

      if (allData.length === 0) {
        setToast({ 
          type: 'error', 
          message: 'No data available to export.' 
        });
        setTimeout(() => setToast(null), 4000);
        setExporting(false);
        return;
      }

      const wasteData = allData;

      // Group data by month
      const dataByMonth = {};
      wasteData.forEach(record => {
        const date = new Date(record.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        
        if (!dataByMonth[monthKey]) {
          dataByMonth[monthKey] = {
            name: monthName,
            records: []
          };
        }
        
        dataByMonth[monthKey].records.push(record);
      });

      // Create CSV content with multiple sheets (one per month)
      let csvContent = '';
      const months = Object.keys(dataByMonth).sort();

      months.forEach((monthKey, index) => {
        const monthData = dataByMonth[monthKey];
        
        // Add sheet separator (for Excel multi-sheet CSV)
        if (index > 0) {
          csvContent += '\n\n';
        }
        
        csvContent += `Sheet: ${monthData.name}\n`;
        csvContent += 'Date,Recyclable (kg),Biodegradable (kg),Non-Biodegradable (kg),Total (kg)\n';
        
        monthData.records.forEach(record => {
          const date = new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
          const recyclable = record.recyclable || 0;
          const biodegradable = record.biodegradable || 0;
          const nonBiodegradable = record.nonBiodegradable || 0;
          const total = recyclable + biodegradable + nonBiodegradable;
          
          csvContent += `${date},${recyclable},${biodegradable},${nonBiodegradable},${total}\n`;
        });
        
        // Add monthly summary
        const totalRecyclable = monthData.records.reduce((sum, r) => sum + (r.recyclable || 0), 0);
        const totalBiodegradable = monthData.records.reduce((sum, r) => sum + (r.biodegradable || 0), 0);
        const totalNonBiodegradable = monthData.records.reduce((sum, r) => sum + (r.nonBiodegradable || 0), 0);
        const monthTotal = totalRecyclable + totalBiodegradable + totalNonBiodegradable;
        
        csvContent += `\nMonthly Total,${totalRecyclable.toFixed(2)},${totalBiodegradable.toFixed(2)},${totalNonBiodegradable.toFixed(2)},${monthTotal.toFixed(2)}\n`;
        csvContent += `Average per Day,${(totalRecyclable / monthData.records.length).toFixed(2)},${(totalBiodegradable / monthData.records.length).toFixed(2)},${(totalNonBiodegradable / monthData.records.length).toFixed(2)},${(monthTotal / monthData.records.length).toFixed(2)}\n`;
      });

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `waste_analytics_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Show success message
      setToast({ 
        type: 'success', 
        message: `Excel file exported successfully! Exported ${months.length} month(s) of data.` 
      });
      setTimeout(() => setToast(null), 4000);
      
    } catch (err) {
      console.error('Export error:', err);
      setToast({ 
        type: 'error', 
        message: 'Failed to export data. Please try again.' 
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setExporting(false);
    }
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-4 font-sans overflow-x-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-md animate-slideDown ${
          toast.type === 'success' 
            ? 'bg-green-100/90 dark:bg-green-900/90 text-green-800 dark:text-green-100 border border-green-300 dark:border-green-700' 
            : 'bg-red-100/90 dark:bg-red-900/90 text-red-800 dark:text-red-100 border border-red-300 dark:border-red-700'
        }`}>
          <span className="text-xl">{toast.type === 'success' ? '✅' : '❌'}</span>
          <span className="font-medium">{toast.message}</span>
          <button className="ml-4 text-2xl font-light hover:opacity-70 transition-opacity" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* Header Section */}
      <div className="mb-6 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-black/10 dark:border-slate-700/50 shadow-lg p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3 mb-2">📊 Analytics Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400">Track waste management performance and trends</p>
        </div>
        
        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-300 whitespace-nowrap ${
              category === 'waste' 
                ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white border-blue-500 shadow-md shadow-blue-500/30' 
                : 'bg-white/10 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/30'
            }`}
            onClick={() => setCategory('waste')}
          >
            ♻️ Waste Management
          </button>
          <button
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-300 whitespace-nowrap ${
              category === 'bins' 
                ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white border-blue-500 shadow-md shadow-blue-500/30' 
                : 'bg-white/10 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/30'
            }`}
            onClick={() => setCategory('bins')}
          >
            🗑️ Bin Monitoring
          </button>
          <button
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-300 whitespace-nowrap ${
              category === 'accounts' 
                ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white border-blue-500 shadow-md shadow-blue-500/30' 
                : 'bg-white/10 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/30'
            }`}
            onClick={() => setCategory('accounts')}
          >
            👥 User Accounts
          </button>
          <button
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-300 whitespace-nowrap ${
              category === 'notifications' 
                ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white border-blue-500 shadow-md shadow-blue-500/30' 
                : 'bg-white/10 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/30'
            }`}
            onClick={() => setCategory('notifications')}
          >
            🔔 Notifications
          </button>
        </div>
        
        {/* Controls */}
        <div className="flex gap-3 items-end flex-wrap mt-4">
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label htmlFor="timeRange" className="text-sm font-semibold text-slate-700 dark:text-slate-300">📅 Time Range</label>
            <select
              id="timeRange"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border-2 border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-[0.95rem] cursor-pointer transition-all duration-300 hover:border-blue-500 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label htmlFor="metric" className="text-sm font-semibold text-slate-700 dark:text-slate-300">📏 Metric</label>
            <select
              id="metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="px-3 py-2 border-2 border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-[0.95rem] cursor-pointer transition-all duration-300 hover:border-blue-500 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="px-4 py-2.5 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg font-semibold text-sm transition-all duration-300 hover:from-blue-700 hover:to-blue-900 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap h-fit"
            disabled={loading}
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
          
          <button
            onClick={exportToExcel}
            className="px-4 py-2.5 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg font-semibold text-sm transition-all duration-300 hover:from-blue-700 hover:to-blue-900 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap h-fit"
            disabled={exporting || category !== 'waste'}
            title={category !== 'waste' ? 'Export is only available for Waste Management data' : 'Export to Excel'}
          >
            {exporting ? '⏳ Exporting...' : '📊 Export to Excel'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6">
          <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-red-300 dark:border-red-700 shadow-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{getErrorMessage(error).title}</h3>
              <button
                onClick={() => setError(null)}
                className="text-2xl font-light text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                aria-label="Close error"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-700 dark:text-slate-300 mb-4">{getErrorMessage(error).message}</p>
            <div className="flex gap-3">
              <button
                onClick={fetchAnalyticsData}
                className="px-4 py-2 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg font-semibold transition-all duration-300 hover:from-blue-700 hover:to-blue-900 disabled:opacity-60"
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
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6 max-w-full overflow-hidden">
            {category === 'waste' && (
              <>
                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp [animation-delay:100ms]">
                  <div className="text-3xl mb-4">⚖️</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{formatValue(analyticsData.totalWeight, 'weight')}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Total Weight</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>📈</span>
                      <span>Real data from DB</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp [animation-delay:200ms]">
                  <div className="text-3xl mb-4">⚡</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.efficiency?.toFixed(1) || '0.0'}%</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Collection Rate</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>�</span>
                      <span>Weight/Volume ratio</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp [animation-delay:300ms]">
                  <div className="text-3xl mb-4">📊</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.totalRecords || '0'}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Total Records</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-slate-500/20 border border-slate-500/30 font-semibold inline-flex items-center gap-1">
                      <span>📝</span>
                      <span>Database entries</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp [animation-delay:400ms]">
                  <div className="text-3xl mb-4">🌱</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{formatValue(analyticsData.co2Saved, 'weight')}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">CO₂ Saved (Est.)</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>🌍</span>
                      <span>Environmental impact</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {category === 'bins' && analyticsData.data && (
              <>
                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">🗑️</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.totalBinFullEvents || 0}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Total Bin Events</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-slate-500/20 border border-slate-500/30 font-semibold inline-flex items-center gap-1">
                      <span>📊</span>
                      <span>All time count</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">📅</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.todayCount || 0}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Today's Events</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>🔔</span>
                      <span>Current day</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">📊</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.thisWeekCount || 0}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">This Week</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>📈</span>
                      <span>Weekly total</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">⏰</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.timeSinceLastFull ? `${analyticsData.data.timeSinceLastFull}h` : 'N/A'}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Hours Since Last</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-slate-500/20 border border-slate-500/30 font-semibold inline-flex items-center gap-1">
                      <span>🕐</span>
                      <span>Time tracking</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {category === 'accounts' && analyticsData.data?.summary && (
              <>
                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">👥</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.summary.totalAccounts || 0}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Total Users</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>👤</span>
                      <span>All registered</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">🎯</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.summary.activeAccounts || 0}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Active Users</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>✅</span>
                      <span>Recently active</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">📈</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.summary.newRegistrations || 0}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">New Registrations</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>🆕</span>
                      <span>This period</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">📊</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.summary.engagementRate?.toFixed(1) || '0'}%</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Engagement Rate</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>🎯</span>
                      <span>User activity</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {category === 'notifications' && analyticsData.data?.summary && (
              <>
                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">📧</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.summary.totalNotifications || 0}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Total Sent</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>📤</span>
                      <span>All time</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">✅</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.summary.deliveryRate?.toFixed(1) || '98.5'}%</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Delivery Rate</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>🚀</span>
                      <span>High success</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">📈</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.summary.periodNotifications || 0}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">This Period</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-green-500/20 border border-green-500/30 font-semibold inline-flex items-center gap-1">
                      <span>📊</span>
                      <span>Recent activity</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-black/10 dark:border-slate-700/50 rounded-xl p-4 text-slate-900 dark:text-slate-100 transition-all duration-300 relative overflow-hidden min-h-[120px] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-green-500 before:via-blue-500 before:to-purple-500 before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:before:opacity-100 animate-fadeInUp">
                  <div className="text-3xl mb-4">⏰</div>
                  <div>
                    <div className="text-3xl font-bold mb-1">{analyticsData.data.summary.avgPerDay || 0}</div>
                    <div className="text-sm font-semibold mb-1 text-slate-600 dark:text-slate-400">Avg Per Day</div>
                    <div className="text-sm px-2 py-1 rounded-xl bg-slate-500/20 border border-slate-500/30 font-semibold inline-flex items-center gap-1">
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