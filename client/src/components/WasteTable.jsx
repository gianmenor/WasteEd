import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { usePreferences } from '../contexts/PreferencesContext';
import { API_ENDPOINTS } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import ExportModal from './ExportModal';
import './WasteTable.css';

// Skeleton row component
const SkeletonRow = memo(() => (
  <tr className="skeleton-row">
    <td><div className="skeleton-cell skeleton-pulse"></div></td>
    <td><div className="skeleton-cell skeleton-pulse"></div></td>
    <td><div className="skeleton-cell skeleton-pulse"></div></td>
    <td><div className="skeleton-cell skeleton-pulse"></div></td>
    <td><div className="skeleton-cell skeleton-pulse"></div></td>
  </tr>
));

SkeletonRow.displayName = 'SkeletonRow';

// Fetch function for React Query
const fetchAllWasteData = async ({ dateFrom, dateTo }) => {
  let allData = [];
  let currentPage = 1;
  let hasMoreData = true;

  while (hasMoreData) {
    const params = new URLSearchParams();
    
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    params.append('pageSize', '100');
    params.append('page', currentPage.toString());
    
    const response = await fetch(`${API_ENDPOINTS.WASTE_RECORDS}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
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

const WasteTable = () => {
  const { preferences } = usePreferences();
  const tableRef = useRef(null);
  const [viewMode, setViewMode] = useState('daily');
  const [dateFromObj, setDateFromObj] = useState(null);
  const [dateToObj, setDateToObj] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCompactPagination, setIsCompactPagination] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 480px)').matches;
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [typeFilter, setTypeFilter] = useState('all'); // all, recyclable, biodegradable, nonBiodegradable
  const [showExportModal, setShowExportModal] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQueryList = window.matchMedia('(max-width: 480px)');
    const handleChange = (event) => setIsCompactPagination(event.matches);

    setIsCompactPagination(mediaQueryList.matches);
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    }

    // Safari fallback
    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  }, []);
  
  // Convert Date objects to strings for API
  const dateFrom = useMemo(() => 
    dateFromObj ? dateFromObj.toISOString().split('T')[0] : '',
    [dateFromObj]
  );
  const dateTo = useMemo(() => 
    dateToObj ? dateToObj.toISOString().split('T')[0] : '',
    [dateToObj]
  );
  
  // Fixed to 10 records per page as per PRD requirement
  const itemsPerPage = 10;

  // Use React Query for data fetching with caching
  const { data: wasteData = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['wasteData', dateFrom, dateTo],
    queryFn: () => fetchAllWasteData({ dateFrom, dateTo }),
    staleTime: 30 * 1000, // 30 seconds - shorter to show latest records
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Enable to show latest records when user returns
  });

  const error = useMemo(() => {
    if (!queryError) return null;
    setDismissedError(false); // Reset dismiss state when new error occurs
    return {
      message: 'Unable to load waste collection data',
      details: queryError.message,
      timestamp: new Date().toISOString()
    };
  }, [queryError]);

  // Aggregate data by month (memoized)
  const aggregateByMonth = useCallback((data) => {
    const monthlyData = {};
    
    data.forEach(record => {
      const date = new Date(record.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          id: monthKey,
          date: monthKey + '-01', // First day of month for display
          recyclable: 0,
          biodegradable: 0,
          nonBiodegradable: 0,
          total: 0
        };
      }
      
      monthlyData[monthKey].recyclable += record.recyclable || 0;
      monthlyData[monthKey].biodegradable += record.biodegradable || 0;
      monthlyData[monthKey].nonBiodegradable += record.nonBiodegradable || 0;
      monthlyData[monthKey].total += (record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0);
    });
    
    return Object.values(monthlyData).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, []);

  // Process data based on view mode (memoized)
  const processedData = useMemo(() => {
    let data;
    
    if (viewMode === 'monthly') {
      data = aggregateByMonth(wasteData);
    } else {
      // Transform each record into individual rows per waste type
      data = [];
      wasteData.forEach(record => {
        // Add recyclable row if quantity > 0
        if (record.recyclable > 0) {
          data.push({
            id: `${record.id}-recyclable`,
            date: record.date,
            time: record.recordedAt || record.createdAt,
            type: 'Recyclable',
            quantityInPcs: record.recyclable,
            couponTaken: Math.floor(record.recyclable * 0.5), // Example calculation
            originalType: 'recyclable'
          });
        }
        // Add biodegradable row if quantity > 0
        if (record.biodegradable > 0) {
          data.push({
            id: `${record.id}-biodegradable`,
            date: record.date,
            time: record.recordedAt || record.createdAt,
            type: 'Wet Wastes',
            quantityInPcs: record.biodegradable,
            couponTaken: 0,
            originalType: 'biodegradable'
          });
        }
        // Add non-biodegradable row if quantity > 0
        if (record.nonBiodegradable > 0) {
          data.push({
            id: `${record.id}-nonBiodegradable`,
            date: record.date,
            time: record.recordedAt || record.createdAt,
            type: 'Dry Wastes',
            quantityInPcs: record.nonBiodegradable,
            couponTaken: 0,
            originalType: 'nonBiodegradable'
          });
        }
      });
    }
    
    // Apply type filtering
    if (viewMode === 'daily' && typeFilter !== 'all') {
      data = data.filter(record => record.originalType === typeFilter);
    }
    
    // Apply sorting
    if (sortBy && data.length > 0) {
      data = [...data].sort((a, b) => {
        let aVal, bVal;
        
        switch (sortBy) {
          case 'date':
            aVal = new Date(a.date).getTime();
            bVal = new Date(b.date).getTime();
            // Explicitly handle date sorting to show newest first when desc
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
          case 'time':
            aVal = a.time ? new Date(a.time).getTime() : 0;
            bVal = b.time ? new Date(b.time).getTime() : 0;
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
          case 'type':
            aVal = a.type || '';
            bVal = b.type || '';
            return sortOrder === 'asc' 
              ? aVal.localeCompare(bVal) 
              : bVal.localeCompare(aVal);
          case 'quantity':
            aVal = a.quantityInPcs || a.total || 0;
            bVal = b.quantityInPcs || b.total || 0;
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
          case 'recyclable':
            aVal = a.recyclable || 0;
            bVal = b.recyclable || 0;
            break;
          case 'biodegradable':
            aVal = a.biodegradable || 0;
            bVal = b.biodegradable || 0;
            break;
          case 'nonBiodegradable':
            aVal = a.nonBiodegradable || 0;
            bVal = b.nonBiodegradable || 0;
            break;
          case 'total':
            aVal = (a.recyclable || 0) + (a.biodegradable || 0) + (a.nonBiodegradable || 0);
            bVal = (b.recyclable || 0) + (b.biodegradable || 0) + (b.nonBiodegradable || 0);
            break;
          default:
            return 0;
        }
        
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    
    return data;
  }, [viewMode, wasteData, aggregateByMonth, sortBy, sortOrder, typeFilter]);

  // Calculate pagination (memoized)
  const { totalItems, totalPages, startIndex, endIndex, paginatedData } = useMemo(() => {
    const totalItems = processedData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = processedData.slice(startIndex, endIndex);
    return { totalItems, totalPages, startIndex, endIndex, paginatedData };
  }, [processedData, currentPage, itemsPerPage]);

  // Calculate statistics (memoized)
  const statistics = useMemo(() => {
    if (viewMode === 'monthly') {
      // For monthly view, use aggregated data
      const stats = { recyclable: 0, biodegradable: 0, nonBiodegradable: 0, total: 0, totalDays: totalItems };
      processedData.forEach(record => {
        stats.recyclable += record.recyclable || 0;
        stats.biodegradable += record.biodegradable || 0;
        stats.nonBiodegradable += record.nonBiodegradable || 0;
        stats.total += (record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0);
      });
      return stats;
    } else {
      // For daily view with individual records per type
      const stats = { recyclable: 0, biodegradable: 0, nonBiodegradable: 0, total: 0, totalDays: totalItems };
      processedData.forEach(record => {
        if (record.originalType === 'recyclable') {
          stats.recyclable += record.quantityInPcs || 0;
        } else if (record.originalType === 'biodegradable') {
          stats.biodegradable += record.quantityInPcs || 0;
        } else if (record.originalType === 'nonBiodegradable') {
          stats.nonBiodegradable += record.quantityInPcs || 0;
        }
        stats.total += record.quantityInPcs || 0;
      });
      return stats;
    }
  }, [processedData, totalItems, viewMode]);

  // Reset to first page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, dateFrom, dateTo, sortBy, sortOrder]);

  // Handler for sorting
  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  }, [sortBy]);

  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    if (viewMode === 'monthly') {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
      });
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, [viewMode]);

  const formatCount = useCallback((count) => {
    if (count == null) return '0';
    return parseInt(count).toString();
  }, []);

  // Helper: filter wasteData (raw records) by the export modal date range
  const applyExportDateFilter = useCallback((rawData, dateRange, customDateFrom, customDateTo) => {
    if (!rawData || !Array.isArray(rawData)) return [];

    const now = new Date();
    now.setHours(23, 59, 59, 999);

    if (dateRange === 'all') return rawData;

    return rawData.filter(record => {
      const d = new Date(record.date);
      if (dateRange === 'today') {
        const today = new Date();
        return d.toDateString() === today.toDateString();
      }
      if (dateRange === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 6);
        weekAgo.setHours(0, 0, 0, 0);
        return d >= weekAgo && d <= now;
      }
      if (dateRange === 'month') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }
      if (dateRange === 'year') {
        return d.getFullYear() === now.getFullYear();
      }
      if (dateRange === 'custom') {
        const from = customDateFrom ? new Date(customDateFrom + 'T00:00:00') : null;
        const to = customDateTo ? new Date(customDateTo + 'T23:59:59') : null;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      }
      return true;
    });
  }, []);

  // Helper: aggregate raw records by month for export
  const aggregateForExport = useCallback((rawData) => {
    const monthlyData = {};
    rawData.forEach(record => {
      const date = new Date(record.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { date: monthKey + '-01', recyclable: 0, biodegradable: 0, nonBiodegradable: 0 };
      }
      monthlyData[monthKey].recyclable += record.recyclable || 0;
      monthlyData[monthKey].biodegradable += record.biodegradable || 0;
      monthlyData[monthKey].nonBiodegradable += record.nonBiodegradable || 0;
    });
    return Object.values(monthlyData).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, []);

  const handlePDFExport = useCallback((wasteTypes, dateFiltered, dateRange, customDateFrom, customDateTo) => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(22, 163, 74);
    doc.text('WASTE-ED Waste Collection Report', 14, 22);

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);

    let dateRangeLabel;
    if (dateRange === 'custom') {
      dateRangeLabel = `Period: ${customDateFrom || 'start'} to ${customDateTo || 'end'}`;
    } else if (dateRange === 'today') dateRangeLabel = 'Period: Today';
    else if (dateRange === 'week') dateRangeLabel = 'Period: Last 7 days';
    else if (dateRange === 'month') dateRangeLabel = 'Period: This month';
    else if (dateRange === 'year') dateRangeLabel = 'Period: This year';
    else dateRangeLabel = 'Period: All time';

    const typeLabels = [
      wasteTypes.recyclable && 'Recyclable',
      wasteTypes.biodegradable && 'Wet Wastes',
      wasteTypes.nonBiodegradable && 'Dry Wastes'
    ].filter(Boolean).join(', ');

    doc.text(dateRangeLabel, 14, 30);
    doc.text(`Types: ${typeLabels}`, 14, 36);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

    // Build columns based on selected types
    const head = ['Date', 'Time'];
    if (wasteTypes.recyclable) head.push('Recyclable (pcs)');
    if (wasteTypes.biodegradable) head.push('Wet Wastes (pcs)');
    if (wasteTypes.nonBiodegradable) head.push('Dry Wastes (pcs)');
    head.push('Total (pcs)');

    // Build rows
    let tableData;
    let totals = { recyclable: 0, biodegradable: 0, nonBiodegradable: 0 };

    if (viewMode === 'monthly') {
      const aggregated = aggregateForExport(dateFiltered);
      tableData = aggregated.map(record => {
        // Only accumulate totals for selected types
        if (wasteTypes.recyclable) totals.recyclable += record.recyclable || 0;
        if (wasteTypes.biodegradable) totals.biodegradable += record.biodegradable || 0;
        if (wasteTypes.nonBiodegradable) totals.nonBiodegradable += record.nonBiodegradable || 0;
        
        const selectedTotal =
          (wasteTypes.recyclable ? record.recyclable || 0 : 0) +
          (wasteTypes.biodegradable ? record.biodegradable || 0 : 0) +
          (wasteTypes.nonBiodegradable ? record.nonBiodegradable || 0 : 0);
        const row = [formatDate(record.date), '-'];
        if (wasteTypes.recyclable) row.push(formatCount(record.recyclable));
        if (wasteTypes.biodegradable) row.push(formatCount(record.biodegradable));
        if (wasteTypes.nonBiodegradable) row.push(formatCount(record.nonBiodegradable));
        row.push(formatCount(selectedTotal));
        return row;
      });
    } else {
      // Daily — expand raw records into per-type rows, then filter
      tableData = [];
      dateFiltered.forEach(record => {
        const timeStr = record.recordedAt || record.createdAt 
          ? new Date(record.recordedAt || record.createdAt).toLocaleTimeString('en-US', { 
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
            })
          : '-';
        
        if (wasteTypes.recyclable && (record.recyclable || 0) > 0) {
          totals.recyclable += record.recyclable;
          tableData.push([
            new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            timeStr,
            formatCount(record.recyclable),
            ...(wasteTypes.biodegradable ? ['-'] : []),
            ...(wasteTypes.nonBiodegradable ? ['-'] : []),
            formatCount(record.recyclable)
          ]);
        }
        if (wasteTypes.biodegradable && (record.biodegradable || 0) > 0) {
          totals.biodegradable += record.biodegradable;
          tableData.push([
            new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            timeStr,
            ...(wasteTypes.recyclable ? ['-'] : []),
            formatCount(record.biodegradable),
            ...(wasteTypes.nonBiodegradable ? ['-'] : []),
            formatCount(record.biodegradable)
          ]);
        }
        if (wasteTypes.nonBiodegradable && (record.nonBiodegradable || 0) > 0) {
          totals.nonBiodegradable += record.nonBiodegradable;
          tableData.push([
            new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            timeStr,
            ...(wasteTypes.recyclable ? ['-'] : []),
            ...(wasteTypes.biodegradable ? ['-'] : []),
            formatCount(record.nonBiodegradable),
            formatCount(record.nonBiodegradable)
          ]);
        }
      });
    }

    // Totals row
    const grandTotal =
      (wasteTypes.recyclable ? totals.recyclable : 0) +
      (wasteTypes.biodegradable ? totals.biodegradable : 0) +
      (wasteTypes.nonBiodegradable ? totals.nonBiodegradable : 0);
    const totalsRow = ['TOTAL', ''];
    if (wasteTypes.recyclable) totalsRow.push(formatCount(totals.recyclable));
    if (wasteTypes.biodegradable) totalsRow.push(formatCount(totals.biodegradable));
    if (wasteTypes.nonBiodegradable) totalsRow.push(formatCount(totals.nonBiodegradable));
    totalsRow.push(formatCount(grandTotal));
    tableData.push(totalsRow);

    autoTable(doc, {
      head: [head],
      body: tableData,
      startY: 50,
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [243, 244, 246] },
    });

    const fileName = `waste-report-${viewMode}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }, [viewMode, formatDate, formatCount, aggregateForExport]);

  const handleExcelExport = useCallback((wasteTypes, dateFiltered) => {
    if (!dateFiltered || dateFiltered.length === 0) {
      console.warn('No data available for export');
      return;
    }

    let exportRows = [];
    let totals = { recyclable: 0, biodegradable: 0, nonBiodegradable: 0 };

    if (viewMode === 'daily') {
      // Expand each raw record into individual type rows, filtered by wasteTypes
      dateFiltered.forEach(record => {
        const dateStr = new Date(record.date).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        const timeStr = record.recordedAt || record.createdAt 
          ? new Date(record.recordedAt || record.createdAt).toLocaleTimeString('en-US', { 
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
            })
          : '-';
        
        if (wasteTypes.recyclable && (record.recyclable || 0) > 0) {
          totals.recyclable += record.recyclable;
          exportRows.push({
            Date: dateStr,
            Time: timeStr,
            Type: 'Recyclable',
            'Quantity (pcs)': record.recyclable,
            'Coupon Taken': Math.floor(record.recyclable * 0.5)
          });
        }
        if (wasteTypes.biodegradable && (record.biodegradable || 0) > 0) {
          totals.biodegradable += record.biodegradable;
          exportRows.push({
            Date: dateStr,
            Time: timeStr,
            Type: 'Wet Wastes',
            'Quantity (pcs)': record.biodegradable,
            'Coupon Taken': 0
          });
        }
        if (wasteTypes.nonBiodegradable && (record.nonBiodegradable || 0) > 0) {
          totals.nonBiodegradable += record.nonBiodegradable;
          exportRows.push({
            Date: dateStr,
            Time: timeStr,
            Type: 'Dry Wastes',
            'Quantity (pcs)': record.nonBiodegradable,
            'Coupon Taken': 0
          });
        }
      });

      const grandTotal =
        (wasteTypes.recyclable ? totals.recyclable : 0) +
        (wasteTypes.biodegradable ? totals.biodegradable : 0) +
        (wasteTypes.nonBiodegradable ? totals.nonBiodegradable : 0);

      exportRows.push({ Date: 'TOTAL', Time: '', Type: '', 'Quantity (pcs)': grandTotal, 'Coupon Taken': '' });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Waste Data');
      XLSX.writeFile(wb, `waste-report-daily-${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    // Monthly view — one aggregated row per month, columns filtered by wasteTypes
    const aggregated = aggregateForExport(dateFiltered);

    aggregated.forEach(record => {
      const row = { Date: formatDate(record.date) };
      
      if (wasteTypes.recyclable) {
        totals.recyclable += record.recyclable || 0;
        row['Recyclable (pcs)'] = record.recyclable || 0;
      }
      if (wasteTypes.biodegradable) {
        totals.biodegradable += record.biodegradable || 0;
        row['Wet Wastes (pcs)'] = record.biodegradable || 0;
      }
      if (wasteTypes.nonBiodegradable) {
        totals.nonBiodegradable += record.nonBiodegradable || 0;
        row['Dry Wastes (pcs)'] = record.nonBiodegradable || 0;
      }
      
      exportRows.push(row);
    });

    const totalsRow = { Date: 'TOTAL' };
    if (wasteTypes.recyclable) totalsRow['Recyclable (pcs)'] = totals.recyclable;
    if (wasteTypes.biodegradable) totalsRow['Wet Wastes (pcs)'] = totals.biodegradable;
    if (wasteTypes.nonBiodegradable) totalsRow['Dry Wastes (pcs)'] = totals.nonBiodegradable;
    exportRows.push(totalsRow);

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Waste Data');
    XLSX.writeFile(wb, `waste-report-monthly-${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [viewMode, formatDate, aggregateForExport]);

  // Unified export handler
  const handleExport = useCallback((options) => {
    const { format, includeTypes, dateRange, customDateFrom, customDateTo } = options;

    // Map modal includeTypes to internal keys
    // Use explicit checks to handle false values correctly
    const wasteTypes = {
      recyclable: includeTypes?.recyclable !== undefined ? includeTypes.recyclable : true,
      biodegradable: includeTypes?.wet !== undefined ? includeTypes.wet : true,
      nonBiodegradable: includeTypes?.dry !== undefined ? includeTypes.dry : true
    };

    // Apply the export modal's date range to the raw fetched data
    const dateFiltered = applyExportDateFilter(wasteData, dateRange, customDateFrom, customDateTo);

    if (format === 'excel') {
      handleExcelExport(wasteTypes, dateFiltered);
    } else if (format === 'pdf') {
      handlePDFExport(wasteTypes, dateFiltered, dateRange, customDateFrom, customDateTo);
    }
  }, [wasteData, applyExportDateFilter, handleExcelExport, handlePDFExport]);

  // Pagination handlers (memoized)
  const scrollToTop = useCallback(() => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const goToPage = useCallback((page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    scrollToTop();
  }, [totalPages, scrollToTop]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
    scrollToTop();
  }, [scrollToTop]);

  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
    scrollToTop();
  }, [totalPages, scrollToTop]);

  // Memoize UI size class
  const uiSizeClass = useMemo(() => 
    `ui-size-${preferences?.uiSize || 'medium'}`,
    [preferences?.uiSize]
  );

  return (
    <div className={`waste-table-container ${uiSizeClass}`}>

      {/* Filter Controls */}
      <div className="filter-controls">
        <div className="filter-row">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <div className="date-input-group">
              <label htmlFor="dateFrom">From:</label>
              <DatePicker
                value={dateFromObj}
                onChange={(newValue) => setDateFromObj(newValue)}
                enableAccessibleFieldDOMStructure={false}
                slots={{
                  textField: TextField
                }}
                slotProps={{
                  textField: {
                    size: 'small',
                    className: 'date-picker-input'
                  }
                }}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="dateTo">To:</label>
              <DatePicker
                value={dateToObj}
                onChange={(newValue) => setDateToObj(newValue)}
                enableAccessibleFieldDOMStructure={false}
                slots={{
                  textField: TextField
                }}
                slotProps={{
                  textField: {
                    size: 'small',
                    className: 'date-picker-input'
                  }
                }}
              />
            </div>
          </LocalizationProvider>
          
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'daily' ? 'active' : ''}`}
              onClick={() => setViewMode('daily')}
            >
              Daily
            </button>
            <button
              className={`toggle-btn ${viewMode === 'monthly' ? 'active' : ''}`}
              onClick={() => setViewMode('monthly')}
            >
              Monthly
            </button>
          </div>
          
          {/* Type Filter (only for daily view) */}
          {viewMode === 'daily' && (
            <div className="type-filter">
              <label htmlFor="typeFilter">Filter by Type:</label>
              <select 
                id="typeFilter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="type-filter-select"
              >
                <option value="all">All Waste Types</option>
                <option value="recyclable">Recyclable Wastes Only</option>
                <option value="biodegradable">Wet Wastes Only</option>
                <option value="nonBiodegradable">Dry Wastes Only</option>
              </select>
            </div>
          )}
          
          <button
            className="export-pdf-btn"
            onClick={() => setShowExportModal(true)}
            disabled={loading || processedData.length === 0}
            title="Export data"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Export Data</span>
          </button>
        </div>

      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Waste Records"
      />

      {/* Error Display */}
      {error && !dismissedError && (
        <div className="error-container" role="alert">
          <div className="error-card">
            <div className="error-header">
              <h2 className="error-title">Data Loading Error</h2>
              <button
                className="error-close"
                onClick={() => setDismissedError(true)}
                aria-label="Dismiss error message"
              >
                ✕
              </button>
            </div>
            <p className="error-message">{error.message}</p>
            <details className="error-details">
              <summary>Technical Details</summary>
              <p>Error: {error.details}</p>
              <p>Time: {new Date(error.timestamp).toLocaleString()}</p>
            </details>
            <div className="error-actions">
              <button
                className="btn-primary"
                onClick={refetch}
              >
                <span className="btn-icon">🔄</span>
                <span className="btn-text">Try Again</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Section */}
      <section className="stats-section" aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="visually-hidden">Waste Collection Statistics</h2>
        <div className="stats-grid" role="group" aria-label="Waste statistics summary">
          <div className="stat-card recyclable">
            <div className="stat-header">
              <span className="stat-icon" aria-hidden="true">♻️</span>
              <span className="stat-trend" aria-hidden="true">📈</span>
            </div>
            <div className="stat-content">
              <div className="stat-value">
                <span className="cell-number">{statistics.recyclable}</span>
              </div>
              <div className="stat-label">Recyclable Wastes</div>

            </div>
          </div>

          <div className="stat-card biodegradable">
            <div className="stat-header">
              <span className="stat-icon" aria-hidden="true">🍃</span>
              <span className="stat-trend" aria-hidden="true">📈</span>
            </div>
            <div className="stat-content">
              <div className="stat-value">
                <span className="cell-number">{statistics.biodegradable}</span>
              </div>
              <div className="stat-label">Wet Wastes</div>

            </div>
          </div>

          <div className="stat-card non-biodegradable">
            <div className="stat-header">
              <span className="stat-icon" aria-hidden="true">🗑️</span>
              <span className="stat-trend" aria-hidden="true">📈</span>
            </div>
            <div className="stat-content">
              <div className="stat-value">
                <span className="cell-number">{statistics.nonBiodegradable}</span>
              </div>
              <div className="stat-label">Dry Wastes</div>

            </div>
          </div>

          <div className="stat-card total">
            <div className="stat-header">
              <span className="stat-icon" aria-hidden="true">📊</span>
              <span className="stat-trend" aria-hidden="true">📈</span>
            </div>
            <div className="stat-content">
              <div className="stat-value">
                <span className="cell-number">{statistics.total}</span>
              </div>
              <div className="stat-label">Total Waste</div>

            </div>
          </div>
        </div>
      </section>

      {/* Table Section */}
      <main className="table-section" aria-labelledby="table-heading" ref={tableRef}>
        <div className="table-container">
          <div className="table-header-section">
            <h2 className="table-section-title" id="table-heading">
              <span className="section-icon" aria-hidden="true">📋</span>
              Waste Collection Records
            </h2>
            <div className="table-actions">
              <button
                className="refresh-btn"
                onClick={refetch}
                disabled={loading}
                aria-label="Refresh data"
                title="Refresh data"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={loading ? 'spinning' : ''}
                >
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="m20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
              </button>
              <div className="table-summary">
                Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} {viewMode === 'monthly' ? 'months' : 'records'}
              </div>
            </div>
          </div>

          {processedData.length === 0 ? (
            <div className="no-data" role="status">
              <div className="no-data-content">
                <div className="no-data-icon" aria-hidden="true">📄</div>
                <h3 className="no-data-title">No Records Found</h3>
                <p className="no-data-description">
                  No waste collection data is currently available. Please check back later or contact your administrator.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="waste-table" role="table" aria-label="Waste collection data">
                <thead>
                  <tr role="row">
                    <th role="columnheader">
                      <div className="column-header sortable" onClick={() => handleSort('date')} title="Click to sort">
                        {sortBy === 'date' && (
                          <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                        <span className="column-icon" aria-hidden="true">📅</span>
                        <span className="column-text">Date</span>
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header sortable" onClick={() => handleSort('time')} title="Click to sort">
                        {sortBy === 'time' && (
                          <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                        <span className="column-icon" aria-hidden="true">🕒</span>
                        <span className="column-text">Time</span>
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header sortable" onClick={() => handleSort('type')} title="Click to sort">
                        <span className="column-icon" aria-hidden="true">🗂️</span>
                        <span className="column-text">Type</span>
                        {sortBy === 'type' && (
                          <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header sortable" onClick={() => handleSort('quantity')} title="Click to sort">
                        {sortBy === 'quantity' && (
                          <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                        <span className="column-icon" aria-hidden="true">📦</span>
                        <span className="column-text">Quantity (pcs)</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    // Show skeleton rows while loading
                    [...Array(itemsPerPage)].map((_, i) => <SkeletonRow key={i} />)
                  ) : (
                    paginatedData.map((record, index) => {
                    const globalIndex = startIndex + index;
                    const isMonthly = viewMode === 'monthly';
                    
                    // For monthly view, show aggregated data
                    if (isMonthly) {
                      const totalCount = (record.recyclable || 0) +
                                         (record.biodegradable || 0) +
                                         (record.nonBiodegradable || 0);
                      return (
                        <tr
                          key={record.id || globalIndex}
                          role="row"
                          className={globalIndex % 2 === 0 ? 'even' : 'odd'}
                        >
                          <td role="gridcell" data-label="Date">
                            <div className="cell-content">
                              <span className="cell-icon" aria-hidden="true">📅</span>
                              <span className="cell-text">{formatDate(record.date)}</span>
                            </div>
                          </td>
                          <td role="gridcell" data-label="Time">
                            <div className="cell-content">
                              <span className="cell-text">-</span>
                            </div>
                          </td>
                          <td role="gridcell" data-label="Type">
                            <div className="cell-content">
                              <span className="cell-text">Monthly Total</span>
                            </div>
                          </td>
                          <td role="gridcell" data-label="Quantity">
                            <div className="cell-content number-cell">
                              <span className="cell-number">{formatCount(totalCount)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    // For daily view, show individual type records
                    const timeStr = record.time ? new Date(record.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '-';
                    return (
                      <tr
                        key={record.id || globalIndex}
                        role="row"
                        className={globalIndex % 2 === 0 ? 'even' : 'odd'}
                      >
                        <td role="gridcell" data-label="Date">
                          <div className="cell-content">
                            <span className="cell-icon" aria-hidden="true">📅</span>
                            <span className="cell-text">{formatDate(record.date)}</span>
                          </div>
                        </td>
                        <td role="gridcell" data-label="Time">
                          <div className="cell-content">
                            <span className="cell-icon" aria-hidden="true">🕒</span>
                            <span className="cell-text">{timeStr}</span>
                          </div>
                        </td>
                        <td role="gridcell" data-label="Type">
                          <div className="cell-content">
                            <span className="cell-text">{record.type}</span>
                          </div>
                        </td>
                        <td role="gridcell" data-label="Quantity">
                          <div className="cell-content number-cell">
                            <span className="cell-icon" aria-hidden="true">📦</span>
                            <span className="cell-number">{record.quantityInPcs || 0} pcs</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <div className="pagination-info">
                  Page {currentPage} of {totalPages}
                </div>
                <div className={`pagination-controls ${isCompactPagination ? 'compact' : ''}`}>
                  {isCompactPagination ? (
                    <>
                      <button
                        className="pagination-btn"
                        onClick={goToPrevPage}
                        disabled={currentPage === 1}
                        aria-label="Go to previous page"
                      >
                        Prev
                      </button>
                      <div className="pagination-compact-status" aria-live="polite">
                        {currentPage} / {totalPages}
                      </div>
                      <button
                        className="pagination-btn"
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        aria-label="Go to next page"
                      >
                        Next
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="pagination-btn"
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        aria-label="Go to first page"
                      >
                        ⏮️
                      </button>
                      <button
                        className="pagination-btn"
                        onClick={goToPrevPage}
                        disabled={currentPage === 1}
                        aria-label="Go to previous page"
                      >
                        ⬅️
                      </button>

                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                            onClick={() => goToPage(pageNum)}
                            aria-label={`Go to page ${pageNum}`}
                            aria-current={currentPage === pageNum ? 'page' : undefined}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        className="pagination-btn"
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        aria-label="Go to next page"
                      >
                        ➡️
                      </button>
                      <button
                        className="pagination-btn"
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        aria-label="Go to last page"
                      >
                        ⏭️
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default memo(WasteTable);
