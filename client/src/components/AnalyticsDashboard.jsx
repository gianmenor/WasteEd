import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_ENDPOINTS } from '../config/api';
import ExportModal from './ExportModal';
import LoadingSpinner from './LoadingSpinner';
import './AnalyticsDashboard.css';

// Skeleton loading component
const ChartSkeleton = memo(() => (
  <div className="chart-skeleton">
    <div className="skeleton-header"></div>
    <div className="skeleton-bars">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="skeleton-bar" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
      ))}
    </div>
  </div>
));

ChartSkeleton.displayName = 'ChartSkeleton';

// Metric card skeleton
const MetricSkeleton = memo(() => (
  <div className="metric-card skeleton">
    <div className="skeleton-icon"></div>
    <div className="skeleton-value"></div>
    <div className="skeleton-label"></div>
  </div>
));

MetricSkeleton.displayName = 'MetricSkeleton';

// Fetch functions for React Query
const fetchAllWasteData = async () => {
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

  return allData;
};

const fetchAllBinData = async () => {
  let allRecords = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const params = new URLSearchParams({ 
      page: page.toString(), 
      limit: '100', 
      sortBy: 'fullAt', 
      sortOrder: 'asc' 
    });
    
    const res = await fetch(`${API_ENDPOINTS.BIN_RECORDS}?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to fetch bin records: ${res.status}`);
    
    const json = await res.json();
    if (!json.success) throw new Error('Invalid bin records response');
    
    const records = json.data?.records || [];
    allRecords = [...allRecords, ...records];
    
    const pagination = json.data?.pagination;
    hasMore = pagination?.hasNext || pagination?.hasNextPage || false;
    page++;
  }
  
  return allRecords;
};

