import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FirstPageOutlinedIcon from '@mui/icons-material/FirstPageOutlined';
import NavigateBeforeOutlinedIcon from '@mui/icons-material/NavigateBeforeOutlined';
import NavigateNextOutlinedIcon from '@mui/icons-material/NavigateNextOutlined';
import LastPageOutlinedIcon from '@mui/icons-material/LastPageOutlined';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePreferences } from '../contexts/PreferencesContext';
import { API_ENDPOINTS } from '../config/api';
import LoadingSpinner from './LoadingSpinner';

const fetchAllRecords = async () => {
  const token = localStorage.getItem('token');
  const allRecords = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const response = await fetch(`${API_ENDPOINTS.PROFIT_RECORDS}?page=${page}&limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch records');
    }

    const data = await response.json();
    const batch = data.data || data.records || [];
    allRecords.push(...batch);

    hasNext = Boolean(data?.pagination?.hasNext || data?.pagination?.hasNextPage);
    page += 1;

    if (batch.length === 0) {
      hasNext = false;
    }
  }

  return allRecords;
};

const ProfitRewards = () => {
  const { preferences } = usePreferences();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const todayDateString = new Date().toISOString().split('T')[0];
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [exportFormat, setExportFormat] = useState('excel');
  const [dateRangeMode, setDateRangeMode] = useState('month'); // 'month' | 'custom'
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Form state
  const [formData, setFormData] = useState({
    profitAmount: '',
    expenseAmount: '',
    source: '',
    description: ''
  });
  
  const [editingId, setEditingId] = useState(null);

  const { data: records = [], isLoading: recordsLoading, refetch: refetchRecords } = useQuery({
    queryKey: ['profitRecords'],
    queryFn: fetchAllRecords,
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
      setShowModal(false);
    } catch (error) {
      showMessage('Operation failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingId, refetchRecords, showMessage]);

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

  const handleDelete = useCallback((id) => {
    setRecordToDelete(id);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!recordToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_ENDPOINTS.PROFIT_DELETE}/${recordToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showMessage('Record deleted successfully');
        setShowDeleteConfirm(false);
        setRecordToDelete(null);
        refetchRecords();
      } else {
        const error = await response.json();
        showMessage(error.message || 'Failed to delete record', 'error');
        setShowDeleteConfirm(false);
        setRecordToDelete(null);
      }
    } catch (error) {
      showMessage('Failed to delete record', 'error');
      setShowDeleteConfirm(false);
      setRecordToDelete(null);
    }
  }, [recordToDelete, refetchRecords, showMessage]);

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

  const handleCustomDateFromChange = useCallback((value) => {
    const normalizedValue = value && value > todayDateString ? todayDateString : value;
    setCustomDateFrom(normalizedValue);

    if (normalizedValue && customDateTo && normalizedValue > customDateTo) {
      setCustomDateTo('');
    }
  }, [customDateTo, todayDateString]);

  const handleCustomDateToChange = useCallback((value) => {
    const normalizedValue = value && value > todayDateString ? todayDateString : value;
    setCustomDateTo(normalizedValue);

    if (normalizedValue && customDateFrom && normalizedValue < customDateFrom) {
      setCustomDateFrom('');
    }
  }, [customDateFrom, todayDateString]);

  const filteredRecords = useMemo(() => {
    const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (dateRangeMode === 'month') {
      return sortedRecords.filter((record) => {
        const recordDate = new Date(record.date);
        const matchesYear = recordDate.getFullYear() === selectedYear;
        const matchesMonth = selectedMonth === '' ? true : recordDate.getMonth() + 1 === selectedMonth;
        return matchesYear && matchesMonth;
      });
    }

    return sortedRecords.filter((record) => {
      const recordDate = new Date(record.date);

      if (customDateFrom && recordDate < new Date(`${customDateFrom}T00:00:00`)) {
        return false;
      }

      if (customDateTo && recordDate > new Date(`${customDateTo}T23:59:59`)) {
        return false;
      }

      return true;
    });
  }, [records, dateRangeMode, selectedYear, selectedMonth, customDateFrom, customDateTo]);

  const summary = useMemo(() => {
    const totals = {
      totalProfit: 0,
      totalRewardsSpent: 0,
      totalNetProfit: 0,
      recordCount: filteredRecords.length,
      averageProfit: 0,
      averageRewards: 0,
      averageNetProfit: 0,
    };

    filteredRecords.forEach((record) => {
      totals.totalProfit += Number(record.profitFromRecyclables || 0);
      totals.totalRewardsSpent += Number(record.rewardsSpent || 0);
      totals.totalNetProfit += Number(record.netProfit || 0);
    });

    if (filteredRecords.length > 0) {
      totals.averageProfit = totals.totalProfit / filteredRecords.length;
      totals.averageRewards = totals.totalRewardsSpent / filteredRecords.length;
      totals.averageNetProfit = totals.totalNetProfit / filteredRecords.length;
    }

    return totals;
  }, [filteredRecords]);

  const totalItems = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  const handleExport = useCallback(() => {
    if (!filteredRecords || filteredRecords.length === 0) {
      showMessage('No records to export', 'error');
      return;
    }

    const periodLabel = dateRangeMode === 'custom'
      ? `${customDateFrom || 'start'}_to_${customDateTo || 'end'}`
      : `${selectedYear}${selectedMonth ? '_' + selectedMonth : ''}`;

    // Summarize records by day (single row per date)
    const groupedByDate = filteredRecords.reduce((acc, r) => {
      const dateObj = new Date(r.date);
      const dateKey = dateObj.toISOString().split('T')[0];

      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateObj,
          profitFromRecyclables: 0,
          rewardsSpent: 0,
          netProfit: 0,
          notes: new Set(),
        };
      }

      acc[dateKey].profitFromRecyclables += r.profitFromRecyclables || 0;
      acc[dateKey].rewardsSpent += r.rewardsSpent || 0;
      acc[dateKey].netProfit += r.netProfit || 0;

      if (r.notes) {
        acc[dateKey].notes.add(r.notes);
      }

      return acc;
    }, {});

    const rows = Object.values(groupedByDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((row) => ({
        Date: row.date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        'Total Amount Collected (₱)': row.profitFromRecyclables.toFixed(2),
        'Expense (₱)': row.rewardsSpent.toFixed(2),
        'Net Revenue (₱)': row.netProfit.toFixed(2),
        Notes: Array.from(row.notes).join(' | '),
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
      
      const pdfRows = rows.map((row) => ([
        row.Date,
        `₱${row['Total Amount Collected (₱)']}`,
        `₱${row['Expense (₱)']}`,
        `₱${row['Net Revenue (₱)']}`,
        row.Notes || ''
      ]));

      autoTable(doc, {
        startY: 32,
        head: [['Date', 'Total Amount Collected', 'Expense', 'Net Revenue', 'Notes']],
        body: pdfRows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 197, 94] }
      });
      doc.save(`profit_rewards_${periodLabel}.pdf`);
    }

    setShowExportModal(false);
    showMessage('Export successful!');
  }, [filteredRecords, exportFormat, dateRangeMode, customDateFrom, customDateTo, selectedYear, selectedMonth, showMessage]);

  const uiSizeClass = useMemo(() => 
    `ui-size-${preferences?.uiSize || 'medium'}`,
    [preferences?.uiSize]
  );

  const loading = recordsLoading;
  
  const years = useMemo(() => {
    const startYear = 2025;
    const yearList = [];
    for (let y = startYear; y <= currentYear; y++) {
      yearList.push(y);
    }
    return yearList.reverse();
  }, [currentYear]);

  const monthOptions = useMemo(() => {
    const maxMonth = selectedYear === currentYear ? currentMonth : 12;
    return [
      { value: 1, label: 'January' },
      { value: 2, label: 'February' },
      { value: 3, label: 'March' },
      { value: 4, label: 'April' },
      { value: 5, label: 'May' },
      { value: 6, label: 'June' },
      { value: 7, label: 'July' },
      { value: 8, label: 'August' },
      { value: 9, label: 'September' },
      { value: 10, label: 'October' },
      { value: 11, label: 'November' },
      { value: 12, label: 'December' },
    ].filter((month) => month.value <= maxMonth);
  }, [selectedYear, currentYear, currentMonth]);

  useEffect(() => {
    if (selectedYear === currentYear && selectedMonth > currentMonth) {
      setSelectedMonth(currentMonth);
    }
  }, [selectedYear, selectedMonth, currentYear, currentMonth]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRangeMode, selectedYear, selectedMonth, customDateFrom, customDateTo, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const goToPage = useCallback((page) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  }, [totalPages]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage((page) => Math.max(page - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  }, [totalPages]);

  const visiblePages = useMemo(() => {
    const count = Math.min(5, totalPages);

    return Array.from({ length: count }, (_, index) => {
      if (totalPages <= 5) {
        return index + 1;
      }

      if (safeCurrentPage <= 3) {
        return index + 1;
      }

      if (safeCurrentPage >= totalPages - 2) {
        return totalPages - 4 + index;
      }

      return safeCurrentPage - 2 + index;
    });
  }, [safeCurrentPage, totalPages]);

  return (
    <div className={`max-w-[1400px] mx-auto p-4 md:p-8 bg-[var(--bg-primary)] min-h-screen ${uiSizeClass}`}>
      {loading && <LoadingSpinner fullscreen message="Loading data..." />}

      {/* Alert Messages */}
      {message && (
        <div className={`p-4 rounded-md mb-6 text-sm font-medium animate-slideDown ${messageType === 'error' ? 'bg-[rgba(239,68,68,0.1)] text-[var(--error-color)] border border-[var(--error-color)]' : 'bg-[rgba(34,197,94,0.1)] text-[var(--success-color)] border border-[var(--success-color)]'}`}>
          {message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4 md:p-8 mb-6 md:mb-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 md:p-6 flex items-center gap-4 md:gap-6 border-2 border-[var(--success-color)] bg-gradient-to-br from-[rgba(34,197,94,0.05)] to-[rgba(34,197,94,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex-1">
              <div className="text-sm text-[var(--text-secondary)] mb-2">Total Amount Collected</div>
              <div className="text-[clamp(1.25rem,4vw,2rem)] font-bold text-[var(--text-primary)] leading-tight mb-2 break-words">{formatCurrency(summary.totalProfit || 0)}</div>
              <div className="text-xs text-[var(--text-muted)]">From recyclables</div>
            </div>
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 md:p-6 flex items-center gap-4 md:gap-6 border-2 border-[var(--secondary-color)] bg-gradient-to-br from-[rgba(59,130,246,0.05)] to-[rgba(59,130,246,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex-1">
              <div className="text-sm text-[var(--text-secondary)] mb-2">Total Rewards</div>
              <div className="text-[clamp(1.25rem,4vw,2rem)] font-bold text-[var(--text-primary)] leading-tight mb-2 break-words">{formatCurrency(summary.totalRewardsSpent || summary.totalRewards || 0)}</div>
              <div className="text-xs text-[var(--text-muted)]">Given to users</div>
            </div>
          </div>

        </div>
      </div>

      {/* Records Table */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4 md:p-8 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] m-0">Records</h2>
          <div className="flex gap-2 flex-wrap items-center">
            <button 
              className="inline-flex items-center justify-center gap-1.5 px-4 md:px-6 py-2 border-none rounded font-medium cursor-pointer transition-all text-sm text-center bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] flex-1 md:flex-initial"
              onClick={() => setShowExportModal(true)}
              title="Export records"
            >
              <FileDownloadOutlinedIcon fontSize="small" />
              <span>Export</span>
            </button>
            <button 
              className="flex items-center justify-center gap-2 px-4 md:px-6 py-2 border-none rounded font-medium cursor-pointer transition-all text-sm text-center bg-[var(--primary-color)] text-white shadow-sm hover:bg-[var(--primary-hover)] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex-1 md:flex-initial"
              onClick={() => setShowModal(true)}
            >
              Add Record
            </button>
          </div>
        </div>
        
        {/* Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md p-4">
          <div className="flex border border-[var(--border-color)] rounded overflow-hidden flex-shrink-0 w-full md:w-auto">
            <button
              className={`flex-1 md:flex-initial px-3.5 py-2 text-[0.8125rem] font-medium border-none cursor-pointer transition-all ${dateRangeMode === 'month' ? 'bg-[var(--primary-color)] text-white' : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'}`}
              onClick={() => setDateRangeMode('month')}
            >
              By Month
            </button>
            <button
              className={`flex-1 md:flex-initial px-3.5 py-2 text-[0.8125rem] font-medium border-none cursor-pointer transition-all ${dateRangeMode === 'custom' ? 'bg-[var(--primary-color)] text-white' : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'}`}
              onClick={() => setDateRangeMode('custom')}
            >
              Custom Range
            </button>
          </div>

          {dateRangeMode === 'month' ? (
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Year</label>
                <select
                  className="px-4 py-2 border border-[var(--border-color)] rounded-sm text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer transition-all hover:border-[var(--primary-color)] focus:outline-none focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_rgba(34,197,94,0.1)]"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Month</label>
                <select
                  className="px-4 py-2 border border-[var(--border-color)] rounded-sm text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer transition-all hover:border-[var(--primary-color)] focus:outline-none focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_rgba(34,197,94,0.1)]"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value === '' ? '' : parseInt(e.target.value))}
                >
                  <option value="">All</option>
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">From</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-[var(--border-color)] rounded-sm text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer transition-all hover:border-[var(--primary-color)] focus:outline-none focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_rgba(34,197,94,0.1)]"
                  value={customDateFrom}
                  onChange={(e) => handleCustomDateFromChange(e.target.value)}
                  max={customDateTo ? (customDateTo < todayDateString ? customDateTo : todayDateString) : todayDateString}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">To</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-[var(--border-color)] rounded-sm text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer transition-all hover:border-[var(--primary-color)] focus:outline-none focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_rgba(34,197,94,0.1)]"
                  value={customDateTo}
                  onChange={(e) => handleCustomDateToChange(e.target.value)}
                  min={customDateFrom || undefined}
                  max={todayDateString}
                />
              </div>
              {(customDateFrom || customDateTo) && (
                <button
                  className="px-3 py-2 border border-[var(--border-color)] rounded bg-transparent text-[var(--text-secondary)] text-[0.8125rem] cursor-pointer transition-all self-end hover:border-[var(--danger-color)] hover:text-[var(--danger-color)] hover:bg-[rgba(239,68,68,0.06)] sm:mt-auto"
                  onClick={() => { setCustomDateFrom(''); setCustomDateTo(''); }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)]">
            <span className="text-5xl block mb-4"><InboxOutlinedIcon fontSize="inherit" /></span>
            <p>No records found for the selected period</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View - Hidden on Mobile */}
            <div className="hidden lg:block overflow-x-auto rounded-md border border-[var(--border-color)]">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[var(--bg-tertiary)] border-b-2 border-[var(--border-color)]">
                  <tr>
                    <th className="p-4 text-left font-semibold text-[var(--text-secondary)] uppercase text-xs tracking-wide">Date</th>
                    <th className="p-4 text-left font-semibold text-[var(--text-secondary)] uppercase text-xs tracking-wide">Total Amount Collected</th>
                    <th className="p-4 text-left font-semibold text-[var(--text-secondary)] uppercase text-xs tracking-wide">Rewards</th>
                    <th className="p-4 text-left font-semibold text-[var(--text-secondary)] uppercase text-xs tracking-wide">Net Revenue</th>
                    <th className="p-4 text-left font-semibold text-[var(--text-secondary)] uppercase text-xs tracking-wide">Notes</th>
                    <th className="p-4 text-left font-semibold text-[var(--text-secondary)] uppercase text-xs tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => (
                    <tr key={record.id} className="border-b border-[var(--border-color)] transition-colors hover:bg-[var(--bg-hover)] last:border-b-0">
                      <td className="p-4 text-[var(--text-primary)]">{formatDate(record.date)}</td>
                      <td className="p-4 text-[var(--text-primary)]">
                        <span className="font-semibold font-[Courier_New,monospace] text-[clamp(0.8rem,2vw,0.9375rem)] break-words text-[var(--success-color)]">
                          {formatCurrency(record.profitFromRecyclables || 0)}
                        </span>
                      </td>
                      <td className="p-4 text-[var(--text-primary)]">
                        <span className="font-semibold font-[Courier_New,monospace] text-[clamp(0.8rem,2vw,0.9375rem)] break-words text-[var(--secondary-color)]">
                          {formatCurrency(record.rewardsSpent || 0)}
                        </span>
                      </td>
                      <td className="p-4 text-[var(--text-primary)]">
                        <span className={`font-semibold font-[Courier_New,monospace] text-[clamp(0.8rem,2vw,0.9375rem)] break-words ${record.netProfit >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--secondary-color)]'}`}>
                          {formatCurrency(record.netProfit || 0)}
                        </span>
                      </td>
                      <td className="p-4 text-[var(--text-primary)]">
                        <span className="text-[var(--text-secondary)] text-[0.8125rem] max-w-[200px] block overflow-hidden text-ellipsis whitespace-nowrap" title={record.notes}>
                          {record.notes || '-'}
                        </span>
                      </td>
                      <td className="p-4 text-[var(--text-primary)]">
                        <div className="flex gap-2">
                          <button
                            className="p-1 px-2 border-none bg-transparent cursor-pointer rounded transition-all text-base hover:bg-[rgba(59,130,246,0.1)] hover:scale-110"
                            onClick={() => handleEdit(record)}
                            title="Edit"
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </button>
                          <button
                            className="p-1 px-2 border-none bg-transparent cursor-pointer rounded transition-all text-base hover:bg-[rgba(239,68,68,0.1)] hover:scale-110"
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

            {/* Mobile/Tablet Card View - Visible on Mobile Only */}
            <div className="block lg:hidden space-y-4">
              {paginatedRecords.map((record) => (
                <div key={record.id} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="text-sm font-medium text-[var(--text-secondary)]">{formatDate(record.date)}</div>
                    <div className={`text-lg font-bold ${record.netProfit >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--danger-color,#ef4444)]'}`}>
                      {formatCurrency(record.netProfit || 0)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                      <div className="text-xs text-[var(--text-secondary)] font-medium mb-1">Amount Collected</div>
                      <div className="text-sm font-bold text-[var(--success-color)]">{formatCurrency(record.profitFromRecyclables || 0)}</div>
                    </div>
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                      <div className="text-xs text-[var(--text-secondary)] font-medium mb-1">Rewards</div>
                      <div className="text-sm font-bold text-[var(--secondary-color)]">{formatCurrency(record.rewardsSpent || 0)}</div>
                    </div>
                  </div>

                  {record.notes && (
                    <div className="mb-3 p-2 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-secondary)]">
                      <span className="font-medium">Notes:</span> {record.notes}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button
                      className="px-4 py-2 border-none bg-[rgba(59,130,246,0.1)] text-[var(--secondary-color)] cursor-pointer rounded transition-all text-sm font-medium hover:bg-[rgba(59,130,246,0.2)]"
                      onClick={() => handleEdit(record)}
                    >
                      <EditOutlinedIcon fontSize="small" className="mr-1" />
                      Edit
                    </button>
                    <button
                      className="px-4 py-2 border-none bg-[rgba(239,68,68,0.1)] text-[var(--danger-color,#ef4444)] cursor-pointer rounded transition-all text-sm font-medium hover:bg-[rgba(239,68,68,0.2)]"
                      onClick={() => handleDelete(record.id)}
                    >
                      <DeleteOutlineIcon fontSize="small" className="mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 px-4 py-4 border border-[var(--border-color)] rounded-md bg-[var(--bg-tertiary)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-[var(--text-secondary)]">
                    {totalItems === 0
                      ? 'Showing 0 records'
                      : `Showing ${startIndex + 1}-${endIndex} of ${totalItems} records`}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-sm text-[var(--text-secondary)]">Show:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 text-sm border border-[var(--border-color)] rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span className="text-sm text-[var(--text-secondary)]">per page</span>
                </div>

                {totalPages > 1 && (
                  <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2">
                    <span className="text-xs text-[var(--text-secondary)] sm:hidden">
                      Page {safeCurrentPage} of {totalPages}
                    </span>

                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                      <button
                        onClick={() => goToPage(1)}
                        disabled={safeCurrentPage === 1}
                        className="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed items-center"
                      >
                        <FirstPageOutlinedIcon fontSize="small" />
                      </button>
                      <button
                        onClick={goToPrevPage}
                        disabled={safeCurrentPage === 1}
                        className="px-3 py-1.5 text-sm font-medium rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                      >
                        <NavigateBeforeOutlinedIcon fontSize="small" />
                      </button>

                      <div className="hidden sm:flex items-center gap-2">
                        {visiblePages.map((pageNum) => (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`px-3 py-1.5 text-sm font-medium rounded ${
                              safeCurrentPage === pageNum
                                ? 'bg-[var(--primary-color)] text-white'
                                : 'border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={goToNextPage}
                        disabled={safeCurrentPage === totalPages}
                        className="px-3 py-1.5 text-sm font-medium rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                      >
                        <NavigateNextOutlinedIcon fontSize="small" />
                      </button>
                      <button
                        onClick={() => goToPage(totalPages)}
                        disabled={safeCurrentPage === totalPages}
                        className="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed items-center"
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

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-[rgba(248,253,248,0.9)] flex items-center justify-center z-[10000] p-6 backdrop-blur-sm" onClick={() => setShowExportModal(false)}>
          <div className="bg-[var(--bg-secondary)] rounded-lg max-w-[420px] w-full max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-slideIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-8 border-b border-[var(--border-color)]">
              <h2 className="text-2xl font-semibold text-[var(--text-primary)] m-0">Export Records</h2>
              <button className="bg-transparent border-none text-2xl text-[var(--text-secondary)] cursor-pointer p-2 leading-none transition-all rounded hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] inline-flex items-center justify-center" onClick={() => setShowExportModal(false)}>
                <CloseRoundedIcon fontSize="small" />
              </button>
            </div>
            <div className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Format</label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className={`flex-1 px-4 py-2.5 border-2 rounded-md font-medium text-sm cursor-pointer transition-all text-center ${exportFormat === 'excel' ? 'border-[var(--primary-color)] bg-[rgba(34,197,94,0.08)] text-[var(--primary-color)]' : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--text-secondary)]'}`}
                    onClick={() => setExportFormat('excel')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <TableChartOutlinedIcon fontSize="small" />
                      Excel (.xlsx)
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`flex-1 px-4 py-2.5 border-2 rounded-md font-medium text-sm cursor-pointer transition-all text-center ${exportFormat === 'pdf' ? 'border-[var(--primary-color)] bg-[rgba(34,197,94,0.08)] text-[var(--primary-color)]' : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--text-secondary)]'}`}
                    onClick={() => setExportFormat('pdf')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <PictureAsPdfOutlinedIcon fontSize="small" />
                      PDF
                    </span>
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] m-0">
                Exporting <strong>{filteredRecords.length}</strong> record{filteredRecords.length !== 1 ? 's' : ''} from the currently selected period.
              </p>
            </div>
            <div className="p-6 px-8 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)] flex gap-4 justify-end">
              <button className="min-w-[120px] px-6 py-2 border-none rounded font-medium cursor-pointer transition-all text-sm text-center bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] hover:border-[var(--text-secondary)]" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className="min-w-[120px] px-6 py-2 border-none rounded font-medium cursor-pointer transition-all text-sm text-center bg-[var(--primary-color)] text-white shadow-sm hover:bg-[var(--primary-hover)] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleExport} disabled={filteredRecords.length === 0}>
                <FileDownloadOutlinedIcon fontSize="small" style={{ marginRight: 6 }} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Add/Edit Form */}
      {showModal && (
        <div className="fixed inset-0 bg-[rgba(248,253,248,0.9)] flex items-center justify-center z-[10000] p-6 backdrop-blur-sm" onClick={() => !isSubmitting && handleCancelEdit()}>
          <div className="bg-[var(--bg-secondary)] rounded-lg max-w-[800px] w-full max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-slideIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-8 border-b border-[var(--border-color)]">
              <h2 className="text-2xl font-semibold text-[var(--text-primary)] m-0">
                {editingId ? 'Edit Record' : 'Add New Record'}
              </h2>
              <button 
                className="bg-transparent border-none text-2xl text-[var(--text-secondary)] cursor-pointer p-2 leading-none transition-all rounded hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                <CloseRoundedIcon fontSize="small" />
              </button>
            </div>
            
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="p-8 flex flex-col gap-6">

                {/* Amount Inputs Section */}
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] pb-1.5 border-b border-[var(--border-color)] mb-0.5">Amounts</div>
                <div className="grid grid-cols-2 gap-6 max-[640px]:grid-cols-1">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="profitAmount" className="text-sm font-medium text-[var(--text-secondary)]">Total Amount Collected (₱)</label>
                    <div className="flex items-stretch border border-[var(--border-color)] rounded overflow-hidden transition-shadow focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.1)]">
                      <span className="flex items-center justify-center px-3 text-sm font-semibold bg-[rgba(34,197,94,0.07)] border-r border-[var(--border-color)] text-[var(--success-color)] select-none">₱</span>
                      <input
                        id="profitAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        max="9999.99"
                        className="border-none border-l-[3px] border-l-[var(--success-color)] rounded-none flex-1 min-w-0 shadow-none focus:outline-none focus:border-transparent focus:shadow-none px-4 py-2 text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-all"
                        value={formData.profitAmount}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          if (value <= 9999.99) {
                            setFormData(prev => ({ ...prev, profitAmount: e.target.value }));
                          }
                        }}
                        onInput={(e) => {
                          if (parseFloat(e.target.value) > 9999.99) {
                            e.target.value = '9999.99';
                          }
                        }}
                        placeholder="0.00"
                        disabled={isSubmitting}
                      />
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] mt-2 block">Income from recyclables</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="expenseAmount" className="text-sm font-medium text-[var(--text-secondary)]">Expense (₱)</label>
                    <div className="flex items-stretch border border-[var(--border-color)] rounded overflow-hidden transition-shadow focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.1)]">
                      <span className="flex items-center justify-center px-3 text-sm font-semibold bg-[rgba(239,68,68,0.07)] border-r border-[var(--border-color)] text-[var(--danger-color,#ef4444)] select-none">₱</span>
                      <input
                        id="expenseAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        max="9999.99"
                        className="border-none border-l-[3px] border-l-[var(--danger-color,#ef4444)] rounded-none flex-1 min-w-0 shadow-none focus:outline-none focus:border-transparent focus:shadow-none px-4 py-2 text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-all"
                        value={formData.expenseAmount}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          if (value <= 9999.99) {
                            setFormData(prev => ({ ...prev, expenseAmount: e.target.value }));
                          }
                        }}
                        onInput={(e) => {
                          if (parseFloat(e.target.value) > 9999.99) {
                            e.target.value = '9999.99';
                          }
                        }}
                        placeholder="0.00"
                        disabled={isSubmitting}
                      />
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] mt-2 block">Rewards / costs paid out</span>
                  </div>
                </div>

                {/* Revenue Display */}
                <div className="bg-gradient-to-br from-[rgba(34,197,94,0.05)] to-[rgba(34,197,94,0.1)] border-2 border-[var(--primary-color)] rounded-md p-6 flex justify-between items-center max-[640px]:flex-col max-[640px]:gap-2 max-[640px]:text-center">
                  <div className="flex items-center gap-2 text-base font-medium text-[var(--text-secondary)]">
                    <QueryStatsIcon fontSize="small" />
                    <span>Net Revenue</span>
                  </div>
                  <div className={`text-[clamp(1.25rem,5vw,1.75rem)] font-bold break-words ${(parseFloat(formData.profitAmount || 0) - parseFloat(formData.expenseAmount || 0)) >= 0 ? 'text-[var(--primary-color)]' : 'text-[var(--danger-color,#ef4444)]'}`}>
                    ₱{(parseFloat(formData.profitAmount || 0) - parseFloat(formData.expenseAmount || 0)).toFixed(2)}
                  </div>
                </div>

                {/* Source/Notes Section */}
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] pb-1.5 border-b border-[var(--border-color)] mb-0.5">Details</div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="source" className="block mb-2 text-sm font-medium text-[var(--text-secondary)]">Source / Description <span className="text-[var(--danger-color,#ef4444)] ml-0.5">*</span></label>
                  <input
                    id="source"
                    type="text"
                    className="px-4 py-2 border border-[var(--border-color)] rounded-sm text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-all focus:outline-none focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_rgba(34,197,94,0.1)]"
                    value={formData.source}
                    onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                    placeholder="e.g., Plastic bottles sale, User rewards distribution"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="description" className="block mb-2 text-sm font-medium text-[var(--text-secondary)]">Additional Notes <span className="text-xs font-normal text-[var(--text-muted)] ml-1">(optional)</span></label>
                  <textarea
                    id="description"
                    className="px-4 py-2 border border-[var(--border-color)] rounded-sm text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-all resize-vertical min-h-[80px] font-[inherit] focus:outline-none focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_rgba(34,197,94,0.1)]"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Any additional details about this transaction..."
                    disabled={isSubmitting}
                    rows="3"
                  />
                </div>
              </div>

              <div className="p-6 px-8 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)] flex gap-4 justify-end">
                <button 
                  type="button" 
                  className="min-w-[120px] px-6 py-2 border-none rounded font-medium cursor-pointer transition-all text-sm text-center bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] hover:border-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="min-w-[120px] px-6 py-2 border-none rounded font-medium cursor-pointer transition-all text-sm text-center bg-[var(--primary-color)] text-white shadow-sm hover:bg-[var(--primary-hover)] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : editingId ? 'Update Record' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Confirm Delete</h3>
            <p className="text-gray-700 mb-6">Are you sure you want to delete this record? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                className="py-2 px-4 border border-gray-300 rounded-md text-sm font-medium cursor-pointer transition-all bg-white text-gray-700 hover:bg-gray-50"
                onClick={() => { setShowDeleteConfirm(false); setRecordToDelete(null); }}
              >
                Cancel
              </button>
              <button
                className="py-2 px-4 border-none rounded-md text-sm font-medium cursor-pointer transition-all bg-red-600 text-white hover:bg-red-700"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitRewards;
