import { useState, useEffect, useMemo } from 'react';
import { getInventoryItems, redeemInventoryItem, getRedemptionHistory } from '../config/api';
import { API_ENDPOINTS } from '../config/api';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LoadingSpinner from './LoadingSpinner';

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
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
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
    setCurrentPage(1);
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

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedItems.slice(startIndex, endIndex);
  }, [filteredAndSortedItems, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);
  
  const hasActiveFilters = filters.search || filters.availability !== 'all' || 
    filters.affordability !== 'all' || filters.costRange !== 'all';

  if (loading) {
    return <LoadingSpinner fullscreen message="Loading rewards..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Toast Messages */}
        {error && (
          <div className="fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{error}</span>
              <button className="text-gray-500 hover:text-gray-700 ml-4" onClick={() => setError(null)}>×</button>
            </div>
          </div>
        )}

        {success && (
          <div className="fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg border bg-green-50 border-green-200 text-green-800">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{success}</span>
              <button className="text-gray-500 hover:text-gray-700 ml-4" onClick={() => setSuccess(null)}>×</button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCartIcon />
              Rewards Shop
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Your Balance: <span className="font-bold text-emerald-600">{couponBalance}</span> coupon{couponBalance !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {filteredAndSortedItems.length} reward{filteredAndSortedItems.length !== 1 ? 's' : ''} {hasActiveFilters ? '(filtered)' : 'available'}
            </p>
          </div>
          <button 
            onClick={openHistoryModal}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <HistoryIcon fontSize="small" />
            View History
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-gray-900">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ClearIcon fontSize="small" />
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fontSize="small" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Search rewards..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Availability */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
              <select 
                value={filters.availability} 
                onChange={(e) => updateFilter('availability', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Items</option>
                <option value="available">In Stock</option>
                <option value="unavailable">Out of Stock</option>
              </select>
            </div>

            {/* Affordability */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Affordability</label>
              <select 
                value={filters.affordability} 
                onChange={(e) => updateFilter('affordability', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Prices</option>
                <option value="affordable">Can Afford</option>
                <option value="too-expensive">Too Expensive</option>
              </select>
            </div>

            {/* Cost Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cost Range</label>
              <select 
                value={filters.costRange} 
                onChange={(e) => updateFilter('costRange', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Costs</option>
                <option value="low">Low (≤2)</option>
                <option value="medium">Medium (3-4)</option>
                <option value="high">High (5+)</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select 
                value={filters.sortBy} 
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="name">Name</option>
                <option value="cost">Cost</option>
                <option value="stock">Stock</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
              <select 
                value={filters.sortOrder} 
                onChange={(e) => updateFilter('sortOrder', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rewards Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-base font-semibold text-gray-900">Available Rewards</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Show:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {filteredAndSortedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <ShoppingCartIcon className="text-6xl mb-3 text-gray-300" />
              <p className="text-sm">No rewards found</p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Clear filters to see all rewards
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
                        Reward
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedItems.map(item => {
                      const affordable = canAfford(item);
                      const available = item.stock > 0;
                      const canRedeem = affordable && available;
                      
                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-gray-50 transition-colors ${!canRedeem ? 'opacity-60' : ''}`}
                        >
                          <td className="px-5 py-4 text-sm font-medium text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">
                            {item.description || 'No description'}
                          </td>
                          <td className="px-5 py-4 text-sm text-right">
                            <span className={`font-semibold ${affordable ? 'text-emerald-600' : 'text-red-600'}`}>
                              {item.cost}
                            </span>
                            <span className="text-gray-500 ml-1 text-xs">coupons</span>
                          </td>
                          <td className="px-5 py-4 text-sm text-right">
                            <span className={`font-semibold ${
                              item.stock === 0 ? 'text-red-600' : 
                              item.stock < 10 ? 'text-amber-600' : 
                              'text-emerald-600'
                            }`}>
                              {item.stock}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-center">
                            {!available && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Out of Stock
                              </span>
                            )}
                            {available && !affordable && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                Too Expensive
                              </span>
                            )}
                            {available && affordable && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                Available
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm text-center">
                            <button 
                              onClick={() => openRedeemModal(item)}
                              disabled={!canRedeem}
                              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                                canRedeem
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
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
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-5 py-4 border-t border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs sm:text-sm text-gray-700">
                    Showing <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, filteredAndSortedItems.length)}
                    </span> of{' '}
                    <span className="font-medium">{filteredAndSortedItems.length}</span> results
                  </div>
                  <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2">
                    <span className="text-xs text-gray-600 sm:hidden">
                      Page {currentPage} of {totalPages}
                    </span>

                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeftIcon fontSize="small" />
                    </button>
                    
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                        // Show first page, last page, current page, and pages around current
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                currentPage === page
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="text-gray-400">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRightIcon fontSize="small" />
                    </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Redeem Modal */}
        {showRedeemModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowRedeemModal(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Redeem {selectedItem.name}</h3>
              </div>
              
              <div className="px-6 py-4 space-y-4">
                <p className="text-sm text-gray-600">{selectedItem.description}</p>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cost per item:</span>
                    <span className="font-semibold text-gray-900">{selectedItem.cost} coupons</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Available stock:</span>
                    <span className="font-semibold text-gray-900">{selectedItem.stock}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Your balance:</span>
                    <span className="font-semibold text-emerald-600">{couponBalance} coupons</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button 
                      type="button" 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      className="flex-1 text-center px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button 
                      type="button" 
                      onClick={() => setQuantity(Math.min(maxAffordable(selectedItem), quantity + 1))}
                      disabled={quantity >= maxAffordable(selectedItem)}
                      className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Max: {maxAffordable(selectedItem)}</p>
                </div>

                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-700">Total Cost:</span>
                    <span className="font-bold text-gray-900">{selectedItem.cost * quantity} coupons</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Remaining Balance:</span>
                    <span className="font-bold text-emerald-600">{couponBalance - (selectedItem.cost * quantity)} coupons</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowRedeemModal(false);
                    setSelectedItem(null);
                    setQuantity(1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleRedeem}
                  disabled={!canAfford(selectedItem, quantity) || quantity > selectedItem.stock}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm Redemption
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {showHistoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowHistoryModal(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <HistoryIcon />
                  Redemption History
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner message="Loading history..." />
                  </div>
                ) : redemptionHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <HistoryIcon className="text-6xl mb-3 text-gray-300" />
                    <p className="text-sm">No redemptions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {redemptionHistory.map(redemption => (
                      <div key={redemption.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900">{redemption.item.name}</h4>
                          <span className="text-xs text-gray-500">
                            {new Date(redemption.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-gray-600">
                            Quantity: <span className="font-medium text-gray-900">{redemption.quantity}</span>
                          </span>
                          <span className="text-gray-600">
                            Cost: <span className="font-medium text-emerald-600">{redemption.totalCost} coupons</span>
                          </span>
                        </div>
                        {redemption.notes && (
                          <p className="text-sm text-gray-600 mt-2 italic">{redemption.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowHistoryModal(false)}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
