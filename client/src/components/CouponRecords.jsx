import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
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
import { usePreferences } from '../contexts/PreferencesContext';
import './CouponRecords.css';

// Fetch coupon balance
const fetchCouponBalance = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch(API_ENDPOINTS.COUPON_BALANCE, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch coupon balance');
  }

  return response.json();
};

// Fetch coupon transactions
const fetchCouponTransactions = async ({ period = 'all' }) => {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (period !== 'all') params.append('period', period);
  
  const response = await fetch(`${API_ENDPOINTS.COUPON_TRANSACTIONS}?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch transactions');
  }

  const data = await response.json();
  return data.data || [];
};

const CouponRecords = () => {
  const { preferences } = usePreferences();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState('all');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);

  // Fetch balance
  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['couponBalance'],
    queryFn: fetchCouponBalance,
    staleTime: 1 * 60 * 1000,
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: transactionsLoading, refetch } = useQuery({
    queryKey: ['couponTransactions', period],
    queryFn: () => fetchCouponTransactions({ period }),
    staleTime: 1 * 60 * 1000,
  });

  // Manual adjustment mutation
  const adjustMutation = useMutation({
    mutationFn: async ({ amount, reason }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.COUPON_ADJUST, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount, reason })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to adjust balance');
      }

      return response.json();
    },
    onSuccess: async () => {
      // Refetch and wait for new data
      await queryClient.invalidateQueries(['couponBalance']);
      await queryClient.invalidateQueries(['couponTransactions']);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      showMessage('Balance adjusted successfully', 'success');
    },
    onError: (error) => {
      showMessage(error.message, 'error');
    }
  });

  const showMessage = useCallback((text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  }, []);

  const handleAdjustment = useCallback((e) => {
    e.preventDefault();
    // This function is no longer used as we handle it inline with buttons
  }, []);

  const formatDate = useCallback((dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getTransactionTypeLabel = (type) => {
    switch (type) {
      case 'earn': return 'Earned';
      case 'consume': return 'Consumed';
      case 'adjust': return 'Adjustment';
      default: return type;
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'earn': return <SavingsOutlinedIcon fontSize="inherit" />;
      case 'consume': return <RedeemOutlinedIcon fontSize="inherit" />;
      case 'adjust': return <TuneOutlinedIcon fontSize="inherit" />;
      default: return <ReceiptLongOutlinedIcon fontSize="inherit" />;
    }
  };

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    if (!dateFrom && !dateTo) return transactions;
    
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.createdAt);
      transactionDate.setHours(0, 0, 0, 0);
      
      if (dateFrom && dateTo) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        return transactionDate >= from && transactionDate <= to;
      } else if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        return transactionDate >= from;
      } else if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        return transactionDate <= to;
      }
      return true;
    });
  }, [transactions, dateFrom, dateTo]);

  // Calculate total consumed
  const totalConsumed = useMemo(() => {
    return Math.abs(filteredTransactions
      .filter(t => Number(t.amount) < 0)
      .reduce((sum, t) => sum + Number(t.amount), 0));
  }, [filteredTransactions]);

  // Export handlers
  const handleExcelExport = useCallback(() => {
    const exportData = filteredTransactions.map(transaction => ({
      'Date & Time': formatDate(transaction.createdAt),
      'Type': getTransactionTypeLabel(transaction.type),
      'Amount': Number(transaction.amount).toFixed(2),
      'Details': transaction.reason || transaction.metadata?.reason || '-'
    }));

    // Add total consumed row
    exportData.push({});
    exportData.push({
      'Date & Time': 'Total Consumed',
      'Type': '',
      'Amount': totalConsumed.toFixed(2),
      'Details': ''
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Coupon Transactions');
    XLSX.writeFile(wb, `coupon-transactions-${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [filteredTransactions, totalConsumed, formatDate]);

  const handlePDFExport = useCallback(() => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(22, 163, 74);
    doc.text('Coupon Transaction Report', 14, 22);

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    
    let dateRangeLabel = 'Period: All time';
    if (dateFrom && dateTo) {
      dateRangeLabel = `Period: ${dateFrom.toLocaleDateString()} to ${dateTo.toLocaleDateString()}`;
    } else if (dateFrom) {
      dateRangeLabel = `Period: From ${dateFrom.toLocaleDateString()}`;
    } else if (dateTo) {
      dateRangeLabel = `Period: Until ${dateTo.toLocaleDateString()}`;
    }

    doc.text(dateRangeLabel, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

    // Transaction table
    const tableData = filteredTransactions.map(transaction => [
      formatDate(transaction.createdAt),
      getTransactionTypeLabel(transaction.type),
      Number(transaction.amount).toFixed(2),
      transaction.reason || transaction.metadata?.reason || '-'
    ]);

    autoTable(doc, {
      head: [['Date & Time', 'Type', 'Amount', 'Details']],
      body: tableData,
      startY: 42,
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [243, 244, 246] },
    });

    // Add total consumed
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Summary:', 14, finalY);
    
    doc.setFont(undefined, 'normal');
    doc.text(`Total Consumed: ${totalConsumed.toFixed(2)}`, 14, finalY + 7);

    doc.save(`coupon-transactions-${new Date().toISOString().split('T')[0]}.pdf`);
  }, [filteredTransactions, totalConsumed, dateFrom, dateTo, formatDate]);

  const handleExport = useCallback((options) => {
    const { format } = options;
    
    if (format === 'excel') {
      handleExcelExport();
    } else if (format === 'pdf') {
      handlePDFExport();
    }
    
    setShowExportModal(false);
  }, [handleExcelExport, handlePDFExport]);

  const uiSizeClass = useMemo(() => 
    `ui-size-${preferences?.uiSize || 'medium'}`,
    [preferences?.uiSize]
  );

  // Ensure balance is always a number for rendering
  let balance = 0;
  if (balanceData && balanceData.data && typeof balanceData.data.balance !== 'undefined' && balanceData.data.balance !== null) {
    const parsed = parseFloat(balanceData.data.balance);
    balance = isNaN(parsed) ? 0 : parsed;
  }
  // Show loading spinner if mutation is pending or data is loading
  const loading = balanceLoading || transactionsLoading || adjustMutation.isPending;

  return (
    <div className={`coupon-records-container ${uiSizeClass}`}>
      {loading && <LoadingSpinner fullscreen message="Loading..." />}

      {message && (
        <div className={`alert ${messageType === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      {/* Stats Cards */}
      <div className="balance-section">
        <div className="balance-card">
          <div className="balance-icon">🎟️</div>
          <div className="balance-content">
            <div className="balance-label">Current Balance</div>
            <div className="balance-value">{balance.toFixed(2)}</div>
            <div className="balance-unit">Coupons</div>
          </div>
        </div>

        <div className="consumed-card">
          <div className="consumed-icon">📊</div>
          <div className="consumed-content">
            <div className="consumed-label">Total Consumed</div>
            <div className="consumed-value">{totalConsumed.toFixed(2)}</div>
            <div className="consumed-unit">Coupons</div>
          </div>
        </div>
      </div>

      {/* Manual Adjustment Form */}
      <div className="adjustment-card">
        <h3 className="adjustment-title">Adjust Balance</h3>
          <form onSubmit={handleAdjustment} className="adjustment-form">
            <div className="form-group">
              <label htmlFor="amount">Amount</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="form-input"
                  style={{ flex: 1 }}
                />
                <button 
                  type="button"
                  onClick={() => {
                    const amount = parseFloat(adjustmentAmount);
                    if (isNaN(amount) || amount === 0) {
                      showMessage('Please enter a valid amount', 'error');
                      return;
                    }
                    adjustMutation.mutate({ amount: Math.abs(amount), reason: 'Manual credit' });
                  }}
                  className="btn btn-success"
                  disabled={adjustMutation.isPending}
                  title="Add to balance"
                  style={{ padding: '8px 16px', minWidth: '80px' }}
                >
                  <AddIcon fontSize="small" style={{ marginRight: 6 }} />
                  Add
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    const amount = parseFloat(adjustmentAmount);
                    if (isNaN(amount) || amount === 0) {
                      showMessage('Please enter a valid amount', 'error');
                      return;
                    }
                    adjustMutation.mutate({ amount: -Math.abs(amount), reason: 'Manual deduction' });
                  }}
                  className="btn btn-danger"
                  disabled={adjustMutation.isPending}
                  title="Subtract from balance"
                  style={{ padding: '8px 16px', minWidth: '80px' }}
                >
                  <RemoveIcon fontSize="small" style={{ marginRight: 6 }} />
                  Subtract
                </button>
              </div>
              <small className="form-hint">Enter amount and click Add or Subtract</small>
            </div>
          </form>
        </div>

      {/* Transactions Section */}
      <div className="transactions-section">
        <div className="transactions-header">
          <h2 className="transactions-title">Transaction History</h2>
          <div className="header-controls">
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <div className="date-filters">
                <DatePicker
                  label="From Date"
                  value={dateFrom}
                  onChange={(newValue) => setDateFrom(newValue)}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DatePicker
                  label="To Date"
                  value={dateTo}
                  onChange={(newValue) => setDateTo(newValue)}
                  minDate={dateFrom}
                  slotProps={{ textField: { size: 'small' } }}
                />
              </div>
            </LocalizationProvider>
            <button
              className="btn-export"
              onClick={() => setShowExportModal(true)}
              disabled={filteredTransactions.length === 0}
              title="Export transactions"
            >
              <FileDownloadOutlinedIcon fontSize="small" />
              <span>Export</span>
            </button>
            <div className="period-filter">
              <label htmlFor="period">Period:</label>
              <select 
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="period-select"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true"><InboxOutlinedIcon fontSize="inherit" /></span>
            <p>No transactions found for the selected period</p>
          </div>
        ) : (
          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Amount</th>
                  {/* Removed Balance After column */}
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td data-label="Date">{formatDate(transaction.createdAt)}</td>
                    <td data-label="Type">
                      <span className={`transaction-type ${transaction.type}`}>
                        <span className="transaction-type-icon" aria-hidden="true">{getTransactionIcon(transaction.type)}</span>
                        {getTransactionTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td data-label="Amount">
                      <span className={`transaction-amount ${Number(transaction.amount) >= 0 ? 'positive' : 'negative'}`}>
                        {Number(transaction.amount) >= 0 ? '+' : ''}
                        {typeof transaction.amount === 'number' && !isNaN(transaction.amount)
                          ? transaction.amount.toFixed(2)
                          : (Number(transaction.amount) ? Number(transaction.amount).toFixed(2) : '0.00')}
                      </span>
                    </td>
                    {/* Removed Balance After cell */}
                    <td className="transaction-details" data-label="Details">
                      {transaction.reason || transaction.metadata?.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Coupon Transactions"
        showWasteTypes={false}
        showDateRange={false}
      />
    </div>
  );
};

export default CouponRecords;
