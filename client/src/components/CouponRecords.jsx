import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
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
      case 'earn': return '💰';
      case 'consume': return '🎁';
      case 'adjust': return '⚙️';
      default: return '📝';
    }
  };

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
      
      <div className="coupon-header">
        <h1 className="coupon-title">💳 Coupon Management</h1>
        <p className="coupon-subtitle">Track and manage recycling rewards</p>
      </div>

      {message && (
        <div className={`alert ${messageType === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      {/* Balance Card */}
      <div className="balance-section">
        <div className="balance-card">
          <div className="balance-icon">🎟️</div>
          <div className="balance-content">
            <div className="balance-label">Current Balance</div>
            <div className="balance-value">{balance.toFixed(2)}</div>
            <div className="balance-unit">Coupons</div>
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
                  ➕ Add
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
                  ➖ Subtract
                </button>
              </div>
              <small className="form-hint">Enter amount and click Add or Subtract</small>
            </div>
          </form>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="transactions-section">
        <div className="transactions-header">
          <h2 className="transactions-title">Transaction History</h2>
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

        {transactions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
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
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{formatDate(transaction.createdAt)}</td>
                    <td>
                      <span className={`transaction-type ${transaction.type}`}>
                        {getTransactionIcon(transaction.type)} {getTransactionTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td>
                      <span className={`transaction-amount ${Number(transaction.amount) >= 0 ? 'positive' : 'negative'}`}>
                        {Number(transaction.amount) >= 0 ? '+' : ''}
                        {typeof transaction.amount === 'number' && !isNaN(transaction.amount)
                          ? transaction.amount.toFixed(2)
                          : (Number(transaction.amount) ? Number(transaction.amount).toFixed(2) : '0.00')}
                      </span>
                    </td>
                    {/* Removed Balance After cell */}
                    <td className="transaction-details">
                      {transaction.reason || transaction.metadata?.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponRecords;
