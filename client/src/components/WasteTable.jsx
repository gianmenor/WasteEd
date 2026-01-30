import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { usePreferences } from '../contexts/PreferencesContext';
import { API_ENDPOINTS } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
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
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [typeFilter, setTypeFilter] = useState('all'); // all, recyclable, biodegradable, nonBiodegradable
  
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
    staleTime: 3 * 60 * 1000, // 3 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const error = useMemo(() => {
    if (!queryError) return null;
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
    let data = viewMode === 'monthly' ? aggregateByMonth(wasteData) : wasteData;
    
    // Apply type filtering (only for daily view)
    if (viewMode === 'daily' && typeFilter !== 'all') {
      data = data.filter(record => record[typeFilter] > 0);
    }
    
    // Apply sorting
    if (sortBy && data.length > 0) {
      data = [...data].sort((a, b) => {
        let aVal, bVal;
        
        switch (sortBy) {
          case 'date':
            aVal = new Date(a.date).getTime();
            bVal = new Date(b.date).getTime();
            break;
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
    const stats = { recyclable: 0, biodegradable: 0, nonBiodegradable: 0, total: 0, totalDays: totalItems };
    processedData.forEach(record => {
      stats.recyclable += record.recyclable || 0;
      stats.biodegradable += record.biodegradable || 0;
      stats.nonBiodegradable += record.nonBiodegradable || 0;
      stats.total += (record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0);
    });
    return stats;
  }, [processedData, totalItems]);

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

  // PDF Export handler
  const handlePDFExport = useCallback(() => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(22, 163, 74); // Primary green
    doc.text('WASTE-ED Waste Collection Report', 14, 22);
    
    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    const dateRange = dateFrom && dateTo 
      ? `Period: ${dateFrom} to ${dateTo}`
      : dateFrom
        ? `From: ${dateFrom}`
        : dateTo
          ? `Until: ${dateTo}`
          : `View: ${viewMode === 'daily' ? 'Daily Records' : 'Monthly Summary'}`;
    doc.text(dateRange, 14, 30);
    
    const filterLabel = typeFilter === 'all' ? 'All Waste Types' 
      : typeFilter === 'recyclable' ? 'Recyclable Wastes Only'
      : typeFilter === 'biodegradable' ? 'Wet Wastes Only'
      : 'Dry Wastes Only';
    doc.text(`Filter: ${filterLabel}`, 14, 36);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);
    
    // Prepare table data
    const tableData = processedData.map(record => [
      formatDate(record.date),
      formatCount(record.recyclable),
      formatCount(record.biodegradable),
      formatCount(record.nonBiodegradable),
      formatCount((record.recyclable || 0) + (record.biodegradable || 0) + (record.nonBiodegradable || 0))
    ]);
    
    // Add totals row
    tableData.push([
      'TOTAL',
      formatCount(statistics.recyclable),
      formatCount(statistics.biodegradable),
      formatCount(statistics.nonBiodegradable),
      formatCount(statistics.total)
    ]);
    
    // Generate table
    doc.autoTable({
      head: [['Date', 'Recyclable', 'Wet Wastes', 'Dry Wastes', 'Total']],
      body: tableData,
      startY: 50,
      headStyles: {
        fillColor: [22, 163, 74],
        textColor: 255,
        fontStyle: 'bold'
      },
      bodyStyles: {
        textColor: [31, 41, 55]
      },
      alternateRowStyles: {
        fillColor: [243, 244, 246]
      },
      footStyles: {
        fillColor: [220, 252, 231],
        textColor: [22, 163, 74],
        fontStyle: 'bold'
      },
      foot: [[
        `Total Records: ${totalItems}`,
        '',
        '',
        '',
        ''
      ]]
    });
    
    // Save PDF
    const fileName = `waste-report-${viewMode}-${typeFilter}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }, [processedData, formatDate, formatCount, statistics, dateFrom, dateTo, viewMode, typeFilter, totalItems]);

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
            <div className="date-filters">
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
        </div>
        
        {/* Type Filter (only for daily view) */}
        {viewMode === 'daily' && (
          <div className="filter-row" style={{ marginTop: '1rem' }}>
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
            <button
              className="export-pdf-btn"
              onClick={handlePDFExport}
              disabled={loading || processedData.length === 0}
              title="Export to PDF"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Export PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-container" role="alert">
          <div className="error-card">
            <div className="error-header">
              <h2 className="error-title">Data Loading Error</h2>
              <button
                className="error-close"
                onClick={() => setError(null)}
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
                  width="16"
                  height="16"
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
                        <span className="column-icon" aria-hidden="true">📅</span>
                        <span className="column-text">Date Collected</span>
                        {sortBy === 'date' && (
                          <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header sortable" onClick={() => handleSort('recyclable')} title="Click to sort">
                        <span className="column-icon" aria-hidden="true">♻️</span>
                        <span className="column-text">Recyclable Wastes</span>
                        {sortBy === 'recyclable' && (
                          <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header sortable" onClick={() => handleSort('biodegradable')} title="Click to sort">
                        <span className="column-icon" aria-hidden="true">🍃</span>
                        <span className="column-text">Wet Wastes</span>
                        {sortBy === 'biodegradable' && (
                          <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header sortable" onClick={() => handleSort('nonBiodegradable')} title="Click to sort">
                        <span className="column-icon" aria-hidden="true">🗑️</span>
                        <span className="column-text">Dry Wastes</span>
                        {sortBy === 'nonBiodegradable' && (
                          <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header sortable" onClick={() => handleSort('total')} title="Click to sort">
                        <span className="column-icon" aria-hidden="true">📊</span>
                        <span className="column-text">Total</span>
                        {sortBy === 'total' && (
                          <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
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
                    const totalCount = (record.recyclable || 0) +
                                       (record.biodegradable || 0) +
                                       (record.nonBiodegradable || 0);

                    return (
                      <tr
                        key={record.id || globalIndex}
                        role="row"
                        className={globalIndex % 2 === 0 ? 'even' : 'odd'}
                      >
                        <td role="gridcell">
                          <div className="cell-content">
                            <span className="cell-icon" aria-hidden="true">📅</span>
                            <span className="cell-text">{formatDate(record.date)}</span>
                          </div>
                        </td>
                        <td role="gridcell">
                          <div className="cell-content number-cell recyclable">
                            <span className="cell-icon" aria-hidden="true">♻️</span>
                            <span className="cell-number">{formatCount(record.recyclable)}</span>
                          </div>
                        </td>
                        <td role="gridcell">
                          <div className="cell-content number-cell biodegradable">
                            <span className="cell-icon" aria-hidden="true">🍃</span>
                            <span className="cell-number">{formatCount(record.biodegradable)}</span>
                          </div>
                        </td>
                        <td role="gridcell">
                          <div className="cell-content number-cell non-biodegradable">
                            <span className="cell-icon" aria-hidden="true">🗑️</span>
                            <span className="cell-number">{formatCount(record.nonBiodegradable)}</span>
                          </div>
                        </td>
                        <td role="gridcell" className="total-cell">
                          <div className="cell-content total">
                            <span className="cell-icon" aria-hidden="true">📊</span>
                            <span className="cell-number">{formatCount(totalCount)}</span>
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
                <div className="pagination-controls">
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
