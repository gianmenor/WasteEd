import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePreferences } from '../contexts/PreferencesContext';
import { API_ENDPOINTS } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import './ProfitRewards.css';

// Fetch profit/reward records
const fetchRecords = async (year, month) => {
  const token = localStorage.getItem('token');
  let url = API_ENDPOINTS.PROFIT_RECORDS;
  
  const params = new URLSearchParams();
  if (year) params.append('year', year);
  if (month) params.append('month', month);
  
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
  return data.records || [];
};

// Fetch summary
const fetchSummary = async (period) => {
  const token = localStorage.getItem('token');
  const url = `${API_ENDPOINTS.PROFIT_SUMMARY}?period=${period}`;
  
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
  return data.summary || {};
};

const ProfitRewards = () => {
  const { preferences } = usePreferences();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [period, setPeriod] = useState('month');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    type: 'PROFIT',
    amount: '',
    source: '',
    description: ''
  });
  
  const [editingId, setEditingId] = useState(null);

  // Fetch records
  const { data: records = [], isLoading: recordsLoading, refetch: refetchRecords } = useQuery({
    queryKey: ['profitRecords', selectedYear, selectedMonth],
    queryFn: () => fetchRecords(selectedYear, selectedMonth),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch summary
  const { data: summary = {}, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['profitSummary', period],
    queryFn: () => fetchSummary(period),
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

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      showMessage('Please enter a valid amount', 'error');
      return;
    }

    if (!formData.source.trim()) {
      showMessage('Please provide a source', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      
      if (editingId) {
        // Update existing record
        const response = await fetch(`${API_ENDPOINTS.PROFIT_UPDATE}/${editingId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: formData.type,
            amount,
            source: formData.source,
            description: formData.description || null
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
        // Add new record
        const response = await fetch(API_ENDPOINTS.PROFIT_ADD, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: formData.type,
            amount,
            source: formData.source,
            description: formData.description || null
          })
        });

        if (response.ok) {
          showMessage('Record added successfully');
        } else {
          const error = await response.json();
          showMessage(error.message || 'Failed to add record', 'error');
        }
      }
      
      // Reset form
      setFormData({
        type: 'PROFIT',
        amount: '',
        source: '',
        description: ''
      });
      
      refetchRecords();
      refetchSummary();
    } catch (error) {
      showMessage('Operation failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingId, refetchRecords, refetchSummary, showMessage]);

  const handleEdit = useCallback((record) => {
    setEditingId(record.id);
    setFormData({
      type: record.type,
      amount: record.amount.toString(),
      source: record.source,
      description: record.description || ''
    });
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
      type: 'PROFIT',
      amount: '',
      source: '',
      description: ''
    });
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }, []);

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

      {/* Header */}
      <div className="profit-header">
        <h1 className="profit-title">
          <span>💰</span> Profit & Rewards
        </h1>
        <p className="profit-subtitle">
          Track earnings from recyclables and rewards given out
        </p>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`alert ${messageType === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-section">
        <div className="period-selector">
          <label>Summary Period:</label>
          <select
            className="period-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>

        <div className="summary-cards">
          <div className="summary-card profit">
            <div className="summary-icon">💵</div>
            <div className="summary-content">
              <div className="summary-label">Total Profit</div>
              <div className="summary-value">{formatCurrency(summary.totalProfit || 0)}</div>
              <div className="summary-hint">From recyclables</div>
            </div>
          </div>

          <div className="summary-card rewards">
            <div className="summary-icon">🎁</div>
            <div className="summary-content">
              <div className="summary-label">Total Rewards</div>
              <div className="summary-value">{formatCurrency(summary.totalRewards || 0)}</div>
              <div className="summary-hint">Given to users</div>
            </div>
          </div>

          <div className="summary-card net">
            <div className="summary-icon">📊</div>
            <div className="summary-content">
              <div className="summary-label">Net Profit</div>
              <div className="summary-value">{formatCurrency(summary.netProfit || 0)}</div>
              <div className="summary-hint">Profit - Rewards</div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="form-section">
        <h2 className="form-title">
          {editingId ? '✏️ Edit Record' : '➕ Add New Record'}
        </h2>
        <form className="profit-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="type">Type</label>
              <select
                id="type"
                className="form-input"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                disabled={isSubmitting}
              >
                <option value="PROFIT">Profit (from recyclables)</option>
                <option value="REWARD">Reward (given to users)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="amount">Amount ($)</label>
              <input
                id="amount"
                type="number"
                step="0.01"
                className="form-input"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="source">Source</label>
              <input
                id="source"
                type="text"
                className="form-input"
                value={formData.source}
                onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                placeholder="e.g., Plastic bottles sale"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              className="form-input form-textarea"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Additional details..."
              disabled={isSubmitting}
              rows="3"
            />
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : editingId ? 'Update Record' : 'Add Record'}
            </button>
            
            {editingId && (
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Records Table */}
      <div className="records-section">
        <div className="records-header">
          <h2 className="records-title">Records</h2>
          <div className="filter-controls">
            <label>Year:</label>
            <select
              className="filter-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            
            <label>Month:</label>
            <select
              className="filter-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
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
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Source</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDate(record.date)}</td>
                    <td>
                      <span className={`record-type ${record.type.toLowerCase()}`}>
                        {record.type === 'PROFIT' ? '💵 Profit' : '🎁 Reward'}
                      </span>
                    </td>
                    <td>
                      <span className={`record-amount ${record.type.toLowerCase()}`}>
                        {formatCurrency(record.amount)}
                      </span>
                    </td>
                    <td>{record.source}</td>
                    <td>
                      <span className="record-description" title={record.description}>
                        {record.description || '-'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-action btn-edit"
                          onClick={() => handleEdit(record)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(record.id)}
                          title="Delete"
                        >
                          🗑️
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
    </div>
  );
};

export default ProfitRewards;
