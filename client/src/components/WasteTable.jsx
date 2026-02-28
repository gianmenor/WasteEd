import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { API_ENDPOINTS } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import ExportModal from './ExportModal';

// Skeleton row component
const SkeletonRow = memo(() => (
  <tr className="animate-pulse border-b border-gray-200">
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
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
  const tableRef = useRef(null);
  const [viewMode, setViewMode] = useState('daily');
  const [dateFromObj, setDateFromObj] = useState(null);
  const [dateToObj, setDateToObj] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [typeFilter, setTypeFilter] = useState('all'); // all, recyclable, biodegradable, nonBiodegradable
  const [showExportModal, setShowExportModal] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);

  
  // Convert Date objects to strings for API
  const dateFrom = useMemo(() => 
    dateFromObj ? dateFromObj.toISOString().split('T')[0] : '',
    [dateFromObj]
  );
  const dateTo = useMemo(() => 
    dateToObj ? dateToObj.toISOString().split('T')[0] : '',
    [dateToObj]
  );

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

  // Format date based on view mode
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

  // Process data based on view mode (memoized)
  const processedData = useMemo(() => {
    let data;
    
    if (viewMode === 'monthly') {
      data = aggregateByMonth(wasteData);
    } else {
      // Transform each record into individual rows per waste type
      const individualRows = [];
      wasteData.forEach(record => {
        // Add recyclable row if quantity > 0
        if (record.recyclable > 0) {
          individualRows.push({
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
          individualRows.push({
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
          individualRows.push({
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
      
      // Compile same-day records of the same type into single rows
      const groupedMap = {};
      individualRows.forEach(row => {
        const dateStr = new Date(row.date).toDateString();
        const key = `${dateStr}-${row.originalType}`;
        
        if (!groupedMap[key]) {
          groupedMap[key] = {
            ...row,
            ids: [row.id]
          };
        } else {
          // Sum quantities
          groupedMap[key].quantityInPcs += row.quantityInPcs;
          groupedMap[key].couponTaken += row.couponTaken;
          groupedMap[key].ids.push(row.id);
          
          // Keep the most recent time
          const existingTime = new Date(groupedMap[key].time || 0).getTime();
          const newTime = new Date(row.time || 0).getTime();
          if (newTime > existingTime) {
            groupedMap[key].time = row.time;
          }
        }
      });
      
      // Convert grouped map to array
      data = Object.values(groupedMap).map(record => ({
        ...record,
        id: record.ids.join(',') // Combine IDs for unique key
      }));
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
    
    // Apply search filtering
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      data = data.filter(record => {
        const dateStr = formatDate(record.date).toLowerCase();
        const typeStr = (record.type || '').toLowerCase();
        return dateStr.includes(query) || typeStr.includes(query);
      });
    }
    
    return data;
  }, [viewMode, wasteData, aggregateByMonth, sortBy, sortOrder, typeFilter, searchQuery, formatDate]);

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
      // Daily — expand raw records into per-type rows, grouped by date+time to avoid redundancy
      tableData = [];
      dateFiltered.forEach(record => {
        const dateStr = new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const timeStr = record.recordedAt || record.createdAt 
          ? new Date(record.recordedAt || record.createdAt).toLocaleTimeString('en-US', { 
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
            })
          : '-';
        
        const typeRows = [];
        if (wasteTypes.recyclable && (record.recyclable || 0) > 0) {
          totals.recyclable += record.recyclable;
          typeRows.push({
            type: 'recyclable',
            row: [
              dateStr,
              timeStr,
              formatCount(record.recyclable),
              ...(wasteTypes.biodegradable ? ['-'] : []),
              ...(wasteTypes.nonBiodegradable ? ['-'] : []),
              formatCount(record.recyclable)
            ]
          });
        }
        if (wasteTypes.biodegradable && (record.biodegradable || 0) > 0) {
          totals.biodegradable += record.biodegradable;
          typeRows.push({
            type: 'biodegradable',
            row: [
              dateStr,
              timeStr,
              ...(wasteTypes.recyclable ? ['-'] : []),
              formatCount(record.biodegradable),
              ...(wasteTypes.nonBiodegradable ? ['-'] : []),
              formatCount(record.biodegradable)
            ]
          });
        }
        if (wasteTypes.nonBiodegradable && (record.nonBiodegradable || 0) > 0) {
          totals.nonBiodegradable += record.nonBiodegradable;
          typeRows.push({
            type: 'nonBiodegradable',
            row: [
              dateStr,
              timeStr,
              ...(wasteTypes.recyclable ? ['-'] : []),
              ...(wasteTypes.biodegradable ? ['-'] : []),
              formatCount(record.nonBiodegradable),
              formatCount(record.nonBiodegradable)
            ]
          });
        }
        
        // Show date+time only on first row, leave blank for others
        typeRows.forEach((typeRow, index) => {
          if (index > 0) {
            typeRow.row[0] = ''; // Blank date for subsequent rows
            typeRow.row[1] = ''; // Blank time for subsequent rows
          }
          tableData.push(typeRow.row);
        });
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
      // Group by date+time to avoid redundancy
      dateFiltered.forEach(record => {
        const dateStr = new Date(record.date).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        const timeStr = record.recordedAt || record.createdAt 
          ? new Date(record.recordedAt || record.createdAt).toLocaleTimeString('en-US', { 
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
            })
          : '-';
        
        const typeRows = [];
        if (wasteTypes.recyclable && (record.recyclable || 0) > 0) {
          totals.recyclable += record.recyclable;
          typeRows.push({
            Date: dateStr,
            Time: timeStr,
            Type: 'Recyclable',
            'Quantity (pcs)': record.recyclable,
            'Coupon Taken': Math.floor(record.recyclable * 0.5)
          });
        }
        if (wasteTypes.biodegradable && (record.biodegradable || 0) > 0) {
          totals.biodegradable += record.biodegradable;
          typeRows.push({
            Date: dateStr,
            Time: timeStr,
            Type: 'Wet Wastes',
            'Quantity (pcs)': record.biodegradable,
            'Coupon Taken': 0
          });
        }
        if (wasteTypes.nonBiodegradable && (record.nonBiodegradable || 0) > 0) {
          totals.nonBiodegradable += record.nonBiodegradable;
          typeRows.push({
            Date: dateStr,
            Time: timeStr,
            Type: 'Dry Wastes',
            'Quantity (pcs)': record.nonBiodegradable,
            'Coupon Taken': 0
          });
        }
        
        // Show date+time only on first row, leave blank for others
        typeRows.forEach((row, index) => {
          if (index > 0) {
            row.Date = '';
            row.Time = '';
          }
          exportRows.push(row);
        });
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

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setDateFromObj(null);
    setDateToObj(null);
    setTypeFilter('all');
    setSearchQuery('');
    setViewMode('daily');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Waste Management</h1>
              <p className="mt-1 text-sm text-gray-600">Track and analyze waste collection records</p>
            </div>
            <button
              onClick={() => setShowExportModal(true)}
              disabled={loading || processedData.length === 0}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Data
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-4">
            {/* Row 1: Date Filters & View Mode */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">From Date</label>
                  <DatePicker
                    value={dateFromObj}
                    onChange={(newValue) => setDateFromObj(newValue)}
                    maxDate={new Date()}
                    enableAccessibleFieldDOMStructure={false}
                    slots={{ textField: TextField }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: {
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': { borderColor: '#10b981' },
                            '&.Mui-focused fieldset': { borderColor: '#10b981' }
                          }
                        }
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">To Date</label>
                  <DatePicker
                    value={dateToObj}
                    onChange={(newValue) => setDateToObj(newValue)}
                    maxDate={new Date()}
                    enableAccessibleFieldDOMStructure={false}
                    slots={{ textField: TextField }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: {
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': { borderColor: '#10b981' },
                            '&.Mui-focused fieldset': { borderColor: '#10b981' }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </LocalizationProvider>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">View Mode</label>
                <div className="flex rounded-lg border border-gray-300 p-1 bg-gray-50">
                  <button
                    onClick={() => setViewMode('daily')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                      viewMode === 'daily'
                        ? 'bg-white text-emerald-600 shadow-sm'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setViewMode('monthly')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                      viewMode === 'monthly'
                        ? 'bg-white text-emerald-600 shadow-sm'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Type Filter, Search & Clear */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {viewMode === 'daily' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Waste Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="all">All Types</option>
                    <option value="recyclable">Recyclable Only</option>
                    <option value="biodegradable">Wet Wastes Only</option>
                    <option value="nonBiodegradable">Dry Wastes Only</option>
                  </select>
                </div>
              )}
              
              <div className={`space-y-2 ${viewMode === 'monthly' ? 'md:col-span-2' : ''}`}>
                <label className="block text-sm font-medium text-gray-700">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by date or type..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Clear Filters
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
          title="Export Waste Records"
        />

        {/* Error Display */}
        {error && !dismissedError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800">Data Loading Error</h3>
                <p className="mt-1 text-sm text-red-700">{error.message}</p>
                <details className="mt-2">
                  <summary className="text-sm text-red-600 cursor-pointer hover:text-red-800">Technical Details</summary>
                  <div className="mt-2 text-xs text-red-600 space-y-1">
                    <p>Error: {error.details}</p>
                    <p>Time: {new Date(error.timestamp).toLocaleString()}</p>
                  </div>
                </details>
                <button
                  onClick={refetch}
                  className="mt-3 inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Try Again
                </button>
              </div>
              <button
                onClick={() => setDismissedError(true)}
                className="ml-4 text-red-400 hover:text-red-600 transition-colors duration-200"
                aria-label="Dismiss error"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Statistics Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-lg">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{statistics.recyclable.toLocaleString()}</div>
            <div className="text-sm font-medium text-gray-600 mt-1">Recyclable Wastes</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{statistics.biodegradable.toLocaleString()}</div>
            <div className="text-sm font-medium text-gray-600 mt-1">Wet Wastes</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{statistics.nonBiodegradable.toLocaleString()}</div>
            <div className="text-sm font-medium text-gray-600 mt-1">Dry Wastes</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{statistics.total.toLocaleString()}</div>
            <div className="text-sm font-medium text-gray-600 mt-1">Total Waste</div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200" ref={tableRef}>
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Waste Collection Records</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={refetch}
                  disabled={loading}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  aria-label="Refresh data"
                >
                  <svg
                    className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                <span className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} {viewMode === 'monthly' ? 'months' : 'records'}
                </span>
              </div>
            </div>
          </div>

          {processedData.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No Records Found</h3>
              <p className="mt-2 text-sm text-gray-500">
                No waste collection data is currently available. Try adjusting your filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        onClick={() => handleSort('date')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {sortBy === 'date' && (
                            <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          )}
                          <span>Date</span>
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('time')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {sortBy === 'time' && (
                            <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          )}
                          <span>Time</span>
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('type')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          <span>Type</span>
                          {sortBy === 'type' && (
                            <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('quantity')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {sortBy === 'quantity' && (
                            <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          )}
                          <span>Quantity (pcs)</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      [...Array(itemsPerPage)].map((_, i) => <SkeletonRow key={i} />)
                    ) : (
                      paginatedData.map((record, index) => {
                        const globalIndex = startIndex + index;
                        const isMonthly = viewMode === 'monthly';
                        
                        if (isMonthly) {
                          const totalCount = (record.recyclable || 0) +
                                             (record.biodegradable || 0) +
                                             (record.nonBiodegradable || 0);
                          return (
                            <tr key={record.id || globalIndex} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(record.date)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                Monthly Total
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {formatCount(totalCount)}
                              </td>
                            </tr>
                          );
                        }
                        
                        const timeStr = record.time ? new Date(record.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '-';
                        return (
                          <tr key={record.id || globalIndex} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(record.date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {timeStr}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {record.quantityInPcs || 0} pcs
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            
              {/* Pagination Controls */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Show:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-sm text-gray-700">per page</span>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="First page"
                      >
                        «
                      </button>
                      <button
                        onClick={goToPrevPage}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Previous page"
                      >
                        ‹
                      </button>

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
                            onClick={() => goToPage(pageNum)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                              currentPage === pageNum
                                ? 'bg-emerald-600 text-white'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                            aria-label={`Page ${pageNum}`}
                            aria-current={currentPage === pageNum ? 'page' : undefined}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Next page"
                      >
                        ›
                      </button>
                      <button
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Last page"
                      >
                        »
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(WasteTable);
