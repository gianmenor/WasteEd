import { useState, useEffect, useMemo } from 'react';
import { getInventoryItems, redeemInventoryItem, getRedemptionHistory } from '../config/api';
import { API_ENDPOINTS } from '../config/api';
import './RewardsShop.css';

export default function RewardsShop() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [redemptionHistory, setRedemptionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [couponBalance, setCouponBalance] = useState(0);
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    availability: 'all', // all, available, unavailable
    affordability: 'all', // all, affordable, too-expensive
    costRange: 'all', // all, low, medium, high
    sortBy: 'name', // name, cost, stock
    sortOrder: 'asc' // asc, desc
  });

  useEffect(() => {
    fetchItems();
    fetchCouponBalance();
  }, []);

  const fetchCouponBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.COUPON_BALANCE, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch coupon balance');
      }

      const data = await response.json();
      setCouponBalance(data.data?.balance || 0);
    } catch (err) {
      console.error('Error fetching coupon balance:', err);
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await getInventoryItems(true); // Only get active items
      setItems(response.data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load rewards');
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await getRedemptionHistory();
      setRedemptionHistory(response.data.redemptions);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openRedeemModal = (item) => {
    setSelectedItem(item);
    setQuantity(1);
    setShowRedeemModal(true);
  };

  const openHistoryModal = () => {
    setShowHistoryModal(true);
    fetchHistory();
  };

  const handleRedeem = async () => {
    if (!selectedItem) return;

    const totalCost = selectedItem.cost * quantity;
    
    if (totalCost > couponBalance) {
      setError('Insufficient coupon balance');
      return;
    }

    if (quantity > selectedItem.stock) {
      setError('Not enough items in stock');
      return;
    }

    try {
      await redeemInventoryItem(selectedItem.id, quantity);
      setSuccess(`Successfully redeemed ${quantity}x ${selectedItem.name}!`);
      setShowRedeemModal(false);
      setSelectedItem(null);
      setQuantity(1);
      fetchItems();
      
      // Refresh coupon balance
      fetchCouponBalance();

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to redeem item');
      console.error('Error redeeming item:', err);
    }
  };

  const canAfford = (item, qty = 1) => {
    return couponBalance >= (item.cost * qty);
  };

  const maxAffordable = (item) => {
    return Math.min(Math.floor(couponBalance / item.cost), item.stock);
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      availability: 'all',
      affordability: 'all',
      costRange: 'all',
      sortBy: 'name',
      sortOrder: 'asc'
    });
  };

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...items];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
      );
    }

    // Availability filter
    if (filters.availability !== 'all') {
      filtered = filtered.filter(item => 
        filters.availability === 'available' ? item.stock > 0 : item.stock === 0
      );
    }

    // Affordability filter
    if (filters.affordability !== 'all') {
      filtered = filtered.filter(item => 
        filters.affordability === 'affordable' ? item.cost <= couponBalance : item.cost > couponBalance
      );
    }

    // Cost range filter
    if (filters.costRange !== 'all') {
      filtered = filtered.filter(item => {
        if (filters.costRange === 'low') return item.cost <= 2;
        if (filters.costRange === 'medium') return item.cost > 2 && item.cost <= 4;
        if (filters.costRange === 'high') return item.cost > 4;
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[filters.sortBy];
      let bVal = b[filters.sortBy];

      if (aVal < bVal) return filters.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [items, filters, couponBalance]);

  const canRedeemItem = (item) => item.stock > 0 && canAfford(item, 1);

  if (loading) {
    return <div className="rewards-shop"><div className="loading">Loading rewards...</div></div>;
  }

  return (
    <div className="rewards-shop">
      <div className="shop-header">
        <div>
          <h2>Rewards Shop</h2>
          <p className="balance-display">
            Your Balance: <strong>{couponBalance}</strong> coupon{couponBalance !== 1 ? 's' : ''}
          </p>
          <p className="subtitle">{filteredAndSortedItems.length} reward{filteredAndSortedItems.length !== 1 ? 's' : ''} available {filters.search || filters.availability !== 'all' || filters.affordability !== 'all' || filters.costRange !== 'all' ? '(filtered)' : ''}</p>
        </div>
        <button className="btn-secondary" onClick={openHistoryModal}>
          View History
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group filter-group--search">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search rewards..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Availability</label>
            <select 
              value={filters.availability} 
              onChange={(e) => updateFilter('availability', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Items</option>
              <option value="available">In Stock</option>
              <option value="unavailable">Out of Stock</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Affordability</label>
            <select 
              value={filters.affordability} 
              onChange={(e) => updateFilter('affordability', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Prices</option>
              <option value="affordable">Can Afford</option>
              <option value="too-expensive">Too Expensive</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Cost Range</label>
            <select 
              value={filters.costRange} 
              onChange={(e) => updateFilter('costRange', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Costs</option>
              <option value="low">Low (≤2)</option>
              <option value="medium">Medium (3-4)</option>
              <option value="high">High (5+)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Sort By</label>
            <select 
              value={filters.sortBy} 
              onChange={(e) => updateFilter('sortBy', e.target.value)}
              className="filter-select"
            >
              <option value="name">Name</option>
              <option value="cost">Cost</option>
              <option value="stock">Stock</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Order</label>
            <select 
              value={filters.sortOrder} 
              onChange={(e) => updateFilter('sortOrder', e.target.value)}
              className="filter-select"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>

          <div className="filter-group">
            <label>&nbsp;</label>
            <button onClick={resetFilters} className="btn-reset">
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="table-container">
        <table className="rewards-table">
          <thead>
            <tr>
              <th>Reward</th>
              <th>Description</th>
              <th>Cost</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedItems.map(item => {
              const affordable = canAfford(item);
              const available = item.stock > 0;
              const canRedeem = affordable && available;
              
              return (
                <tr key={item.id} className={!canRedeem ? 'unavailable-row' : ''}>
                  <td className="reward-name">{item.name}</td>
                  <td className="reward-description">{item.description || 'No description'}</td>
                  <td className="reward-cost">
                    <span className={affordable ? 'affordable' : 'too-expensive'}>
                      {item.cost} coupons
                    </span>
                  </td>
                  <td className="reward-stock">
                    <span className={item.stock === 0 ? 'out' : item.stock < 10 ? 'low' : 'good'}>
                      {item.stock}
                    </span>
                  </td>
                  <td>
                    {!available && (
                      <span className="status-badge out-of-stock">Out of Stock</span>
                    )}
                    {available && !affordable && (
                      <span className="status-badge too-expensive">Too Expensive</span>
                    )}
                    {available && affordable && (
                      <span className="status-badge available">Available</span>
                    )}
                  </td>
                  <td className="action-cell">
                    <button 
                      className="btn-redeem-small"
                      onClick={() => openRedeemModal(item)}
                      disabled={!canRedeem}
                      title={!canRedeem ? (!available ? 'Out of stock' : 'Not enough coupons') : 'Redeem this reward'}
                    >
                      {canRedeem ? 'Redeem' : 'Locked'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAndSortedItems.length === 0 && !loading && (
          <div className="empty-state">
            <p>No rewards found matching your filters.</p>
            {(filters.search || filters.availability !== 'all' || filters.affordability !== 'all' || filters.costRange !== 'all') && (
              <button className="btn-secondary" onClick={resetFilters}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Redeem Modal */}
      {showRedeemModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowRedeemModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Redeem {selectedItem.name}</h3>
            
            <div className="item-preview">
              <p className="description">{selectedItem.description}</p>
              <div className="item-details">
                <p>Cost per item: <strong>{selectedItem.cost} coupons</strong></p>
                <p>Available stock: <strong>{selectedItem.stock}</strong></p>
                <p>Your balance: <strong>{couponBalance} coupons</strong></p>
              </div>
            </div>

            <div className="quantity-selector">
              <label>Quantity:</label>
              <div className="quantity-controls">
                <button 
                  type="button" 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max={maxAffordable(selectedItem)}
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setQuantity(Math.min(Math.max(1, val), maxAffordable(selectedItem)));
                  }}
                />
                <button 
                  type="button" 
                  onClick={() => setQuantity(Math.min(maxAffordable(selectedItem), quantity + 1))}
                  disabled={quantity >= maxAffordable(selectedItem)}
                >
                  +
                </button>
              </div>
              <small>Max: {maxAffordable(selectedItem)}</small>
            </div>

            <div className="redemption-summary">
              <div className="summary-row">
                <span>Total Cost:</span>
                <strong>{selectedItem.cost * quantity} coupons</strong>
              </div>
              <div className="summary-row">
                <span>Remaining Balance:</span>
                <strong>{couponBalance - (selectedItem.cost * quantity)} coupons</strong>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => {
                  setShowRedeemModal(false);
                  setSelectedItem(null);
                  setQuantity(1);
                }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleRedeem}
                disabled={!canAfford(selectedItem, quantity) || quantity > selectedItem.stock}
              >
                Confirm Redemption
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>Redemption History</h3>
            
            {historyLoading ? (
              <div className="loading">Loading history...</div>
            ) : redemptionHistory.length === 0 ? (
              <div className="empty-state">
                <p>No redemptions yet.</p>
              </div>
            ) : (
              <div className="history-list">
                {redemptionHistory.map(redemption => (
                  <div key={redemption.id} className="history-item">
                    <div className="history-header">
                      <h4>{redemption.item.name}</h4>
                      <span className="date">
                        {new Date(redemption.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="history-details">
                      <span>Quantity: {redemption.quantity}</span>
                      <span>Cost: {redemption.totalCost} coupons</span>
                    </div>
                    {redemption.notes && (
                      <p className="notes">{redemption.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowHistoryModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
