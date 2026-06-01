import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../contexts/ToastContext';
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
import { endOfLocalDay, formatLocalDateForApi, getLocalDateKey, parseLocalDate, startOfLocalDay } from '../utils/date';

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { showToast } = useToast();

  const toInt = useCallback((value) => {
    const parsed = parseInt(String(value ?? '').replace(/,/g, ''), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, []);

  const formatInt = useCallback((value) => {
    const intValue = toInt(value);
    return intValue.toLocaleString('en-US');
  }, [toInt]);

  const showMessage = showToast;

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

  const getTransactionTypeLabel = useCallback((type, amount) => {
    switch (type) {
      case 'earn':
        return 'Earned';
      case 'consume':
        return 'Dispensed';
      case 'adjust':
        if (amount !== undefined) {
          return Number(amount) >= 0 ? 'Added' : 'Removed';
        }
        return 'Adjustment';
      case 'adjust-added':
        return 'Added';
      case 'adjust-removed':
        return 'Removed';
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
      case 'adjust-added':
      case 'adjust-removed':
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
      .filter((transaction) => {
        if (typeFilter === 'all') return true;
        if (typeFilter === 'consume') return transaction.type === 'consume';
        if (typeFilter === 'adjust-added') return transaction.type === 'adjust' && Number(transaction.amount) >= 0;
        if (typeFilter === 'adjust-removed') return transaction.type === 'adjust' && Number(transaction.amount) < 0;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [transactions, period, dateFrom, dateTo, typeFilter]);

  const totalConsumed = useMemo(() => (
    filteredTransactions
      .filter((transaction) => transaction.type === 'consume')
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0)
  ), [filteredTransactions]);

  const exportTotal = useMemo(() => {
    if (typeFilter === 'adjust-added') {
      return filteredTransactions
        .filter((transaction) => transaction.type === 'adjust' && Number(transaction.amount) >= 0)
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    }

    if (typeFilter === 'adjust-removed') {
      return Math.abs(filteredTransactions
        .filter((transaction) => transaction.type === 'adjust' && Number(transaction.amount) < 0)
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0));
    }

    return totalConsumed;
  }, [filteredTransactions, typeFilter, totalConsumed]);

  const getExportDateRange = useCallback((dateRange, customDateFrom, customDateTo) => {
    let exportDateFrom = null;
    let exportDateTo = null;
    const today = new Date();
    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    switch (dateRange) {
      case 'today':
        exportDateFrom = localToday;
        exportDateTo = localToday;
        break;
      case 'week': {
        const weekStart = new Date(localToday);
        weekStart.setDate(localToday.getDate() - localToday.getDay());
        exportDateFrom = weekStart;
        exportDateTo = localToday;
        break;
      }
      case 'month':
        exportDateFrom = new Date(localToday.getFullYear(), localToday.getMonth(), 1);
        exportDateTo = localToday;
        break;
      case 'year':
        exportDateFrom = new Date(localToday.getFullYear(), 0, 1);
        exportDateTo = localToday;
        break;
      case 'custom':
        if (customDateFrom) {
          const [year, month, day] = customDateFrom.split('-').map(Number);
          exportDateFrom = new Date(year, month - 1, day);
        }
        if (customDateTo) {
          const [year, month, day] = customDateTo.split('-').map(Number);
          exportDateTo = new Date(year, month - 1, day);
        }
        break;
      default:
        exportDateFrom = null;
        exportDateTo = null;
    }

    return { exportDateFrom, exportDateTo };
  }, []);

  const matchesExportType = useCallback((transaction, includeExportTypes = { dispensed: true, added: true, removed: true }) => {
    const isDispensed = transaction.type === 'consume';
    const isAdded = transaction.type === 'earn' || (transaction.type === 'adjust' && Number(transaction.amount) >= 0);
    const isRemoved = transaction.type === 'adjust' && Number(transaction.amount) < 0;

    if (isDispensed && includeExportTypes.dispensed) return true;
    if (isAdded && includeExportTypes.added) return true;
    if (isRemoved && includeExportTypes.removed) return true;
    return false;
  }, []);

  const summarizeTransactionGroups = useCallback((transactionsToSummarize) => {
    const grouped = {};

    transactionsToSummarize.forEach((transaction) => {
      const dateObj = parseLocalDate(transaction.createdAt);
      const dateKey = getLocalDateKey(dateObj);
      let typeKey = transaction.type || 'unknown';

      if (typeKey === 'adjust') {
        typeKey = Number(transaction.amount) >= 0 ? 'adjust-added' : 'adjust-removed';
      }

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

      return getTransactionTypeLabel(a.type, a.amount).localeCompare(getTransactionTypeLabel(b.type, b.amount));
    });
  }, [getTransactionTypeLabel]);

  const summarizedTransactions = useMemo(() => summarizeTransactionGroups(filteredTransactions), [filteredTransactions, summarizeTransactionGroups]);

  const getExportTransactions = useCallback((options = {}) => {
    const { dateRange = 'all', customDateFrom = null, customDateTo = null, includeExportTypes = { dispensed: true, added: true, removed: true } } = options;
    const { exportDateFrom, exportDateTo } = getExportDateRange(dateRange, customDateFrom, customDateTo);

    return [...transactions]
      .filter((transaction) => {
        const transactionDate = new Date(transaction.createdAt);
        if (exportDateFrom && transactionDate < startOfLocalDay(exportDateFrom)) {
          return false;
        }
        if (exportDateTo && transactionDate > endOfLocalDay(exportDateTo)) {
          return false;
        }
        return true;
      })
      .filter((transaction) => matchesExportType(transaction, includeExportTypes))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [transactions, getExportDateRange, matchesExportType]);

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

  const getExportTotalLabel = useCallback((includeExportTypes) => {
    const selectedTypes = includeExportTypes || { dispensed: true, added: true, removed: true };
    const active = Object.entries(selectedTypes)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);

    if (active.length === 1) {
      switch (active[0]) {
        case 'dispensed': return 'Total Coupons Dispensed';
        case 'added': return 'Total Coupons Added';
        case 'removed': return 'Total Coupons Removed';
        default: return 'Total Selected Transactions';
      }
    }

    return 'Total Selected Transactions';
  }, []);

  const getExportTotal = useCallback((transactionsToExport) => {
    return Math.abs(transactionsToExport.reduce((sum, transaction) => (
      sum + Number(transaction.amount || 0)
    ), 0));
  }, []);

  const handleExcelExport = useCallback((exportTransactions, options) => {
    const exportSummaries = summarizeTransactionGroups(exportTransactions);
    const totalLabel = getExportTotalLabel(options.includeExportTypes);
    const exportTotalValue = getExportTotal(exportTransactions);

    const exportData = exportSummaries.map((transaction) => ({
      'Date & Time': transaction.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      Type: getTransactionTypeLabel(transaction.type, transaction.amount),
      Amount: formatInt(transaction.amount),
      Details: transaction.details.size > 0 ? Array.from(transaction.details).join(' | ') : '-',
    }));

    exportData.push({});
    exportData.push({
      'Date & Time': totalLabel,
      Type: '',
      Amount: formatInt(exportTotalValue),
      Details: '',
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Coupon Transactions');
    XLSX.writeFile(wb, `coupon-transactions-${new Date().toISOString().split('T')[0]}.xlsx`);
    showMessage('Excel file exported successfully.', 'success');
  }, [formatInt, getExportTotal, getExportTotalLabel, getTransactionTypeLabel, showMessage, summarizeTransactionGroups]);

  const handlePDFExport = useCallback((exportTransactions, options) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(22, 163, 74);
    doc.text('Coupon Transaction Report', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);

    let dateRangeLabel = 'Period: All time';
    if (options.dateRange === 'custom' && options.customDateFrom && options.customDateTo) {
      dateRangeLabel = `Period: ${options.customDateFrom} to ${options.customDateTo}`;
    } else if (options.dateRange === 'custom' && options.customDateFrom) {
      dateRangeLabel = `Period: From ${options.customDateFrom}`;
    } else if (options.dateRange === 'custom' && options.customDateTo) {
      dateRangeLabel = `Period: Until ${options.customDateTo}`;
    } else if (options.dateRange && options.dateRange !== 'all') {
      dateRangeLabel = `Period: ${options.dateRange.charAt(0).toUpperCase()}${options.dateRange.slice(1)}`;
    }

    doc.text(dateRangeLabel, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

    const exportSummaries = summarizeTransactionGroups(exportTransactions);
    const tableData = exportSummaries.map((transaction) => ([
      transaction.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      getTransactionTypeLabel(transaction.type, transaction.amount),
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
    const totalLabel = getExportTotalLabel(options.includeExportTypes);
    const exportTotalValue = getExportTotal(exportTransactions);

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Summary:', 14, finalY);
    doc.setFont(undefined, 'normal');
    doc.text(`${totalLabel}: ${formatInt(exportTotalValue)}`, 14, finalY + 7);

    doc.save(`coupon-transactions-${new Date().toISOString().split('T')[0]}.pdf`);
    showMessage('PDF file exported successfully.', 'success');
  }, [formatInt, getExportTotal, getExportTotalLabel, getTransactionTypeLabel, showMessage, summarizeTransactionGroups]);

  const escapeHtml = useCallback((value) => {
    return String(value ?? '').replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }, []);

  const handleWordExport = useCallback((exportTransactions, options) => {
    const exportSummaries = summarizeTransactionGroups(exportTransactions);
    const totalLabel = getExportTotalLabel(options.includeExportTypes);
    const exportTotalValue = getExportTotal(exportTransactions);

    let dateRangeLabel = 'Period: All time';
    if (options.dateRange === 'custom' && options.customDateFrom && options.customDateTo) {
      dateRangeLabel = `Period: ${options.customDateFrom} to ${options.customDateTo}`;
    } else if (options.dateRange === 'custom' && options.customDateFrom) {
      dateRangeLabel = `Period: From ${options.customDateFrom}`;
    } else if (options.dateRange === 'custom' && options.customDateTo) {
      dateRangeLabel = `Period: Until ${options.customDateTo}`;
    } else if (options.dateRange && options.dateRange !== 'all') {
      dateRangeLabel = `Period: ${options.dateRange.charAt(0).toUpperCase()}${options.dateRange.slice(1)}`;
    }

    const rowsHtml = exportSummaries.map((transaction) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(transaction.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(getTransactionTypeLabel(transaction.type, transaction.amount))}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${escapeHtml(formatInt(transaction.amount))}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(transaction.details.size > 0 ? Array.from(transaction.details).join(' | ') : '-')}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <title>Coupon Transaction Report</title>
        </head>
        <body>
          <h1 style="font-family:Arial, sans-serif;color:#16a34a;">Coupon Transaction Report</h1>
          <p style="font-family:Arial, sans-serif;color:#374151;">${escapeHtml(dateRangeLabel)}</p>
          <p style="font-family:Arial, sans-serif;color:#374151;">Generated: ${escapeHtml(new Date().toLocaleString())}</p>
          <table style="width:100%;border-collapse:collapse;font-family:Arial, sans-serif;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #ddd;background:#f3f4f6;text-align:left;">Date & Time</th>
                <th style="padding:8px;border:1px solid #ddd;background:#f3f4f6;text-align:left;">Type</th>
                <th style="padding:8px;border:1px solid #ddd;background:#f3f4f6;text-align:right;">Amount</th>
                <th style="padding:8px;border:1px solid #ddd;background:#f3f4f6;text-align:left;">Details</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <p style="font-family:Arial, sans-serif;color:#374151;font-weight:bold;margin-top:16px;">${escapeHtml(totalLabel)}: ${escapeHtml(formatInt(exportTotalValue))}</p>
        </body>
      </html>`;

    const blob = new Blob([html], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const fileName = 'Coupon.docx';
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(anchor.href);

    showMessage('Coupon.docx downloaded successfully.', 'success');
  }, [escapeHtml, formatInt, getExportTotal, getExportTotalLabel, getTransactionTypeLabel, showMessage, summarizeTransactionGroups]);

  const handleWordDownload = useCallback(() => {
    const exportOptions = {
      dateRange: dateFrom || dateTo ? 'custom' : period,
      customDateFrom: dateFrom ? formatLocalDateForApi(dateFrom) : null,
      customDateTo: dateTo ? formatLocalDateForApi(dateTo) : null,
      includeExportTypes: { dispensed: true, added: true, removed: true },
    };

    if (filteredTransactions.length === 0) {
      showMessage('No transactions available to print.', 'error');
      return;
    }

    handleWordExport(filteredTransactions, exportOptions);
  }, [dateFrom, dateTo, filteredTransactions, formatLocalDateForApi, handleWordExport, period, showMessage]);

  const handleExport = useCallback((options) => {
    const exportTransactions = getExportTransactions(options);

    if (exportTransactions.length === 0) {
      showMessage('No data available to export for selected criteria.', 'error');
      return;
    }

    if (options.format === 'excel') {
      handleExcelExport(exportTransactions, options);
    } else if (options.format === 'pdf') {
      handlePDFExport(exportTransactions, options);
    }
  }, [getExportTransactions, handleExcelExport, handlePDFExport, showMessage]);

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


        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ConfirmationNumberOutlinedIcon fontSize="medium" className="text-emerald-600" />
            Coupon Records
          </h1>
          <p className="text-sm text-gray-500 mt-1">For managing coupon balance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <ConfirmationNumberOutlinedIcon fontSize="large" className="text-emerald-600" />
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
            <div className="text-sm font-medium text-gray-700">Total Coupons Dispensed</div>
          </div>

        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Coupon Balance Adjustment</h3>
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
              title="Add coupons"
            >
              <AddIcon fontSize="small" />
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
              title="Subtract coupons"
            >
              <RemoveIcon fontSize="small" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Enter an amount and use the + or − buttons to adjust the balance
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
                <option value="consume">Dispensed</option>
                <option value="adjust-added">Added</option>
                <option value="adjust-removed">Removed</option>
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

            <div className="flex flex-col gap-3 items-stretch md:items-end">
              <button
                onClick={() => setShowExportModal(true)}
                disabled={filteredTransactions.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileDownloadOutlinedIcon fontSize="small" />
                Export
              </button>
              <button
                type="button"
                onClick={handleWordDownload}
                disabled={filteredTransactions.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ReceiptLongOutlinedIcon fontSize="small" />
                Print Coupon.docx
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
                            {getTransactionTypeLabel(transaction.type, transaction.amount)}
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
          showExportTypes={true}
          showDateRange={true}
        />
      </div>
    </div>
  );
};

export default CouponRecords;