const AnalyticsDashboard = () => {
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState({
    RECYCLABLE: true,
    WET: true,
    DRY: true
  });

  // Use React Query for data fetching with caching
  const { data: wasteData = [], isLoading: wasteLoading, error: wasteError, refetch: refetchWaste } = useQuery({
    queryKey: ['wasteData'],
    queryFn: fetchAllWasteData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const { data: binData = [], isLoading: binLoading, error: binError, refetch: refetchBin } = useQuery({
    queryKey: ['binData'],
    queryFn: fetchAllBinData,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const loading = wasteLoading || binLoading;
  const error = wasteError || binError;

  // Real-time updates via SSE
  useEffect(() => {
    const eventSource = new EventSource(API_ENDPOINTS.BIN_NOTIFICATIONS_STREAM);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle WASTE_INSERTED events to refresh dashboard
        if (data.type === 'WASTE_INSERTED') {
          console.log('Real-time waste update received, refreshing dashboard...');
          
          // Refetch waste data
          refetchWaste();
          
          // Show toast notification
          setToast({
            type: 'success',
            message: 'Dashboard updated with new waste record'
          });
          
          // Auto-hide toast after 3 seconds
          setTimeout(() => setToast(null), 3000);
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };
    
    return () => {
      eventSource.close();
    };
  }, [refetchWaste]);

  const handleRefresh = useCallback(() => {
    refetchWaste();
    refetchBin();
  }, [refetchWaste, refetchBin]);

  // Unified export handler
  const handleExport = useCallback(async (options) => {
    const { format, includeTypes, dateRange } = options;
    
    // Update selected types based on modal selection
    const typesToExport = {
      RECYCLABLE: includeTypes.recyclable,
      WET: includeTypes.wet,
      DRY: includeTypes.dry
    };
    
    setSelectedTypes(typesToExport);
    
    // Call appropriate export function based on format
    if (format === 'excel') {
      await exportToExcel();
    } else if (format === 'pdf') {
      await exportToPDF();
    } else if (format === 'csv') {
      // CSV export can use same logic as Excel but simpler
      await exportToExcel();
    }
  }, []);

  // Export to Excel function with separate sheets per waste type
  const exportToExcel = useCallback(async () => {
    setExporting(true);
    try {
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

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Create sheet for each waste type if selected
      if (selectedTypes.RECYCLABLE) {
        const recyclableData = allData.map(record => ({
          'Date': new Date(record.date).toLocaleDateString(),
          'Recyclable Wastes (kg)': record.recyclable || 0,
          'Total': record.recyclable || 0
        }));
        const ws = XLSX.utils.json_to_sheet(recyclableData);
        XLSX.utils.book_append_sheet(wb, ws, 'Recyclable Wastes');
      }
      
      if (selectedTypes.WET) {
        const wetData = allData.map(record => ({
          'Date': new Date(record.date).toLocaleDateString(),
          'Wet Wastes (kg)': record.biodegradable || 0,
          'Total': record.biodegradable || 0
        }));
        const ws = XLSX.utils.json_to_sheet(wetData);
        XLSX.utils.book_append_sheet(wb, ws, 'Wet Wastes');
      }
      
      if (selectedTypes.DRY) {
        const dryData = allData.map(record => ({
          'Date': new Date(record.date).toLocaleDateString(),
          'Dry Wastes (kg)': record.nonBiodegradable || 0,
          'Total': record.nonBiodegradable || 0
        }));
        const ws = XLSX.utils.json_to_sheet(dryData);
        XLSX.utils.book_append_sheet(wb, ws, 'Dry Wastes');
      }
      
      // Add summary sheet
      const summaryData = allData.map(record => ({
        'Date': new Date(record.date).toLocaleDateString(),
        'Recyclable (kg)': record.recyclable || 0,
        'Wet (kg)': record.biodegradable || 0,
        'Dry (kg)': record.nonBiodegradable || 0,
        'Total (kg)': (record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0)
      }));
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'All Waste Types');

      // Download file
      XLSX.writeFile(wb, `waste_analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      setToast({ 
        type: 'success', 
        message: `Excel file exported successfully! ${allData.length} records exported.` 
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
  }, [selectedTypes]);

  // PDF Export function
  const exportToPDF = useCallback(async () => {
    setExporting(true);
    try {
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

      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('WASTE-ED Analytics Report', 14, 20);
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      
      let startY = 35;
      
      // Create tables for each selected waste type
      if (selectedTypes.RECYCLABLE) {
        const recyclableData = allData.filter(r => (r.recyclable || 0) > 0).map(record => [
          new Date(record.date).toLocaleDateString(),
          (record.recyclable || 0).toFixed(2)
        ]);
        
        if (recyclableData.length > 0) {
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.text('Recyclable Wastes', 14, startY);
          
          autoTable(doc, {
            head: [['Date', 'Amount (kg)']],
            body: recyclableData,
            startY: startY + 5,
            headStyles: { fillColor: [34, 197, 94] },
            margin: { top: 10 }
          });
          
          startY = doc.lastAutoTable.finalY + 10;
        }
      }
      
      if (selectedTypes.WET) {
        const wetData = allData.filter(r => (r.biodegradable || 0) > 0).map(record => [
          new Date(record.date).toLocaleDateString(),
          (record.biodegradable || 0).toFixed(2)
        ]);
        
        if (wetData.length > 0) {
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.text('Wet Wastes', 14, startY);
          
          autoTable(doc, {
            head: [['Date', 'Amount (kg)']],
            body: wetData,
            startY: startY + 5,
            headStyles: { fillColor: [132, 204, 22] },
            margin: { top: 10 }
          });
          
          startY = doc.lastAutoTable.finalY + 10;
        }
      }
      
      if (selectedTypes.DRY) {
        const dryData = allData.filter(r => (r.nonBiodegradable || 0) > 0).map(record => [
          new Date(record.date).toLocaleDateString(),
          (record.nonBiodegradable || 0).toFixed(2)
        ]);
        
        if (dryData.length > 0) {
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.text('Dry Wastes', 14, startY);
          
          autoTable(doc, {
            head: [['Date', 'Amount (kg)']],
            body: dryData,
            startY: startY + 5,
            headStyles: { fillColor: [249, 115, 22] },
            margin: { top: 10 }
          });
        }
      }
      
      doc.save(`waste_analytics_${new Date().toISOString().split('T')[0]}.pdf`);
      
      setToast({ 
        type: 'success', 
        message: 'PDF exported successfully!' 
      });
      setTimeout(() => setToast(null), 4000);
      
    } catch (err) {
      console.error('PDF Export error:', err);
      setToast({ 
        type: 'error', 
        message: 'Failed to export PDF. Please try again.' 
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setExporting(false);
    }
  }, [selectedTypes]);

  // Helper functions for data processing
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

  // Generate comprehensive waste analytics from raw data (memoized)
  const analyticsData = useMemo(() => {
    if (!wasteData.length) return null;

    // Filter by date range if provided
    let filteredData = wasteData;
    
    if (dateFrom || dateTo) {
      filteredData = wasteData.filter(record => {
        const recordDate = new Date(record.date);
        recordDate.setHours(0, 0, 0, 0);
        
        if (dateFrom && dateTo) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          return recordDate >= from && recordDate <= to;
        } else if (dateFrom) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          return recordDate >= from;
        } else if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          return recordDate <= to;
        }
        return true;
      });
    }

    const totals = filteredData.reduce((acc, record) => {
      acc.recyclable += record.recyclable || 0;
      acc.biodegradable += record.biodegradable || 0;
      acc.nonBiodegradable += record.nonBiodegradable || 0;
      acc.total += (record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0);
      return acc;
    }, { recyclable: 0, biodegradable: 0, nonBiodegradable: 0, total: 0 });

    const dailyTrends = generateDailyTrends(filteredData) || [];
    const monthlyData = generateMonthlyData(filteredData) || [];
    
    const percentages = {
      recyclable: totals.total > 0 ? (totals.recyclable / totals.total * 100).toFixed(1) : 0,
      biodegradable: totals.total > 0 ? (totals.biodegradable / totals.total * 100).toFixed(1) : 0,
      nonBiodegradable: totals.total > 0 ? (totals.nonBiodegradable / totals.total * 100).toFixed(1) : 0
    };

    // Simple trend - just show 0 for now
    const trend = 0;

    const averageDaily = filteredData.length > 0 ? (totals.total / filteredData.length).toFixed(1) : 0;
    const monthlyAverage = monthlyData.length > 0 ? (totals.total / monthlyData.length).toFixed(1) : 0;
    
    return {
      totals,
      percentages,
      trend: parseFloat(trend),
      dailyTrends,
      monthlyData,
      averageDaily,
      monthlyAverage,
      recordCount: filteredData.length,
      peakDay: findPeakDay(filteredData)
    };
  }, [wasteData, dateFrom, dateTo]);

  // Derive bin analytics (memoized)
  const binAnalytics = useMemo(() => {
    if (!binData.length) return null;
    
    // Filter by date range if provided
    let filteredBinData = binData;
    
    if (dateFrom || dateTo) {
      filteredBinData = binData.filter(record => {
        const recordDate = new Date(record.fullAt || record.createdAt);
        recordDate.setHours(0, 0, 0, 0);
        
        if (dateFrom && dateTo) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          return recordDate >= from && recordDate <= to;
        } else if (dateFrom) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          return recordDate >= from;
        } else if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          return recordDate <= to;
        }
        return true;
      });
    }
    
    return {
      total: filteredBinData.length,
      byType: {
        RECYCLABLE: filteredBinData.filter(r => r.binType === 'RECYCLABLE').length,
        WET: filteredBinData.filter(r => r.binType === 'WET').length,
        DRY: filteredBinData.filter(r => r.binType === 'DRY').length,
      }
    };
  }, [binData, dateFrom, dateTo]);

  // Fixed to light theme per PRD
  const themeClass = 'light-theme';

  // Show skeleton while loading
  if (loading) {
    return (
      <div className={`analytics-dashboard ${themeClass}`}>
        <div className="filters-section">
          <div className="filters-header">
            <h1 className="analytics-title">
              <span className="title-icon">📊</span>
              Analytics Dashboard
            </h1>
          </div>
          <div className="filters-controls skeleton-pulse">
            <div className="skeleton-filter"></div>
          </div>
        </div>
        
        <div className="metrics-grid">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
        
        <div className="charts-container">
          <div className="chart-grid">
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-error">
        <div className="error-icon">⚠️</div>
        <h3>Failed to Load Analytics</h3>
        <p>{error?.message || 'Unknown error'}</p>
        <button onClick={handleRefresh} className="retry-button">
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`analytics-dashboard ${themeClass}`}>
      {/* Toast Notification */}
      {toast && (
        <div className={`analytics-toast ${toast.type}`}>
          <span className="toast-icon">{toast.type === 'success' ? '✅' : '❌'}</span>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-header">
          <h1 className="analytics-title">
            <span className="title-icon">📊</span>
            Analytics Dashboard
          </h1>
        </div>
        
        <div className="filters-controls">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <div className="filter-group">
              <label className="filter-label">Date From</label>
              <DatePicker
                value={dateFrom}
                onChange={(newValue) => setDateFrom(newValue)}
                slotProps={{
                  textField: {
                    size: 'small',
                    placeholder: 'Start Date',
                    sx: { minWidth: '180px' }
                  },
                }}
                enableAccessibleFieldDOMStructure={false}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">Date To</label>
              <DatePicker
                value={dateTo}
                onChange={(newValue) => setDateTo(newValue)}
                slotProps={{
                  textField: {
                    size: 'small',
                    placeholder: 'End Date',
                    sx: { minWidth: '180px' }
                  },
                }}
                enableAccessibleFieldDOMStructure={false}
              />
            </div>
          </LocalizationProvider>
          
          <button 
            onClick={() => setShowExportModal(true)} 
            className="export-btn"
            disabled={exporting}
            title="Export waste data"
          >
            {exporting ? '⏳ Exporting...' : '📊 Export Data'}
          </button>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Waste Data"
      />

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
              <div className="metric-label">Recyclable Wastes</div>
              <div className="metric-subtitle">Most sustainable</div>
            </div>

            <div className="metric-card biodegradable">
              <div className="metric-header">
                <span className="metric-icon">🍃</span>
                <span className="metric-percentage">{analyticsData.percentages.biodegradable}%</span>
              </div>
              <div className="metric-value">{analyticsData.totals.biodegradable.toLocaleString()}</div>
              <div className="metric-label">Wet Wastes</div>
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
                      <span>Recyclable Wastes</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color biodegradable"></span>
                      <span>Wet Wastes</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color non-biodegradable"></span>
                      <span>Dry Wastes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Waste Chart - Top Right */}
              <div className="chart-wrapper monthly-waste">
                <h3>Monthly Waste <span className="chart-meta">(Avg {analyticsData.monthlyAverage}/mo)</span></h3>
                <div className="horizontal-line-graph" style={{ '--line-color': '#10b981' }}>
                  {(analyticsData?.monthlyData?.length ?? 0) > 0 ? (
                    <div className="chart-area">
                      <div className="y-labels">
                        {[...(analyticsData?.monthlyData ?? [])].reverse().map((item, i) => (
                          <span key={i}>{item.month}</span>
                        ))}
                      </div>
                      <div className="horizontal-bars">
                        {(() => {
                          const maxValue = Math.max(...(analyticsData?.monthlyData ?? []).map(d => d.total || 1));
                          return [...(analyticsData?.monthlyData ?? [])].reverse().map((item, i) => {
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
                  {(binAnalytics?.dailyTrends?.length ?? 0) > 0 ? (
                    <>
                      <div className="grid-lines">
                        {[0, 1, 2, 3, 4].map((_, i) => <span key={i}></span>)}
                      </div>
                      <div className="y-axis-labels">
                        {(() => {
                          const maxValue = Math.max(...(binAnalytics?.dailyTrends ?? []).map(d => d.count || 1));
                          return (binAnalytics?.dailyTrends ?? []).map((item, i) => (
                            <span key={i}>{item.count}</span>
                          ));
                        })()}
                      </div>
                      <div className="line-bars">
                        {(binAnalytics?.dailyTrends ?? []).map((item, i) => (
                          <div key={i} className="line-bar" style={{ height: `${(item.count || 0) * 10}px` }}></div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="no-data">No data available</div>
                  )}
                </div>
              </div>

              {/* Monthly Bin Events - Bottom Right */}
              <div className="chart-wrapper monthly-bin">
                <h3>Monthly Bin Events {binAnalytics && <span className="chart-meta">(Avg {binAnalytics.monthlyAverage}/mo)</span>}</h3>
                <div className="horizontal-line-graph" style={{ '--line-color': '#3b82f6' }}>
                  {(binAnalytics?.monthlyData?.length ?? 0) > 0 ? (
                    <div className="chart-area">
                      <div className="y-labels">
                        {[...(binAnalytics?.monthlyData ?? [])].reverse().map((item, i) => (
                          <span key={i}>{item.month}</span>
                        ))}
                      </div>
                      <div className="horizontal-bars">
                        {(() => {
                          const maxValue = Math.max(...(binAnalytics?.monthlyData ?? []).map(d => d.count || 1));
                          return [...(binAnalytics?.monthlyData ?? [])].reverse().map((item, i) => {
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
                      if (!(analyticsData?.dailyTrends?.length > 0)) return 'No data';
                      const mostActive = (analyticsData?.dailyTrends ?? []).reduce((max, day) => 
                        (day.total || 0) > (max.total || 0) ? day : max
                      );
                      return `${formatDate(mostActive.date)} (${mostActive.total} items)`;
                    })()}</span>
                  </div>
                  <div className="recommendation-item">
                    <span className="rec-icon">📅</span>
                    <span>Most active month: {(() => {
                      if (!(analyticsData?.monthlyData?.length > 0)) return 'No data';
                      const mostActive = (analyticsData?.monthlyData ?? []).reduce((max, month) => 
                        (month.total || 0) > (max.total || 0) ? month : max
                      );
                      return `${mostActive.month} (${mostActive.total} items)`;
                    })()}</span>
                  </div>
                  {(binAnalytics?.dailyTrends && binAnalytics.dailyTrends.length > 0) && (
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
                      if (!(analyticsData?.dailyTrends?.length > 0)) return '0 days';
                      let streak = 0;
                      for (let i = (analyticsData?.dailyTrends?.length ?? 0) - 1; i >= 0; i--) {
                        if (((analyticsData?.dailyTrends?.[i]?.total) || 0) > 0) {
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
                        { name: 'Recyclable Wastes', value: totals.recyclable },
                        { name: 'Wet Wastes', value: totals.biodegradable },
                        { name: 'Dry Wastes', value: totals.nonBiodegradable }
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

export default memo(AnalyticsDashboard);