import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePreferences } from '../contexts/PreferencesContext';
import { API_ENDPOINTS } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import './ProfitRewards.css';

// Fetch profit/reward records
const fetchRecords = async (year, month, dateFrom, dateTo) => {
  const token = localStorage.getItem('token');
  let url = API_ENDPOINTS.PROFIT_RECORDS;
  
  const params = new URLSearchParams();
  if (year) params.append('year', year);
  if (month && month !== '') params.append('month', month);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch records');
  }

  const data = await response.json();
  return data.data || data.records || [];
};

// Fetch summary
const fetchSummary = async (year, month, dateFrom, dateTo) => {
  const token = localStorage.getItem('token');
  let url = API_ENDPOINTS.PROFIT_SUMMARY;
  
  const params = new URLSearchParams();
  if (year) params.append('year', year);
  if (month && month !== '') params.append('month', month);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch summary');
  }

  const data = await response.json();
  return data.data || data.summary || {};
};

const ProfitRewards = () => {
  const { preferences } = usePreferences();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel');
  const [dateRangeMode, setDateRangeMode] = useState('month'); // 'month' | 'custom'
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    profitAmount: '',
    expenseAmount: '',
    source: '',
    description: ''
  });
  
  const [editingId, setEditingId] = useState(null);

  // Fetch records
  const { data: records = [], isLoading: recordsLoading, refetch: refetchRecords } = useQuery({
    queryKey: ['profitRecords', selectedYear, selectedMonth, dateRangeMode, customDateFrom, customDateTo],
    queryFn: () => fetchRecords(
      dateRangeMode === 'month' ? selectedYear : null,
      dateRangeMode === 'month' ? selectedMonth : null,
      dateRangeMode === 'custom' ? customDateFrom : null,
      dateRangeMode === 'custom' ? customDateTo : null
    ),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch summary
  const { data: summary = {}, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['profitSummary', selectedYear, selectedMonth, dateRangeMode, customDateFrom, customDateTo],
    queryFn: () => fetchSummary(
      dateRangeMode === 'month' ? selectedYear : null,
      dateRangeMode === 'month' ? selectedMonth : null,
      dateRangeMode === 'custom' ? customDateFrom : null,
      dateRangeMode === 'custom' ? customDateTo : null
    ),
    staleTime: 2 * 60 * 1000,
  });

  const showMessage = useCallback((text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    const profitAmount = parseFloat(formData.profitAmount) || 0;
    const expenseAmount = parseFloat(formData.expenseAmount) || 0;

    if (profitAmount < 0 || expenseAmount < 0) {
      showMessage('Amounts cannot be negative', 'error');
      return;
    }

    if (profitAmount === 0 && expenseAmount === 0) {
      showMessage('Please enter at least one amount', 'error');
      return;
    }

    if (!formData.source.trim()) {
      showMessage('Please provide a source', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const revenue = profitAmount - expenseAmount;
      
      if (editingId) {
        // Update existing record with new structure
        const response = await fetch(`${API_ENDPOINTS.PROFIT_UPDATE}/${editingId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            profitFromRecyclables: profitAmount,
            rewardsSpent: expenseAmount,
            notes: formData.description || formData.source || null
          })
        });

        if (response.ok) {
          showMessage('Record updated successfully');
          setEditingId(null);
        } else {
          const error = await response.json();
          showMessage(error.message || 'Failed to update record', 'error');
        }
      } else {
        // Add new record with both profit and expense
        const response = await fetch(API_ENDPOINTS.PROFIT_ADD, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            profitAmount,
            expenseAmount,
            revenue,
            source: formData.source,
            description: formData.description || null
          })
        });

        if (response.ok) {
          showMessage(`Record added: Revenue ₱${revenue.toFixed(2)}`);
        } else {
          const error = await response.json();
          showMessage(error.message || 'Failed to add record', 'error');
        }
      }
      
      // Reset form
      setFormData({
        profitAmount: '',
        expenseAmount: '',
        source: '',
        description: ''
      });
      
      refetchRecords();
      refetchSummary();
      setShowModal(false);
    } catch (error) {
      showMessage('Operation failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingId, refetchRecords, refetchSummary, showMessage]);

  const handleEdit = useCallback((record) => {
    setEditingId(record.id);
    setFormData({
      profitAmount: (record.profitFromRecyclables || 0).toString(),
      expenseAmount: (record.rewardsSpent || 0).toString(),
      source: record.notes || '',
      description: record.notes || ''
    });
    setShowModal(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_ENDPOINTS.PROFIT_DELETE}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showMessage('Record deleted successfully');
        refetchRecords();
        refetchSummary();
      } else {
        const error = await response.json();
        showMessage(error.message || 'Failed to delete record', 'error');
      }
    } catch (error) {
      showMessage('Failed to delete record', 'error');
    }
  }, [refetchRecords, refetchSummary, showMessage]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setFormData({
      profitAmount: '',
      expenseAmount: '',
      source: '',
      description: ''
    });
    setShowModal(false);
  }, []);

  const formatDate = useCallback((dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }, []);

  const handleExport = useCallback(() => {
    if (!records || records.length === 0) {
      showMessage('No records to export', 'error');
      return;
    }

    const periodLabel = dateRangeMode === 'custom'
      ? `${customDateFrom || 'start'}_to_${customDateTo || 'end'}`
      : `${selectedYear}${selectedMonth ? '_' + selectedMonth : ''}`;

    const rows = records.map((r) => ({
      Date: formatDate(r.date),
      'Total Amount Collected (₱)': (r.profitFromRecyclables || 0).toFixed(2),
      'Expense (₱)': (r.rewardsSpent || 0).toFixed(2),
      'Net Revenue (₱)': (r.netProfit || 0).toFixed(2),
      Notes: r.notes || ''
    }));

    if (exportFormat === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Profit & Rewards');
      XLSX.writeFile(wb, `profit_rewards_${periodLabel}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Profit & Rewards Report', 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Period: ${periodLabel.replace(/_/g, ' ')}`, 14, 26);
      autoTable(doc, {
        startY: 32,
        head: [['Date', 'Total Amount Collected', 'Expense', 'Net Revenue', 'Notes']],
        body: records.map((r) => [
          formatDate(r.date),
          `₱${(r.profitFromRecyclables || 0).toFixed(2)}`,
          `₱${(r.rewardsSpent || 0).toFixed(2)}`,
          `₱${(r.netProfit || 0).toFixed(2)}`,
          r.notes || ''
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 197, 94] }
      });
      doc.save(`profit_rewards_${periodLabel}.pdf`);
    }

    setShowExportModal(false);
    showMessage('Export successful!');
  }, [records, exportFormat, dateRangeMode, customDateFrom, customDateTo, selectedYear, selectedMonth, formatDate, showMessage]);

  const uiSizeClass = useMemo(() => 
    `ui-size-${preferences?.uiSize || 'medium'}`,
    [preferences?.uiSize]
  );

  const loading = recordsLoading || summaryLoading;
  
  const years = useMemo(() => {
    const startYear = 2025;
    const yearList = [];
    for (let y = startYear; y <= currentYear; y++) {
      yearList.push(y);
    }
    return yearList.reverse();
  }, [currentYear]);

  return (
    <div className={`profit-rewards-container ${uiSizeClass}`}>
      {loading && <LoadingSpinner fullscreen message="Loading data..." />}

      {/* Alert Messages */}
      {message && (
        <div className={`alert ${messageType === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-section">
        <div className="summary-cards">
          <div className="summary-card profit">
            <div className="summary-content">
              <div className="summary-label">Total Amount Collected</div>
              <div className="summary-value">{formatCurrency(summary.totalProfit || 0)}</div>
              <div className="summary-hint">From recyclables</div>
            </div>
          </div>

          <div className="summary-card rewards">
            <div className="summary-content">
              <div className="summary-label">Total Rewards</div>
              <div className="summary-value">{formatCurrency(summary.totalRewardsSpent || summary.totalRewards || 0)}</div>
              <div className="summary-hint">Given to users</div>
            </div>
          </div>

        </div>
      </div>

      {/* Records Table */}
      <div className="records-section">
        <div className="records-header">
          <h2 className="records-title">Records</h2>
          <div className="records-header-actions">
            <button 
              className="btn btn-export"
              onClick={() => setShowExportModal(true)}
              title="Export records"
            >
              <FileDownloadOutlinedIcon fontSize="small" />
              <span>Export</span>
            </button>
            <button 
              className="btn btn-primary btn-add-record"
              onClick={() => setShowModal(true)}
            >
              Add Record
            </button>
          </div>
        </div>
        
        {/* Filter Controls */}
        <div className="filter-controls">
          <div className="filter-mode-toggle">
            <button
              className={`filter-mode-btn ${dateRangeMode === 'month' ? 'active' : ''}`}
              onClick={() => setDateRangeMode('month')}
            >
              By Month
            </button>
            <button
              className={`filter-mode-btn ${dateRangeMode === 'custom' ? 'active' : ''}`}
              onClick={() => setDateRangeMode('custom')}
            >
              Custom Range
            </button>
          </div>

          {dateRangeMode === 'month' ? (
            <div className="filter-selects">
              <div className="filter-field">
                <label>Year</label>
                <select
                  className="filter-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Month</label>
                <select
                  className="filter-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value === '' ? '' : parseInt(e.target.value))}
                >
                  <option value="">All</option>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="filter-selects">
              <div className="filter-field">
                <label>From</label>
                <input
                  type="date"
                  className="filter-select filter-date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  max={customDateTo || undefined}
                />
              </div>
              <div className="filter-field">
                <label>To</label>
                <input
                  type="date"
                  className="filter-select filter-date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  min={customDateFrom || undefined}
                />
              </div>
              {(customDateFrom || customDateTo) && (
                <button
                  className="btn-clear-dates"
                  onClick={() => { setCustomDateFrom(''); setCustomDateTo(''); }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {records.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p>No records found for the selected period</p>
          </div>
        ) : (
          <div className="records-table-wrapper">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total Amount Collected</th>
                  <th>Expense</th>
                  <th>Net Revenue</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td data-label="Date">{formatDate(record.date)}</td>
                    <td data-label="Total Amount Collected">
                      <span className="record-amount profit">
                        {formatCurrency(record.profitFromRecyclables || 0)}
                      </span>
                    </td>
                    <td data-label="Expense">
                      <span className="record-amount reward">
                        {formatCurrency(record.rewardsSpent || 0)}
                      </span>
                    </td>
                    <td data-label="Net Revenue">
                      <span className={`record-amount ${record.netProfit >= 0 ? 'profit' : 'reward'}`}>
                        {formatCurrency(record.netProfit || 0)}
                      </span>
                    </td>
                    <td data-label="Notes">
                      <span className="record-description" title={record.notes}>
                        {record.notes || '-'}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="action-buttons">
                        <button
                          className="btn-action btn-edit"
                          onClick={() => handleEdit(record)}
                          title="Edit"
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(record.id)}
                          title="Delete"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content modal-content--export" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Export Records</h2>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>✕</button>
            </div>
            <div className="modal-form-body">
              <div className="form-group">
                <label>Format</label>
                <div className="export-format-toggle">
                  <button
                    type="button"
                    className={`export-fmt-btn ${exportFormat === 'excel' ? 'active' : ''}`}
                    onClick={() => setExportFormat('excel')}
                  >
                    📊 Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    className={`export-fmt-btn ${exportFormat === 'pdf' ? 'active' : ''}`}
                    onClick={() => setExportFormat('pdf')}
                  >
                    📄 PDF
                  </button>
                </div>
              </div>
              <p className="export-info">
                Exporting <strong>{records.length}</strong> record{records.length !== 1 ? 's' : ''} from the currently selected period.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExport} disabled={records.length === 0}>
                <FileDownloadOutlinedIcon fontSize="small" style={{ marginRight: 6 }} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Add/Edit Form */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !isSubmitting && handleCancelEdit()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingId ? 'Edit Record' : 'Add New Record'}
              </h2>
              <button 
                className="modal-close" 
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>
            
            <form className="profit-form modal-form" onSubmit={handleSubmit}>
              <div className="modal-form-body">

                {/* Amount Inputs Section */}
                <div className="form-section-label">Amounts</div>
                <div className="amounts-grid">
                  <div className="form-group">
                    <label htmlFor="profitAmount">Total Amount Collected (₱)</label>
                    <div className="input-with-prefix">
                      <span className="input-prefix input-prefix--green">₱</span>
                      <input
                        id="profitAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input profit-input input-with-prefix__field"
                        value={formData.profitAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, profitAmount: e.target.value }))}
                        placeholder="0.00"
                        disabled={isSubmitting}
                      />
                    </div>
                    <span className="input-hint">Income from recyclables</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="expenseAmount">Expense (₱)</label>
                    <div className="input-with-prefix">
                      <span className="input-prefix input-prefix--red">₱</span>
                      <input
                        id="expenseAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input expense-input input-with-prefix__field"
                        value={formData.expenseAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, expenseAmount: e.target.value }))}
                        placeholder="0.00"
                        disabled={isSubmitting}
                      />
                    </div>
                    <span className="input-hint">Rewards / costs paid out</span>
                  </div>
                </div>

                {/* Revenue Display */}
                <div className="revenue-display">
                  <div className="revenue-label">
                    <QueryStatsIcon fontSize="small" />
                    <span>Net Revenue</span>
                  </div>
                  <div className={`revenue-value ${(parseFloat(formData.profitAmount || 0) - parseFloat(formData.expenseAmount || 0)) >= 0 ? 'positive' : 'negative'}`}>
                    ₱{(parseFloat(formData.profitAmount || 0) - parseFloat(formData.expenseAmount || 0)).toFixed(2)}
                  </div>
                </div>

                {/* Source/Notes Section */}
                <div className="form-section-label">Details</div>
                <div className="form-group">
                  <label htmlFor="source">Source / Description <span className="required-mark">*</span></label>
                  <input
                    id="source"
                    type="text"
                    className="form-input"
                    value={formData.source}
                    onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                    placeholder="e.g., Plastic bottles sale, User rewards distribution"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Additional Notes <span className="optional-mark">(optional)</span></label>
                  <textarea
                    id="description"
                    className="form-input form-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Any additional details about this transaction..."
                    disabled={isSubmitting}
                    rows="3"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : editingId ? 'Update Record' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitRewards;
