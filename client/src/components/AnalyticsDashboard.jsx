import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_ENDPOINTS } from '../config/api';
import ExportModal from './ExportModal';
import LoadingSpinner from './LoadingSpinner';

// Skeleton loading component
const ChartSkeleton = memo(() => (
  <div className="bg-white rounded-lg p-6 border border-gray-200">
    <div className="h-4 bg-gray-100 rounded w-1/3 mb-4 animate-pulse"></div>
    <div className="h-64 bg-gray-50 rounded animate-pulse"></div>
  </div>
));

ChartSkeleton.displayName = 'ChartSkeleton';

// Metric card skeleton
const MetricSkeleton = memo(() => (
  <div className="bg-white rounded-lg p-6 border border-gray-200">
    <div className="h-12 bg-gray-100 rounded mb-2 animate-pulse"></div>
    <div className="h-6 bg-gray-50 rounded w-2/3 animate-pulse"></div>
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
  const [timeframe, setTimeframe] = useState('30d'); // Preset timeframe
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

  const aggregateWasteByDay = useCallback((records) => {
    const grouped = {};

    records.forEach((record) => {
      const dateObj = new Date(record.date);
      const dateKey = dateObj.toISOString().split('T')[0];

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateObj,
          recyclable: 0,
          biodegradable: 0,
          nonBiodegradable: 0,
        };
      }

      grouped[dateKey].recyclable += record.recyclable || 0;
      grouped[dateKey].biodegradable += record.biodegradable || 0;
      grouped[dateKey].nonBiodegradable += record.nonBiodegradable || 0;
    });

    return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, []);

  // Export to Excel function with separate sheets per waste type
  const exportToExcel = useCallback(async (dateFilters = {}, typesToExport = null) => {
    // Use passed types or fall back to current state
    const types = typesToExport || selectedTypes;
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
        
        // Add date filters if custom range is selected
        if (dateFilters.dateRange === 'custom') {
          if (dateFilters.customDateFrom) params.append('dateFrom', dateFilters.customDateFrom);
          if (dateFilters.customDateTo) params.append('dateTo', dateFilters.customDateTo);
        }
        
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

      // Apply date range filtering for non-custom ranges
      if (dateFilters.dateRange && dateFilters.dateRange !== 'all' && dateFilters.dateRange !== 'custom') {
        const now = new Date();
        let filterDate;
        
        switch (dateFilters.dateRange) {
          case 'today':
            filterDate = new Date(now.setHours(0, 0, 0, 0));
            allData = allData.filter(r => new Date(r.date) >= filterDate);
            break;
          case 'week':
            filterDate = new Date(now.setDate(now.getDate() - 7));
            allData = allData.filter(r => new Date(r.date) >= filterDate);
            break;
          case 'month':
            filterDate = new Date(now.setMonth(now.getMonth() - 1));
            allData = allData.filter(r => new Date(r.date) >= filterDate);
            break;
          case 'year':
            filterDate = new Date(now.setFullYear(now.getFullYear() - 1));
            allData = allData.filter(r => new Date(r.date) >= filterDate);
            break;
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

      const summarizedData = aggregateWasteByDay(allData);

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Create sheet for each waste type if selected
      if (types.RECYCLABLE) {
        const recyclableData = summarizedData.map(record => ({
          'Date': record.date.toLocaleDateString(),
          'Recyclable Wastes (pcs)': record.recyclable || 0,
          'Total': record.recyclable || 0
        }));
        const ws = XLSX.utils.json_to_sheet(recyclableData);
        XLSX.utils.book_append_sheet(wb, ws, 'Recyclable Wastes');
      }
      
      if (types.WET) {
        const wetData = summarizedData.map(record => ({
          'Date': record.date.toLocaleDateString(),
          'Wet Wastes (pcs)': record.biodegradable || 0,
          'Total': record.biodegradable || 0
        }));
        const ws = XLSX.utils.json_to_sheet(wetData);
        XLSX.utils.book_append_sheet(wb, ws, 'Wet Wastes');
      }
      
      if (types.DRY) {
        const dryData = summarizedData.map(record => ({
          'Date': record.date.toLocaleDateString(),
          'Dry Wastes (pcs)': record.nonBiodegradable || 0,
          'Total': record.nonBiodegradable || 0
        }));
        const ws = XLSX.utils.json_to_sheet(dryData);
        XLSX.utils.book_append_sheet(wb, ws, 'Dry Wastes');
      }
      
      // Add summary sheet with only selected types
      const summaryData = summarizedData.map(record => {
        const row = {
          'Date': record.date.toLocaleDateString()
        };
        if (types.RECYCLABLE) row['Recyclable (pcs)'] = record.recyclable || 0;
        if (types.WET) row['Wet (pcs)'] = record.biodegradable || 0;
        if (types.DRY) row['Dry (pcs)'] = record.nonBiodegradable || 0;
        
        // Calculate total from selected types only
        row['Total (pcs)'] = 
          (types.RECYCLABLE ? (record.recyclable || 0) : 0) +
          (types.WET ? (record.biodegradable || 0) : 0) +
          (types.DRY ? (record.nonBiodegradable || 0) : 0);
        
        return row;
      });
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Download file
      XLSX.writeFile(wb, `waste_analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      setToast({ 
        type: 'success', 
        message: `Excel file exported successfully! ${summarizedData.length} daily summaries exported.` 
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
  }, [selectedTypes, aggregateWasteByDay]);

  // PDF Export function
  const exportToPDF = useCallback(async (dateFilters = {}, typesToExport = null) => {
    // Use passed types or fall back to current state
    const types = typesToExport || selectedTypes;
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
        
        // Add date filters if custom range is selected
        if (dateFilters.dateRange === 'custom') {
          if (dateFilters.customDateFrom) params.append('dateFrom', dateFilters.customDateFrom);
          if (dateFilters.customDateTo) params.append('dateTo', dateFilters.customDateTo);
        }
        
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

      // Apply date range filtering for non-custom ranges
      if (dateFilters.dateRange && dateFilters.dateRange !== 'all' && dateFilters.dateRange !== 'custom') {
        const now = new Date();
        let filterDate;
        
        switch (dateFilters.dateRange) {
          case 'today':
            filterDate = new Date(now.setHours(0, 0, 0, 0));
            allData = allData.filter(r => new Date(r.date) >= filterDate);
            break;
          case 'week':
            filterDate = new Date(now.setDate(now.getDate() - 7));
            allData = allData.filter(r => new Date(r.date) >= filterDate);
            break;
          case 'month':
            filterDate = new Date(now.setMonth(now.getMonth() - 1));
            allData = allData.filter(r => new Date(r.date) >= filterDate);
            break;
          case 'year':
            filterDate = new Date(now.setFullYear(now.getFullYear() - 1));
            allData = allData.filter(r => new Date(r.date) >= filterDate);
            break;
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

      const summarizedData = aggregateWasteByDay(allData);
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
      if (types.RECYCLABLE) {
        const recyclableData = summarizedData.filter(r => (r.recyclable || 0) > 0).map(record => [
          record.date.toLocaleDateString(),
          (record.recyclable || 0).toFixed(2)
        ]);
        
        if (recyclableData.length > 0) {
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.text('Recyclable Wastes', 14, startY);
          
          autoTable(doc, {
            head: [['Date', 'Amount (pcs)']],
            body: recyclableData,
            startY: startY + 5,
            headStyles: { fillColor: [34, 197, 94] },
            margin: { top: 10 }
          });
          
          startY = doc.lastAutoTable.finalY + 10;
        }
      }
      
      if (types.WET) {
        const wetData = summarizedData.filter(r => (r.biodegradable || 0) > 0).map(record => [
          record.date.toLocaleDateString(),
          (record.biodegradable || 0).toFixed(2)
        ]);
        
        if (wetData.length > 0) {
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.text('Wet Wastes', 14, startY);
          
          autoTable(doc, {
            head: [['Date', 'Amount (pcs)']],
            body: wetData,
            startY: startY + 5,
            headStyles: { fillColor: [132, 204, 22] },
            margin: { top: 10 }
          });
          
          startY = doc.lastAutoTable.finalY + 10;
        }
      }
      
      if (types.DRY) {
        const dryData = summarizedData.filter(r => (r.nonBiodegradable || 0) > 0).map(record => [
          record.date.toLocaleDateString(),
          (record.nonBiodegradable || 0).toFixed(2)
        ]);
        
        if (dryData.length > 0) {
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.text('Dry Wastes', 14, startY);
          
          autoTable(doc, {
            head: [['Date', 'Amount (pcs)']],
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
  }, [selectedTypes, aggregateWasteByDay]);

  // Unified export handler
  const handleExport = useCallback(async (options) => {
    const { format, includeTypes, dateRange, customDateFrom, customDateTo } = options;
    
    // Map modal types to internal format - handle false values correctly
    const typesToExport = {
      RECYCLABLE: includeTypes?.recyclable !== undefined ? includeTypes.recyclable : true,
      WET: includeTypes?.wet !== undefined ? includeTypes.wet : true,
      DRY: includeTypes?.dry !== undefined ? includeTypes.dry : true
    };
    
    // Store date filters for export functions
    const dateFilters = { dateRange, customDateFrom, customDateTo };
    
    // Call appropriate export function based on format, passing types directly
    if (format === 'excel') {
      await exportToExcel(dateFilters, typesToExport);
    } else if (format === 'pdf') {
      await exportToPDF(dateFilters, typesToExport);
    } else if (format === 'csv') {
      // CSV export can use same logic as Excel but simpler
      await exportToExcel(dateFilters, typesToExport);
    }
  }, [exportToExcel, exportToPDF]);

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

  // Calculate date range based on timeframe preset
  const getDateRange = useCallback(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (timeframe) {
      case 'today':
        return { from: today, to: now };
      case '7d':
        const last7Days = new Date();
        last7Days.setDate(now.getDate() - 7);
        last7Days.setHours(0, 0, 0, 0);
        return { from: last7Days, to: now };
      case '30d':
        const last30Days = new Date();
        last30Days.setDate(now.getDate() - 30);
        last30Days.setHours(0, 0, 0, 0);
        return { from: last30Days, to: now };
      case 'thisMonth':
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        thisMonthStart.setHours(0, 0, 0, 0);
        return { from: thisMonthStart, to: now };
      case 'lastMonth':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        lastMonthStart.setHours(0, 0, 0, 0);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        lastMonthEnd.setHours(23, 59, 59, 999);
        return { from: lastMonthStart, to: lastMonthEnd };
      case 'custom':
        if (dateFrom && dateTo) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          return { from, to };
        }
        return null;
      default:
        return null;
    }
  }, [timeframe, dateFrom, dateTo]);

  // Generate comprehensive waste analytics from raw data (memoized)
  const analyticsData = useMemo(() => {
    if (!wasteData.length) return null;

    // Filter by date range based on timeframe
    let filteredData = wasteData;
    const dateRange = getDateRange();
    
    if (dateRange) {
      filteredData = wasteData.filter(record => {
        const recordDate = new Date(record.date);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate >= dateRange.from && recordDate <= dateRange.to;
      });
    }
    
    // Filter by selected waste types
    filteredData = filteredData.map(record => ({
      ...record,
      recyclable: selectedTypes.RECYCLABLE ? (record.recyclable || 0) : 0,
      biodegradable: selectedTypes.WET ? (record.biodegradable || 0) : 0,
      nonBiodegradable: selectedTypes.DRY ? (record.nonBiodegradable || 0) : 0
    }));

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
  }, [wasteData, timeframe, dateFrom, dateTo, selectedTypes, getDateRange]);

  // Derive bin analytics (memoized)
  const binAnalytics = useMemo(() => {
    if (!binData.length) return null;
    
    // Filter by date range using same logic as waste data
    let filteredBinData = binData;
    const dateRange = getDateRange();
    
    if (dateRange) {
      filteredBinData = binData.filter(record => {
        const recordDate = new Date(record.fullAt || record.createdAt);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate >= dateRange.from && recordDate <= dateRange.to;
      });
    }
    
    // Filter by selected waste types
    if (!selectedTypes.RECYCLABLE) {
      filteredBinData = filteredBinData.filter(r => r.binType !== 'RECYCLABLE');
    }
    if (!selectedTypes.WET) {
      filteredBinData = filteredBinData.filter(r => r.binType !== 'WET');
    }
    if (!selectedTypes.DRY) {
      filteredBinData = filteredBinData.filter(r => r.binType !== 'DRY');
    }
    
    return {
      total: filteredBinData.length,
      byType: {
        RECYCLABLE: filteredBinData.filter(r => r.binType === 'RECYCLABLE').length,
        WET: filteredBinData.filter(r => r.binType === 'WET').length,
        DRY: filteredBinData.filter(r => r.binType === 'DRY').length,
      }
    };
  }, [binData, timeframe, dateFrom, dateTo, selectedTypes, getDateRange]);

  // Fixed to light theme per PRD
  const themeClass = 'light-theme';

  // Show skeleton while loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-8 bg-gray-100 rounded w-64 mb-4 animate-pulse"></div>
            <div className="h-10 bg-gray-50 rounded animate-pulse"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg border border-gray-200 max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Analytics</h3>
          <p className="text-gray-600 mb-6">{error?.message || 'Unknown error'}</p>
          <button 
            onClick={handleRefresh} 
            className="bg-gray-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Toast Notification */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg border transition-all ${
            toast.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{toast.type === 'success' ? '✓' : '✕'}</span>
                <span className="font-medium text-sm">{toast.message}</span>
              </div>
              <button 
                className="text-gray-500 hover:text-gray-700 ml-4" 
                onClick={() => setToast(null)}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Analytics Dashboard</h1>
          <div className="flex gap-2">
            <button 
              onClick={handleRefresh} 
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              ↻ Refresh
            </button>
            <button 
              onClick={() => setShowExportModal(true)} 
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-4">
            {/* Timeframe Presets */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'today', label: 'Today' },
                  { value: '7d', label: 'Last 7 Days' },
                  { value: '30d', label: 'Last 30 Days' },
                  { value: 'thisMonth', label: 'This Month' },
                  { value: 'lastMonth', label: 'Last Month' },
                  { value: 'custom', label: 'Custom' },
                ].map((option) => (
                  <button 
                    key={option.value}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      timeframe === option.value 
                        ? 'bg-gray-900 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setTimeframe(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Custom Date Range */}
            {timeframe === 'custom' && (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <div className="flex gap-4 flex-wrap p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">From</label>
                    <DatePicker
                      value={dateFrom}
                      onChange={(newValue) => setDateFrom(newValue)}
                      maxDate={new Date()}
                      slotProps={{
                        textField: {
                          size: 'small',
                          placeholder: 'Start Date',
                          sx: { minWidth: '160px', backgroundColor: 'white' }
                        },
                      }}
                      enableAccessibleFieldDOMStructure={false}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">To</label>
                    <DatePicker
                      value={dateTo}
                      onChange={(newValue) => setDateTo(newValue)}
                      maxDate={new Date()}
                      slotProps={{
                        textField: {
                          size: 'small',
                          placeholder: 'End Date',
                          sx: { minWidth: '160px', backgroundColor: 'white' }
                        },
                      }}
                      enableAccessibleFieldDOMStructure={false}
                    />
                  </div>
                </div>
              </LocalizationProvider>
            )}
            
            {/* Waste Type Filters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Waste Types</label>
              <div className="flex gap-2 flex-wrap">
                <button 
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTypes.RECYCLABLE 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedTypes(prev => ({ ...prev, RECYCLABLE: !prev.RECYCLABLE }))}
                >
                  ♻ Recyclable
                </button>
                <button 
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTypes.WET 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedTypes(prev => ({ ...prev, WET: !prev.WET }))}
                >
                  🌿 Wet
                </button>
                <button 
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTypes.DRY 
                      ? 'bg-slate-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedTypes(prev => ({ ...prev, DRY: !prev.DRY }))}
                >
                  🗑 Dry
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Export Modal */}
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          title="Export Waste Data"
        />

        {/* Metrics */}
        {analyticsData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Items */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex justify-between items-start mb-3">
                <span className="text-2xl">📊</span>
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  analyticsData.trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {analyticsData.trend >= 0 ? '↑' : '↓'} {Math.abs(analyticsData.trend)}%
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {analyticsData.totals.total.toLocaleString()}
              </div>
              <div className="text-sm font-medium text-gray-700 mb-1">Total Items Collected</div>
              <div className="text-xs text-gray-500">Avg {analyticsData.averageDaily}/day</div>
            </div>

            {/* Recyclable */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex justify-between items-start mb-3">
                <span className="text-2xl">♻</span>
                <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                  {analyticsData.percentages.recyclable}%
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {analyticsData.totals.recyclable.toLocaleString()}
              </div>
              <div className="text-sm font-medium text-gray-700 mb-1">Recyclable Wastes</div>
              <div className="text-xs text-gray-500">Most sustainable</div>
            </div>

            {/* Wet Waste */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex justify-between items-start mb-3">
                <span className="text-2xl">🌿</span>
                <span className="text-xs font-medium px-2 py-1 rounded bg-amber-100 text-amber-700">
                  {analyticsData.percentages.biodegradable}%
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {analyticsData.totals.biodegradable.toLocaleString()}
              </div>
              <div className="text-sm font-medium text-gray-700 mb-1">Wet Wastes</div>
              <div className="text-xs text-gray-500">Compostable</div>
            </div>

            {/* Dry Waste */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex justify-between items-start mb-3">
                <span className="text-2xl">🗑</span>
                <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-700">
                  {analyticsData.percentages.nonBiodegradable}%
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {analyticsData.totals.nonBiodegradable.toLocaleString()}
              </div>
              <div className="text-sm font-medium text-gray-700 mb-1">Dry Wastes</div>
              <div className="text-xs text-gray-500">Residual waste stream</div>
            </div>
          </div>
        )}

        {/* Charts */}
        {analyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Daily Waste Chart */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Daily Waste Items
                <span className="text-xs font-normal text-gray-500 ml-2">(Avg {analyticsData.averageDaily}/day)</span>
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.dailyTrends.map(item => ({
                  date: formatDate(item.date),
                  Recyclable: item.recyclable || 0,
                  Wet: item.biodegradable || 0,
                  Dry: item.nonBiodegradable || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }} 
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }}
                    iconType="square"
                  />
                  <Bar dataKey="Recyclable" stackId="a" fill="#10b981" />
                  <Bar dataKey="Wet" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="Dry" stackId="a" fill="#6b7280" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Waste Chart */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Monthly Waste
                <span className="text-xs font-normal text-gray-500 ml-2">(Avg {analyticsData.monthlyAverage}/mo)</span>
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={(analyticsData.monthlyData || []).map(item => ({
                  month: item.month,
                  Total: item.total || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }} 
                  />
                  <Bar dataKey="Total" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Insights */}
        {analyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Key Insights</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                  <span>🏆</span>
                  <span>Peak day: {analyticsData.peakDay ? formatDate(analyticsData.peakDay.date) : 'N/A'}</span>
                </div>
                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                  <span>📈</span>
                  <span>Recycling rate: {analyticsData.percentages.recyclable}%</span>
                </div>
                {binAnalytics && (
                  <div className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                    <span>🗑</span>
                    <span>Bin events: {binAnalytics.total}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Activity</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                  <span>📅</span>
                  <span>Most active day: {(() => {
                    if (!analyticsData.dailyTrends?.length) return 'No data';
                    const mostActive = analyticsData.dailyTrends.reduce((max, day) => 
                      (day.total || 0) > (max.total || 0) ? day : max
                    );
                    return `${formatDate(mostActive.date)} (${mostActive.total})`;
                  })()}</span>
                </div>
                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                  <span>📊</span>
                  <span>Most active month: {(() => {
                    if (!analyticsData.monthlyData?.length) return 'No data';
                    const mostActive = analyticsData.monthlyData.reduce((max, month) => 
                      (month.total || 0) > (max.total || 0) ? month : max
                    );
                    return `${mostActive.month} (${mostActive.total})`;
                  })()}</span>
                </div>
                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                  <span>♻</span>
                  <span>Top category: {(() => {
                    const totals = analyticsData.totals;
                    const categories = [
                      { name: 'Recyclable', value: totals.recyclable },
                      { name: 'Wet', value: totals.biodegradable },
                      { name: 'Dry', value: totals.nonBiodegradable }
                    ];
                    const top = categories.reduce((max, cat) => cat.value > max.value ? cat : max);
                    return `${top.name} (${top.value})`;
                  })()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(AnalyticsDashboard);