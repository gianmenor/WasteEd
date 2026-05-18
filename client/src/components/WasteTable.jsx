import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RecyclingOutlinedIcon from '@mui/icons-material/RecyclingOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined';
import FirstPageOutlinedIcon from '@mui/icons-material/FirstPageOutlined';
import NavigateBeforeOutlinedIcon from '@mui/icons-material/NavigateBeforeOutlined';
import NavigateNextOutlinedIcon from '@mui/icons-material/NavigateNextOutlined';
import LastPageOutlinedIcon from '@mui/icons-material/LastPageOutlined';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { API_ENDPOINTS } from '../config/api';
import ExportModal from './ExportModal';
import { endOfLocalDay, formatLocalDateForApi, getLocalDateKey, parseLocalDate, startOfLocalDay } from '../utils/date';

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
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [typeFilter, setTypeFilter] = useState('all'); // all, recyclable, biodegradable, nonBiodegradable
  const [showExportModal, setShowExportModal] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);

  
  // Convert Date objects to strings for API
  const dateFrom = useMemo(() => 
    dateFromObj ? formatLocalDateForApi(dateFromObj) : '',
    [dateFromObj]
  );
  const dateTo = useMemo(() => 
    dateToObj ? formatLocalDateForApi(dateToObj) : '',
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

  const today = useMemo(() => new Date(), []);

  const maxFromDate = useMemo(() => {
    if (dateToObj && dateToObj < today) {
      return dateToObj;
    }

    return today;
  }, [dateToObj, today]);

  const handleFromDateChange = useCallback((newValue) => {
    setDateFromObj(newValue);

    if (newValue && dateToObj && startOfLocalDay(newValue) > endOfLocalDay(dateToObj)) {
      setDateToObj(null);
    }
  }, [dateToObj]);

  const handleToDateChange = useCallback((newValue) => {
    setDateToObj(newValue);

    if (newValue && dateFromObj && endOfLocalDay(newValue) < startOfLocalDay(dateFromObj)) {
      setDateFromObj(null);
    }
  }, [dateFromObj]);

  // Keep waste records live so the table updates without manual refresh.
  useEffect(() => {
    const eventSource = new EventSource(API_ENDPOINTS.BIN_NOTIFICATIONS_STREAM);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'WASTE_INSERTED') {
          refetch();
        }
      } catch (parseError) {
        console.error('Waste table SSE parse error:', parseError);
      }
    };

    eventSource.onerror = () => {
      // Keep the stream silent here; React Query still handles recovery.
    };

    return () => {
      eventSource.close();
    };
  }, [refetch]);

  // Aggregate data by month (memoized)
  const aggregateByMonth = useCallback((data) => {
    const monthlyData = {};
    
    data.forEach(record => {
      const date = parseLocalDate(record.date);
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
    const date = parseLocalDate(dateString);
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

  const formatTime = useCallback((timeString) => {
    if (!timeString) return '-';
    const time = new Date(timeString);
    if (Number.isNaN(time.getTime())) return '-';
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }, []);

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
        const dateStr = parseLocalDate(row.date).toDateString();
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
    
    return data;
  }, [viewMode, wasteData, aggregateByMonth, sortBy, sortOrder, typeFilter, formatDate]);

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
  }, [viewMode, dateFrom, dateTo, sortBy, sortOrder, typeFilter]);

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
      const d = parseLocalDate(record.date);
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
      const date = parseLocalDate(record.date);
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

  // Helper: aggregate raw records by day and type for daily exports
  const aggregateDailyByTypeForExport = useCallback((rawData) => {
    const grouped = {};

    rawData.forEach(record => {
      const dateObj = parseLocalDate(record.date);
      const dateKey = getLocalDateKey(dateObj);

      if ((record.recyclable || 0) > 0) {
        const key = `${dateKey}-recyclable`;
        if (!grouped[key]) {
          grouped[key] = {
            date: dateObj,
            type: 'recyclable',
            quantity: 0,
          };
        }
        grouped[key].quantity += record.recyclable || 0;
      }

      if ((record.biodegradable || 0) > 0) {
        const key = `${dateKey}-biodegradable`;
        if (!grouped[key]) {
          grouped[key] = {
            date: dateObj,
            type: 'biodegradable',
            quantity: 0,
          };
        }
        grouped[key].quantity += record.biodegradable || 0;
      }

      if ((record.nonBiodegradable || 0) > 0) {
        const key = `${dateKey}-nonBiodegradable`;
        if (!grouped[key]) {
          grouped[key] = {
            date: dateObj,
            type: 'nonBiodegradable',
            quantity: 0,
          };
        }
        grouped[key].quantity += record.nonBiodegradable || 0;
      }
    });

    return Object.values(grouped).sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;

      const typeOrder = {
        recyclable: 0,
        biodegradable: 1,
        nonBiodegradable: 2,
      };
      return typeOrder[a.type] - typeOrder[b.type];
    });
  }, []);

  // Helper: aggregate raw records by day for clean daily exports
  const aggregateDailyForExport = useCallback((rawData) => {
    const grouped = {};

    rawData.forEach(record => {
      const dateObj = parseLocalDate(record.date);
      const dateKey = getLocalDateKey(dateObj);
      const recordTime = record.recordedAt || record.createdAt || record.time;

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateObj,
          time: recordTime || null,
          recyclable: 0,
          biodegradable: 0,
          nonBiodegradable: 0,
        };
      }

      if (recordTime) {
        const existingTime = grouped[dateKey].time ? new Date(grouped[dateKey].time).getTime() : 0;
        const newTime = new Date(recordTime).getTime();
        if (newTime > existingTime) {
          grouped[dateKey].time = recordTime;
        }
      }

      grouped[dateKey].recyclable += record.recyclable || 0;
      grouped[dateKey].biodegradable += record.biodegradable || 0;
      grouped[dateKey].nonBiodegradable += record.nonBiodegradable || 0;
    });

    return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, []);

  const buildDailyExportRows = useCallback((rawData, wasteTypes) => {
    const rows = [];
    rawData.forEach(record => {
      const recordTime = record.recordedAt || record.createdAt || record.time || '';
      if (wasteTypes.recyclable && (record.recyclable || 0) > 0) {
        rows.push({
          date: record.date,
          time: recordTime,
          type: 'Recyclable',
          quantity: record.recyclable || 0,
        });
      }
      if (wasteTypes.biodegradable && (record.biodegradable || 0) > 0) {
        rows.push({
          date: record.date,
          time: recordTime,
          type: 'Wet Wastes',
          quantity: record.biodegradable || 0,
        });
      }
      if (wasteTypes.nonBiodegradable && (record.nonBiodegradable || 0) > 0) {
        rows.push({
          date: record.date,
          time: recordTime,
          type: 'Dry Wastes',
          quantity: record.nonBiodegradable || 0,
        });
      }
    });

    return rows.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      const timeA = a.time ? new Date(a.time).getTime() : 0;
      const timeB = b.time ? new Date(b.time).getTime() : 0;
      return timeB - timeA;
    });
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

    // Build columns based on selected types and view mode
    const head = viewMode === 'daily'
      ? ['Date', 'Time', 'Type', 'Quantity (pcs)']
      : ['Date', 'Time', ...(wasteTypes.recyclable ? ['Recyclable (pcs)'] : []), ...(wasteTypes.biodegradable ? ['Wet Wastes (pcs)'] : []), ...(wasteTypes.nonBiodegradable ? ['Dry Wastes (pcs)'] : []), 'Total (pcs)'];

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
      tableData = [];
      const dailyRows = buildDailyExportRows(dateFiltered, wasteTypes);

      dailyRows.forEach((record) => {
        totals.recyclable += record.type === 'Recyclable' ? record.quantity : 0;
        totals.biodegradable += record.type === 'Wet Wastes' ? record.quantity : 0;
        totals.nonBiodegradable += record.type === 'Dry Wastes' ? record.quantity : 0;

        const row = [
          formatDate(record.date),
          formatTime(record.time),
          record.type,
          formatCount(record.quantity),
        ];
        tableData.push(row);
      });
    }

    // Totals row
    const grandTotal =
      (wasteTypes.recyclable ? totals.recyclable : 0) +
      (wasteTypes.biodegradable ? totals.biodegradable : 0) +
      (wasteTypes.nonBiodegradable ? totals.nonBiodegradable : 0);
    const totalsRow = viewMode === 'daily'
      ? ['TOTAL', '', '', formatCount(grandTotal)]
      : ['TOTAL', '', ...(wasteTypes.recyclable ? [formatCount(totals.recyclable)] : []), ...(wasteTypes.biodegradable ? [formatCount(totals.biodegradable)] : []), ...(wasteTypes.nonBiodegradable ? [formatCount(totals.nonBiodegradable)] : []), formatCount(grandTotal)];
    tableData.push(totalsRow);

    // Summary block for per-type and overall totals
    const summaryLines = [];
    if (wasteTypes.recyclable) summaryLines.push(`Recyclable: ${formatCount(totals.recyclable)}`);
    if (wasteTypes.biodegradable) summaryLines.push(`Wet Wastes: ${formatCount(totals.biodegradable)}`);
    if (wasteTypes.nonBiodegradable) summaryLines.push(`Dry Wastes: ${formatCount(totals.nonBiodegradable)}`);
    summaryLines.push(`Overall Total: ${formatCount(grandTotal)}`);

    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(summaryLines.join(' | '), 14, 52);

    autoTable(doc, {
      head: [head],
      body: tableData,
      startY: 60,
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [243, 244, 246] },
    });

    const fileName = `waste-report-${viewMode}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }, [viewMode, formatDate, formatCount, aggregateForExport, aggregateDailyByTypeForExport, buildDailyExportRows]);

  const handleExcelExport = useCallback((wasteTypes, dateFiltered) => {
    if (!dateFiltered || dateFiltered.length === 0) {
      console.warn('No data available for export');
      return;
    }

    let exportRows = [];
    let totals = { recyclable: 0, biodegradable: 0, nonBiodegradable: 0 };

    if (viewMode === 'daily') {
      const dailyRows = buildDailyExportRows(dateFiltered, wasteTypes);

      dailyRows.forEach((record) => {
        if (record.type === 'Recyclable') totals.recyclable += record.quantity;
        if (record.type === 'Wet Wastes') totals.biodegradable += record.quantity;
        if (record.type === 'Dry Wastes') totals.nonBiodegradable += record.quantity;

        exportRows.push({
          Date: parseLocalDate(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
          Time: formatTime(record.time),
          Type: record.type,
          'Quantity (pcs)': record.quantity,
        });
      });

      const grandTotal =
        (wasteTypes.recyclable ? totals.recyclable : 0) +
        (wasteTypes.biodegradable ? totals.biodegradable : 0) +
        (wasteTypes.nonBiodegradable ? totals.nonBiodegradable : 0);

      exportRows.push({
        Date: 'TOTAL',
        Time: '',
        Type: '',
        'Quantity (pcs)': grandTotal,
      });

      const headers = ['Date', 'Time', 'Type', 'Quantity (pcs)'];
      const ws = XLSX.utils.json_to_sheet(exportRows, { header: headers });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Waste Data');
      XLSX.writeFile(wb, `waste-report-daily-${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    // Monthly view — one aggregated row per month, columns filtered by wasteTypes
    const aggregated = aggregateForExport(dateFiltered);

    aggregated.forEach(record => {
      const row = { Date: formatDate(record.date) };
      const rowTotal =
        (wasteTypes.recyclable ? record.recyclable || 0 : 0) +
        (wasteTypes.biodegradable ? record.biodegradable || 0 : 0) +
        (wasteTypes.nonBiodegradable ? record.nonBiodegradable || 0 : 0);

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
      row['Total (pcs)'] = rowTotal;
      
      exportRows.push(row);
    });

    const grandTotal =
      (wasteTypes.recyclable ? totals.recyclable : 0) +
      (wasteTypes.biodegradable ? totals.biodegradable : 0) +
      (wasteTypes.nonBiodegradable ? totals.nonBiodegradable : 0);

    const totalsRow = {
      Date: 'TOTAL',
      ...(wasteTypes.recyclable ? { 'Recyclable (pcs)': totals.recyclable } : {}),
      ...(wasteTypes.biodegradable ? { 'Wet Wastes (pcs)': totals.biodegradable } : {}),
      ...(wasteTypes.nonBiodegradable ? { 'Dry Wastes (pcs)': totals.nonBiodegradable } : {}),
      'Total (pcs)': grandTotal,
    };
    exportRows.push(totalsRow);

    const headers = ['Date'];
    if (wasteTypes.recyclable) headers.push('Recyclable (pcs)');
    if (wasteTypes.biodegradable) headers.push('Wet Wastes (pcs)');
    if (wasteTypes.nonBiodegradable) headers.push('Dry Wastes (pcs)');
    headers.push('Total (pcs)');

    const ws = XLSX.utils.json_to_sheet(exportRows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Waste Data');
    XLSX.writeFile(wb, `waste-report-monthly-${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [viewMode, formatDate, aggregateForExport, aggregateDailyByTypeForExport, buildDailyExportRows]);

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
                    onChange={handleFromDateChange}
                    maxDate={maxFromDate}
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
                    onChange={handleToDateChange}
                    minDate={dateFromObj || undefined}
                    maxDate={today}
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

            {/* Row 2: Type Filter & Clear */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <RefreshOutlinedIcon fontSize="small" className="mr-2" />
                  Try Again
                </button>
              </div>
              <button
                onClick={() => setDismissedError(true)}
                className="ml-4 text-red-400 hover:text-red-600 transition-colors duration-200"
                aria-label="Dismiss error"
              >
                <CloseRoundedIcon fontSize="small" />
              </button>
            </div>
          </div>
        )}

        {/* Table Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200" ref={tableRef}>
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Waste Collection Records</h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} {viewMode === 'monthly' ? 'months' : 'records'}
                </span>
              </div>
            </div>
          </div>

          {processedData.length === 0 ? (
            <div className="p-12 text-center">
              <DescriptionOutlinedIcon className="mx-auto text-gray-400" style={{ fontSize: 48 }} />
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
                            sortOrder === 'asc' ? <ArrowUpwardOutlinedIcon fontSize="inherit" /> : <ArrowDownwardOutlinedIcon fontSize="inherit" />
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
                            sortOrder === 'asc' ? <ArrowUpwardOutlinedIcon fontSize="inherit" /> : <ArrowDownwardOutlinedIcon fontSize="inherit" />
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
                            sortOrder === 'asc' ? <ArrowUpwardOutlinedIcon fontSize="inherit" /> : <ArrowDownwardOutlinedIcon fontSize="inherit" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('quantity')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {sortBy === 'quantity' && (
                            sortOrder === 'asc' ? <ArrowUpwardOutlinedIcon fontSize="inherit" /> : <ArrowDownwardOutlinedIcon fontSize="inherit" />
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

              {/* Table totals for each waste type */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 text-sm text-gray-700">
                  <div className="rounded-lg bg-white p-3 border border-gray-200">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Recyclable Total</div>
                    <div className="mt-2 text-lg font-semibold text-gray-900">{statistics.recyclable.toLocaleString()} pcs</div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-gray-200">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Wet Wastes Total</div>
                    <div className="mt-2 text-lg font-semibold text-gray-900">{statistics.biodegradable.toLocaleString()} pcs</div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-gray-200">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Dry Wastes Total</div>
                    <div className="mt-2 text-lg font-semibold text-gray-900">{statistics.nonBiodegradable.toLocaleString()} pcs</div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-gray-200">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Overall Waste Total</div>
                    <div className="mt-2 text-lg font-semibold text-gray-900">{statistics.total.toLocaleString()} pcs</div>
                  </div>
                </div>
              </div>

              {/* Pagination Controls */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
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
                    <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2">
                      <span className="text-xs text-gray-600 sm:hidden">
                        Page {currentPage} of {totalPages}
                      </span>

                      <div className="flex items-center gap-2 ml-auto sm:ml-0">
                      <button
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        className="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed items-center"
                        aria-label="First page"
                      >
                        <FirstPageOutlinedIcon fontSize="small" />
                      </button>
                      <button
                        onClick={goToPrevPage}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                        aria-label="Previous page"
                      >
                        <NavigateBeforeOutlinedIcon fontSize="small" />
                      </button>

                      <div className="hidden sm:flex items-center gap-2">
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
                      </div>

                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                        aria-label="Next page"
                      >
                        <NavigateNextOutlinedIcon fontSize="small" />
                      </button>
                      <button
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed items-center"
                        aria-label="Last page"
                      >
                        <LastPageOutlinedIcon fontSize="small" />
                      </button>
                      </div>
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
