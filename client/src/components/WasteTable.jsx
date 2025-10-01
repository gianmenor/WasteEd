import React, { useState, useEffect, useRef } from 'react';
import './WasteTable.css';

const WasteTable = () => {
  const tableRef = useRef(null);
  const [wasteData, setWasteData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'monthly'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch waste data from API
  const fetchWasteData = async () => {
    try {
      setLoading(true);
      setError(null);

      let allData = [];
      let currentPage = 1;
      let hasMoreData = true;

      // Fetch all pages of data
      while (hasMoreData) {
        let url = 'http://localhost:3000/api/waste/records';
        const params = new URLSearchParams();
        
        if (dateFrom) params.append('dateFrom', dateFrom);
        if (dateTo) params.append('dateTo', dateTo);
        params.append('pageSize', '100'); // Maximum allowed
        params.append('page', currentPage.toString());
        
        if (params.toString()) {
          url += '?' + params.toString();
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
          allData = [...allData, ...result.data];
          
          // Check if there are more pages
          hasMoreData = result.meta?.pagination?.hasNextPage || false;
          currentPage++;
        } else {
          throw new Error('Invalid data format received');
        }
      }

      setWasteData(allData);
    } catch (err) {
      console.error('Error fetching waste data:', err);
      setError({
        message: 'Unable to load waste collection data',
        details: err.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchWasteData();
  }, [dateFrom, dateTo]);

  // Aggregate data by month
  const aggregateByMonth = (data) => {
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
  };

  // Process data based on view mode
  const processedData = viewMode === 'monthly' ? aggregateByMonth(wasteData) : wasteData;

  // Calculate pagination
  const totalItems = processedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = processedData.slice(startIndex, endIndex);

  // Calculate statistics
  const statistics = processedData.reduce((acc, record) => {
    acc.recyclable += record.recyclable || 0;
    acc.biodegradable += record.biodegradable || 0;
    acc.nonBiodegradable += record.nonBiodegradable || 0;
    acc.total += (record.recyclable || 0) +
                 (record.biodegradable || 0) +
                 (record.nonBiodegradable || 0);
    return acc;
  }, { recyclable: 0, biodegradable: 0, nonBiodegradable: 0, total: 0, totalDays: totalItems });

  // Reset to first page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, dateFrom, dateTo]);

  // Pagination handlers
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goToPrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Format date helper
  const formatDate = (dateString) => {
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
  };

  // Format count helper
  const formatCount = (count) => {
    if (count == null) return '0';
    return parseInt(count).toString();
  };

  // Show loading state
  if (loading) {
    return (
      <div className="waste-table-container">
        <div className="loading-container" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true">⏳</div>
          <p className="loading-text">Loading waste collection data...</p>
          <div className="loading-progress">
            <div className="loading-bar"></div>
          </div>
          <span className="visually-hidden">Please wait while we fetch the latest waste collection records.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="waste-table-container">

      {/* Filter Controls */}
      <div className="filter-controls">
        <div className="filter-row">
          <div className="date-filters">
            <div className="date-input-group">
              <label htmlFor="dateFrom">From:</label>
              <input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="date-input"
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="dateTo">To:</label>
              <input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="date-input"
              />
            </div>
          </div>
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
                onClick={fetchWasteData}
              >
                <span className="btn-icon">🔄</span>
                <span className="btn-text">Try Again</span>
              </button>
              <button
                className="btn-outline"
                onClick={() => setError(null)}
              >
                <span className="btn-text">Dismiss</span>
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
              <div className="stat-label">Recyclable Waste</div>

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
              <div className="stat-label">Biodegradable Waste</div>

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
              <div className="stat-label">Non-Biodegradable</div>

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
            <div className="table-summary">
              Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} {viewMode === 'monthly' ? 'months' : 'records'}
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
                      <div className="column-header">
                        <span className="column-icon" aria-hidden="true">📅</span>
                        <span className="column-text">Date Collected</span>
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header">
                        <span className="column-icon" aria-hidden="true">♻️</span>
                        <span className="column-text">Recyclable</span>
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header">
                        <span className="column-icon" aria-hidden="true">🍃</span>
                        <span className="column-text">Biodegradable</span>
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header">
                        <span className="column-icon" aria-hidden="true">🗑️</span>
                        <span className="column-text">Non-Biodegradable</span>
                      </div>
                    </th>
                    <th role="columnheader">
                      <div className="column-header">
                        <span className="column-icon" aria-hidden="true">📊</span>
                        <span className="column-text">Total</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((record, index) => {
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
                  })}
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

export default WasteTable;
