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
  return data.transactions || [];
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
    onSuccess: () => {
      queryClient.invalidateQueries(['couponBalance']);
      queryClient.invalidateQueries(['couponTransactions']);
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
    const amount = parseFloat(adjustmentAmount);
    
    if (isNaN(amount) || amount === 0) {
      showMessage('Please enter a valid amount', 'error');
      return;
    }

    if (!adjustmentReason.trim()) {
      showMessage('Please provide a reason for the adjustment', 'error');
      return;
    }

    adjustMutation.mutate({ amount, reason: adjustmentReason });
  }, [adjustmentAmount, adjustmentReason, adjustMutation, showMessage]);

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

  const balance = balanceData?.balance || 0;
  const loading = balanceLoading || transactionsLoading;

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
          <h3 className="adjustment-title">Manual Adjustment</h3>
          <form onSubmit={handleAdjustment} className="adjustment-form">
            <div className="form-group">
              <label htmlFor="amount">Amount</label>
              <input
                id="amount"
                type="number"
                step="0.01"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="e.g., 10 or -5"
                className="form-input"
              />
              <small className="form-hint">Use positive for add, negative for deduct</small>
            </div>
            <div className="form-group">
              <label htmlFor="reason">Reason</label>
              <input
                id="reason"
                type="text"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="e.g., Bonus reward"
                className="form-input"
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={adjustMutation.isPending}
            >
              {adjustMutation.isPending ? 'Processing...' : 'Apply Adjustment'}
            </button>
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
                  <th>Balance After</th>
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
                      <span className={`transaction-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}`}>
                        {transaction.amount >= 0 ? '+' : ''}{transaction.amount.toFixed(2)}
                      </span>
                    </td>
                    <td>{transaction.balanceAfter.toFixed(2)}</td>
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
