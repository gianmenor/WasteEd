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
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { API_ENDPOINTS } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import ExportModal from './ExportModal';

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
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState('all');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const toInt = useCallback((value) => {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, []);

  const formatInt = useCallback((value) => {
    const intValue = toInt(value);
    return intValue.toString();
  }, [toInt]);

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

      return { data: await response.json(), amount }; // Return amount for success message
    },
    onSuccess: async ({ amount }) => {
      // Refetch and wait for new data
      await queryClient.invalidateQueries(['couponBalance']);
      await queryClient.invalidateQueries(['couponTransactions']);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      
      // Show specific message based on whether it was add or subtract
      const absAmount = Math.abs(toInt(amount));
      if (amount > 0) {
        showMessage(`✓ Added ${absAmount} coupons successfully!`, 'success');
      } else {
        showMessage(`✓ Deducted ${absAmount} coupons successfully!`, 'success');
      }
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

  // Filter transactions by date range, search, and type
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    
    // Date filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(transaction => {
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
    }
    
    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => {
        const reason = (t.reason || t.metadata?.reason || '').toLowerCase();
        const type = getTransactionTypeLabel(t.type).toLowerCase();
        const amount = String(t.amount);
        return reason.includes(query) || type.includes(query) || amount.includes(query);
      });
    }
    
    return filtered;
  }, [transactions, dateFrom, dateTo, searchQuery, typeFilter]);

  // Calculate total consumed
  const totalConsumed = useMemo(() => {
    return Math.abs(filteredTransactions
      .filter(t => Number(t.amount) < 0)
      .reduce((sum, t) => sum + Number(t.amount), 0));
  }, [filteredTransactions]);

  // Calculate total earned
  const totalEarned = useMemo(() => {
    return filteredTransactions
      .filter(t => Number(t.amount) > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [filteredTransactions]);
  
  // Clear all filters
  const clearFilters = useCallback(() => {
    setDateFrom(null);
    setDateTo(null);
    setSearchQuery('');
    setTypeFilter('all');
    setPeriod('all');
  }, []);

  const summarizedTransactions = useMemo(() => {
    const grouped = {};

    filteredTransactions.forEach((transaction) => {
      const dateObj = new Date(transaction.createdAt);
      const dateKey = dateObj.toISOString().split('T')[0];
      const typeKey = transaction.type || 'unknown';
      const key = `${dateKey}-${typeKey}`;

      if (!grouped[key]) {
        grouped[key] = {
          date: dateObj,
          type: typeKey,
          amount: 0,
          details: new Set(),
        };
      }

      grouped[key].amount += Number(transaction.amount) || 0;

      const detail = transaction.reason || transaction.metadata?.reason || '-';
      if (detail && detail !== '-') {
        grouped[key].details.add(detail);
      }
    });

    return Object.values(grouped).sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      return getTransactionTypeLabel(a.type).localeCompare(getTransactionTypeLabel(b.type));
    });
  }, [filteredTransactions]);

  // Export handlers
  const handleExcelExport = useCallback(() => {
    const exportData = summarizedTransactions.map(transaction => ({
      'Date & Time': transaction.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      'Type': getTransactionTypeLabel(transaction.type),
      'Amount': formatInt(transaction.amount),
      'Details': transaction.details.size > 0 ? Array.from(transaction.details).join(' | ') : '-'
    }));

    // Add total consumed row
    exportData.push({});
    exportData.push({
      'Date & Time': 'Total Consumed',
      'Type': '',
      'Amount': formatInt(totalConsumed),
      'Details': ''
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Coupon Transactions');
    XLSX.writeFile(wb, `coupon-transactions-${new Date().toISOString().split('T')[0]}.xlsx`);
    showMessage('✓ Excel file exported successfully!', 'success');
  }, [summarizedTransactions, totalConsumed, showMessage, formatInt]);

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
    const tableData = summarizedTransactions.map(transaction => [
      transaction.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      getTransactionTypeLabel(transaction.type),
      formatInt(transaction.amount),
      transaction.details.size > 0 ? Array.from(transaction.details).join(' | ') : '-'
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
    doc.text(`Total Consumed: ${formatInt(totalConsumed)}`, 14, finalY + 7);

    doc.save(`coupon-transactions-${new Date().toISOString().split('T')[0]}.pdf`);
    showMessage('✓ PDF file exported successfully!', 'success');
  }, [summarizedTransactions, totalConsumed, dateFrom, dateTo, showMessage, formatInt]);

  const handleExport = useCallback((options) => {
    const { format } = options;
    
    if (format === 'excel') {
      handleExcelExport();
    } else if (format === 'pdf') {
      handlePDFExport();
    }
    
    setShowExportModal(false);
  }, [handleExcelExport, handlePDFExport]);

  // Ensure balance is always a number for rendering
  let balance = 0;
  if (balanceData && balanceData.data && typeof balanceData.data.balance !== 'undefined' && balanceData.data.balance !== null) {
    const parsed = toInt(balanceData.data.balance);
    balance = isNaN(parsed) ? 0 : parsed;
  }
  
  // Show loading spinner if mutation is pending or data is loading
  const loading = balanceLoading || transactionsLoading || adjustMutation.isPending;
  
  // Check if any filters are active
  const hasActiveFilters = dateFrom || dateTo || searchQuery || typeFilter !== 'all' || period !== 'all';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {loading && <LoadingSpinner fullscreen message="Loading..." />}

        {/* Toast Notification */}
        {message && (
          <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg border transition-all ${
            messageType === 'error' 
              ? 'bg-red-50 border-red-200 text-red-800' 
              : 'bg-green-50 border-green-200 text-green-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{message}</span>
              <button 
                className="text-gray-500 hover:text-gray-700 ml-4" 
                onClick={() => setMessage('')}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <span>🎟</span>
            Coupon Records
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track your coupon balance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">💰</span>
              <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                Balance
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {formatInt(balance)}
            </div>
            <div className="text-sm font-medium text-gray-700">Coupon Balance</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">📊</span>
              <span className="text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-700">
                Used
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {formatInt(totalConsumed)}
            </div>
            <div className="text-sm font-medium text-gray-700">Total Consumed</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">✨</span>
              <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-700">
                Earned
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {formatInt(totalEarned)}
            </div>
            <div className="text-sm font-medium text-gray-700">Total Earned</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">📝</span>
              <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">
                Count
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {filteredTransactions.length}
            </div>
            <div className="text-sm font-medium text-gray-700">
              {hasActiveFilters ? 'Filtered' : 'Total'} Transactions
            </div>
          </div>
        </div>

        {/* Adjustment Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Adjustment</h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={adjustmentAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value)) {
                    setAdjustmentAmount(value);
                  }
                }}
                placeholder="Enter amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <button 
              type="button"
              onClick={() => {
                const amount = toInt(adjustmentAmount);
                if (amount <= 0) {
                  showMessage('Please enter a valid amount', 'error');
                  return;
                }
                adjustMutation.mutate({ amount: Math.abs(amount), reason: 'Manual credit' });
              }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={adjustMutation.isPending || !adjustmentAmount}
            >
              <AddIcon fontSize="small" />
              Add
            </button>
            <button 
              type="button"
              onClick={() => {
                const amount = toInt(adjustmentAmount);
                if (amount <= 0) {
                  showMessage('Please enter a valid amount', 'error');
                  return;
                }
                adjustMutation.mutate({ amount: -Math.abs(amount), reason: 'Manual deduction' });
              }}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={adjustMutation.isPending || !adjustmentAmount}
            >
              <RemoveIcon fontSize="small" />
              Subtract
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Enter an amount and click Add or Subtract to adjust the balance</p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-gray-900">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ClearIcon fontSize="small" />
                Clear All
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fontSize="small" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="earn">Earned</option>
                <option value="consume">Consumed</option>
                <option value="adjust">Adjustment</option>
              </select>
            </div>

            {/* Period Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
              <select 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>

            {/* Export Button */}
            <div className="flex items-end">
              <button
                onClick={() => setShowExportModal(true)}
                disabled={filteredTransactions.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileDownloadOutlinedIcon fontSize="small" />
                Export
              </button>
            </div>
          </div>

          {/* Date Range */}
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <DatePicker
                  value={dateFrom}
                  onChange={(newValue) => setDateFrom(newValue)}
                  maxDate={new Date()}
                  slotProps={{ 
                    textField: { 
                      size: 'small',
                      sx: { width: '100%', backgroundColor: 'white' }
                    } 
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <DatePicker
                  value={dateTo}
                  onChange={(newValue) => setDateTo(newValue)}
                  minDate={dateFrom}
                  maxDate={new Date()}
                  slotProps={{ 
                    textField: { 
                      size: 'small',
                      sx: { width: '100%', backgroundColor: 'white' }
                    } 
                  }}
                />
              </div>
            </div>
          </LocalizationProvider>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Transaction History</h2>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <InboxOutlinedIcon className="text-6xl mb-3 text-gray-300" />
              <p className="text-sm">No transactions found</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Clear filters to see all transactions
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-sm text-gray-900 whitespace-nowrap">
                        {formatDate(transaction.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'earn' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : transaction.type === 'consume'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {getTransactionIcon(transaction.type)}
                          {getTransactionTypeLabel(transaction.type)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-right whitespace-nowrap">
                        <span className={`font-semibold ${
                          Number(transaction.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {Number(transaction.amount) >= 0 ? '+' : ''}
                          {formatInt(transaction.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
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
    </div>
  );
};

export default CouponRecords;
