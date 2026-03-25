import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import FirstPageOutlinedIcon from '@mui/icons-material/FirstPageOutlined';
import NavigateBeforeOutlinedIcon from '@mui/icons-material/NavigateBeforeOutlined';
import NavigateNextOutlinedIcon from '@mui/icons-material/NavigateNextOutlined';
import LastPageOutlinedIcon from '@mui/icons-material/LastPageOutlined';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { API_ENDPOINTS } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import ExportModal from './ExportModal';
import { endOfLocalDay, getLocalDateKey, parseLocalDate, startOfLocalDay } from '../utils/date';

const fetchCouponBalance = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch(API_ENDPOINTS.COUPON_BALANCE, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch coupon balance');
  }

  return response.json();
};

const normalizeTransactionType = (type) => {
  const normalized = String(type ?? '').trim().toUpperCase();

  switch (normalized) {
    case 'ADD':
    case 'EARN':
      return 'earn';
    case 'USE':
    case 'CONSUME':
      return 'consume';
    case 'ADJUST':
      return 'adjust';
    default:
      return String(type ?? '').trim().toLowerCase();
  }
};

const normalizeCouponTransaction = (transaction) => ({
  ...transaction,
  type: normalizeTransactionType(transaction?.type),
});

const fetchCouponTransactions = async () => {
  const token = localStorage.getItem('token');
  const allTransactions = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const params = new URLSearchParams({
      page: String(page),
      limit: '100',
    });

    const response = await fetch(`${API_ENDPOINTS.COUPON_TRANSACTIONS}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }

    const payload = await response.json();
    const batch = Array.isArray(payload?.data) ? payload.data : [];

    allTransactions.push(...batch.map(normalizeCouponTransaction));

    hasNext = Boolean(payload?.pagination?.hasNext || payload?.pagination?.hasNextPage);
    page += 1;

    if (batch.length === 0) {
      hasNext = false;
    }
  }

  return allTransactions;
};

const CouponRecords = () => {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState('all');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const toInt = useCallback((value) => {
    const parsed = parseInt(String(value ?? '').replace(/,/g, ''), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, []);

  const formatInt = useCallback((value) => {
    const intValue = toInt(value);
    return intValue.toLocaleString('en-US');
  }, [toInt]);

  const showMessage = useCallback((text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  }, []);

  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['couponBalance'],
    queryFn: fetchCouponBalance,
    staleTime: 60 * 1000,
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['couponTransactions'],
    queryFn: fetchCouponTransactions,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const eventSource = new EventSource(API_ENDPOINTS.BIN_NOTIFICATIONS_STREAM);

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'WASTE_INSERTED' || data?.type === 'COUPON_UPDATED') {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['couponBalance'] }),
            queryClient.invalidateQueries({ queryKey: ['couponTransactions'] }),
          ]);
        }
      } catch (parseError) {
        console.error('Coupon SSE parse error:', parseError);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);

  const adjustMutation = useMutation({
    mutationFn: async ({ amount, reason }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.COUPON_ADJUST, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount, reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to adjust balance');
      }

      return { data: await response.json(), amount };
    },
    onSuccess: async ({ amount }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['couponBalance'] }),
        queryClient.invalidateQueries({ queryKey: ['couponTransactions'] }),
      ]);

      setAdjustmentAmount('');

      const absAmount = Math.abs(toInt(amount));
      if (amount > 0) {
        showMessage(`Added ${absAmount} coupons successfully.`, 'success');
      } else {
        showMessage(`Deducted ${absAmount} coupons successfully.`, 'success');
      }
    },
    onError: (error) => {
      showMessage(error.message, 'error');
    },
  });

  const today = useMemo(() => new Date(), []);

  const maxFromDate = useMemo(() => {
    if (dateTo && dateTo < today) {
      return dateTo;
    }

    return today;
  }, [dateTo, today]);

  const handleFromDateChange = useCallback((newValue) => {
    setDateFrom(newValue);

    if (newValue && dateTo && startOfLocalDay(newValue) > endOfLocalDay(dateTo)) {
      setDateTo(null);
    }
  }, [dateTo]);

  const handleToDateChange = useCallback((newValue) => {
    setDateTo(newValue);

    if (newValue && dateFrom && endOfLocalDay(newValue) < startOfLocalDay(dateFrom)) {
      setDateFrom(null);
    }
  }, [dateFrom]);

  const formatDate = useCallback((dateString) => (
    new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  ), []);

  const getTransactionTypeLabel = useCallback((type) => {
    switch (type) {
      case 'earn':
        return 'Earned';
      case 'consume':
        return 'Consumed';
      case 'adjust':
        return 'Adjustment';
      default:
        return type;
    }
  }, []);

  const getTransactionIcon = useCallback((type) => {
    switch (type) {
      case 'earn':
        return <SavingsOutlinedIcon fontSize="inherit" />;
      case 'consume':
        return <RedeemOutlinedIcon fontSize="inherit" />;
      case 'adjust':
        return <TuneOutlinedIcon fontSize="inherit" />;
      default:
        return <ReceiptLongOutlinedIcon fontSize="inherit" />;
    }
  }, []);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfToday = startOfLocalDay(now);
    const endOfToday = endOfLocalDay(now);
    const startOfWeek = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return [...transactions]
      .filter((transaction) => {
        const transactionDate = new Date(transaction.createdAt);

        if (period === 'today') {
          return transactionDate >= startOfToday && transactionDate <= endOfToday;
        }

        if (period === 'week') {
          return transactionDate >= startOfWeek && transactionDate <= endOfToday;
        }

        if (period === 'month') {
          return transactionDate >= startOfMonth && transactionDate <= endOfToday;
        }

        if (period === 'year') {
          return transactionDate >= startOfYear && transactionDate <= endOfToday;
        }

        return true;
      })
      .filter((transaction) => {
        const transactionDate = new Date(transaction.createdAt);

        if (dateFrom && transactionDate < startOfLocalDay(dateFrom)) {
          return false;
        }

        if (dateTo && transactionDate > endOfLocalDay(dateTo)) {
          return false;
        }

        return true;
      })
      .filter((transaction) => (
        typeFilter === 'all' ? true : transaction.type === typeFilter
      ))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [transactions, period, dateFrom, dateTo, typeFilter]);

  const totalConsumed = useMemo(() => (
    Math.abs(filteredTransactions
      .filter((transaction) => Number(transaction.amount) < 0 || transaction.type === 'consume')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0))
  ), [filteredTransactions]);

  const summarizedTransactions = useMemo(() => {
    const grouped = {};

    filteredTransactions.forEach((transaction) => {
      const dateObj = parseLocalDate(transaction.createdAt);
      const dateKey = getLocalDateKey(dateObj);
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

      const detail = transaction.reason || transaction.metadata?.reason || transaction.notes || '-';
      if (detail && detail !== '-') {
        grouped[key].details.add(detail);
      }
    });

    return Object.values(grouped).sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) {
        return dateDiff;
      }

      return getTransactionTypeLabel(a.type).localeCompare(getTransactionTypeLabel(b.type));
    });
  }, [filteredTransactions, getTransactionTypeLabel]);

  const totalItems = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [period, dateFrom, dateTo, typeFilter, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const clearFilters = useCallback(() => {
    setDateFrom(null);
    setDateTo(null);
    setTypeFilter('all');
    setPeriod('all');
  }, []);

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

  const handleExcelExport = useCallback(() => {
    const exportData = summarizedTransactions.map((transaction) => ({
      'Date & Time': transaction.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      Type: getTransactionTypeLabel(transaction.type),
      Amount: formatInt(transaction.amount),
      Details: transaction.details.size > 0 ? Array.from(transaction.details).join(' | ') : '-',
    }));

    exportData.push({});
    exportData.push({
      'Date & Time': 'Total Consumed',
      Type: '',
      Amount: formatInt(totalConsumed),
      Details: '',
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Coupon Transactions');
    XLSX.writeFile(wb, `coupon-transactions-${new Date().toISOString().split('T')[0]}.xlsx`);
    showMessage('Excel file exported successfully.', 'success');
  }, [summarizedTransactions, getTransactionTypeLabel, formatInt, totalConsumed, showMessage]);

  const handlePDFExport = useCallback(() => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(22, 163, 74);
    doc.text('Coupon Transaction Report', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);

    let dateRangeLabel = 'Period: All time';
    if (dateFrom && dateTo) {
      dateRangeLabel = `Period: ${dateFrom.toLocaleDateString()} to ${dateTo.toLocaleDateString()}`;
    } else if (dateFrom) {
      dateRangeLabel = `Period: From ${dateFrom.toLocaleDateString()}`;
    } else if (dateTo) {
      dateRangeLabel = `Period: Until ${dateTo.toLocaleDateString()}`;
    } else if (period !== 'all') {
      dateRangeLabel = `Period: ${period.charAt(0).toUpperCase()}${period.slice(1)}`;
    }

    doc.text(dateRangeLabel, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

    const tableData = summarizedTransactions.map((transaction) => ([
      transaction.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      getTransactionTypeLabel(transaction.type),
      formatInt(transaction.amount),
      transaction.details.size > 0 ? Array.from(transaction.details).join(' | ') : '-',
    ]));

    autoTable(doc, {
      head: [['Date & Time', 'Type', 'Amount', 'Details']],
      body: tableData,
      startY: 42,
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [243, 244, 246] },
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Summary:', 14, finalY);
    doc.setFont(undefined, 'normal');
    doc.text(`Total Consumed: ${formatInt(totalConsumed)}`, 14, finalY + 7);

    doc.save(`coupon-transactions-${new Date().toISOString().split('T')[0]}.pdf`);
    showMessage('PDF file exported successfully.', 'success');
  }, [summarizedTransactions, dateFrom, dateTo, period, getTransactionTypeLabel, formatInt, totalConsumed, showMessage]);

  const handleExport = useCallback((options) => {
    if (options.format === 'excel') {
      handleExcelExport();
    } else if (options.format === 'pdf') {
      handlePDFExport();
    }

    setShowExportModal(false);
  }, [handleExcelExport, handlePDFExport]);

  const balance = useMemo(() => {
    const rawBalance = balanceData?.data?.balance;
    const parsed = toInt(rawBalance);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [balanceData, toInt]);

  const loading = balanceLoading || transactionsLoading || adjustMutation.isPending;
  const hasActiveFilters = Boolean(dateFrom || dateTo || typeFilter !== 'all' || period !== 'all');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {loading && <LoadingSpinner fullscreen message="Loading..." />}

        {message && (
          <div
            className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg border transition-all ${
              messageType === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2">
                {messageType === 'error'
                  ? <ErrorOutlineOutlinedIcon fontSize="small" />
                  : <CheckCircleOutlineOutlinedIcon fontSize="small" />}
                <span className="font-medium text-sm">{message}</span>
              </div>
              <button
                className="text-gray-500 hover:text-gray-700 ml-4 inline-flex items-center"
                onClick={() => setMessage('')}
              >
                <CloseRoundedIcon fontSize="small" />
              </button>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ConfirmationNumberOutlinedIcon fontSize="medium" className="text-emerald-600" />
            Coupon Records
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track your coupon balance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <SavingsOutlinedIcon fontSize="large" className="text-emerald-600" />
              <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                Balance
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{formatInt(balance)}</div>
            <div className="text-sm font-medium text-gray-700">Coupon Balance</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <BarChartOutlinedIcon fontSize="large" className="text-red-600" />
              <span className="text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-700">
                Used
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{formatInt(totalConsumed)}</div>
            <div className="text-sm font-medium text-gray-700">Total Consumed</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <ListAltOutlinedIcon fontSize="large" className="text-gray-700" />
              <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">
                Count
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{filteredTransactions.length}</div>
            <div className="text-sm font-medium text-gray-700">
              {hasActiveFilters ? 'Filtered' : 'Total'} Transactions
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Adjustment</h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <input
                type="text"
                inputMode="numeric"
                value={adjustmentAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[\d,]*$/.test(value) && String(value).replace(/,/g, '').length <= 4) {
                    setAdjustmentAmount(value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
                placeholder="Enter amount"
                maxLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const amount = toInt(adjustmentAmount);
                if (amount <= 0 || amount > 9999) {
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
                if (amount <= 0 || amount > 9999) {
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
          <p className="text-xs text-gray-500 mt-2">
            Enter an amount and click Add or Subtract to adjust the balance
          </p>
        </div>

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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <DatePicker
                  value={dateFrom}
                  onChange={handleFromDateChange}
                  maxDate={maxFromDate}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { width: '100%', backgroundColor: 'white' },
                    },
                  }}
                  enableAccessibleFieldDOMStructure={false}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <DatePicker
                  value={dateTo}
                  onChange={handleToDateChange}
                  minDate={dateFrom || undefined}
                  maxDate={today}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { width: '100%', backgroundColor: 'white' },
                    },
                  }}
                  enableAccessibleFieldDOMStructure={false}
                />
              </div>
            </div>
          </LocalizationProvider>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">Transaction History</h2>
              <span className="text-sm text-gray-600">
                {totalItems === 0
                  ? 'Showing 0 transactions'
                  : `Showing ${startIndex + 1}-${endIndex} of ${totalItems} transactions`}
              </span>
            </div>
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
            <>
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
                    {paginatedTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 text-sm text-gray-900 whitespace-nowrap">
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                              transaction.type === 'earn'
                                ? 'bg-emerald-100 text-emerald-700'
                                : transaction.type === 'consume'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {getTransactionIcon(transaction.type)}
                            {getTransactionTypeLabel(transaction.type)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-right whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              Number(transaction.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {Number(transaction.amount) >= 0 ? '+' : ''}
                            {formatInt(transaction.amount)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {transaction.reason || transaction.metadata?.reason || transaction.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                        Page {safeCurrentPage} of {totalPages}
                      </span>

                      <div className="flex items-center gap-2 ml-auto sm:ml-0">
                        <button
                          onClick={() => goToPage(1)}
                          disabled={safeCurrentPage === 1}
                          className="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed items-center"
                          aria-label="First page"
                        >
                          <FirstPageOutlinedIcon fontSize="small" />
                        </button>
                        <button
                          onClick={goToPrevPage}
                          disabled={safeCurrentPage === 1}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                          aria-label="Previous page"
                        >
                          <NavigateBeforeOutlinedIcon fontSize="small" />
                        </button>

                        <div className="hidden sm:flex items-center gap-2">
                          {visiblePages.map((pageNum) => (
                            <button
                              key={pageNum}
                              onClick={() => goToPage(pageNum)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                                safeCurrentPage === pageNum
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                              }`}
                              aria-label={`Page ${pageNum}`}
                              aria-current={safeCurrentPage === pageNum ? 'page' : undefined}
                            >
                              {pageNum}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={goToNextPage}
                          disabled={safeCurrentPage === totalPages}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                          aria-label="Next page"
                        >
                          <NavigateNextOutlinedIcon fontSize="small" />
                        </button>
                        <button
                          onClick={() => goToPage(totalPages)}
                          disabled={safeCurrentPage === totalPages}
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
