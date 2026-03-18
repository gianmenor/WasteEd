import { useState, useEffect, useMemo } from 'react';
import { getInventoryItems, createInventoryItem, updateInventoryItem, updateItemStock, deleteInventoryItem } from '../config/api';

export default function InventoryManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showQuickStockConfirm, setShowQuickStockConfirm] = useState(false);
  const [quickStockChange, setQuickStockChange] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cost: 1,
    price: '',
    stock: 0,
    isActive: true
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all', // all, available, low-stock, no-stock
    costRange: 'all', // all, low, medium, high
    sortBy: 'name', // name, cost, stock, createdAt
    sortOrder: 'asc' // asc, desc
  });

  const toSafeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeStock = (stock) => {
    const safeStock = Math.floor(toSafeNumber(stock, 0));
    return safeStock < 0 ? 0 : safeStock;
  };

  const formatPrice = (price) => {
    const safePrice = toSafeNumber(price, null);
    if (safePrice === null) return null;
    return `₱${safePrice.toFixed(2)}`;
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await getInventoryItems(false); // Get all items, including inactive
      setItems(response.data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch inventory items');
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await createInventoryItem(formData);
      setShowAddModal(false);
      resetForm();
      setSuccessMessage(`✓ Item "${formData.name}" added successfully!`);
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchItems();
    } catch (err) {
      setError(err.message || 'Failed to create item');
      console.error('Error creating item:', err);
    }
  };

  const handleEditItem = async (e) => {
    e.preventDefault();
    try {
      await updateInventoryItem(selectedItem.id, formData);
      setShowEditModal(false);
      setSelectedItem(null);
      resetForm();
      setSuccessMessage(`✓ Item "${formData.name}" updated successfully!`);
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchItems();
    } catch (err) {
      setError(err.message || 'Failed to update item');
      console.error('Error updating item:', err);
    }
  };

  const handleQuickStockAdjust = (itemId, adjustment) => {
    setQuickStockChange({ itemId, adjustment });
    setShowQuickStockConfirm(true);
  };

  const confirmQuickStock = async () => {
    if (!quickStockChange) return;
    
    try {
      const item = items.find(i => i.id === quickStockChange.itemId);
      await updateItemStock(quickStockChange.itemId, quickStockChange.adjustment);
      setShowQuickStockConfirm(false);
      setQuickStockChange(null);
      setSuccessMessage(`✓ Quick stock adjustment: ${quickStockChange.adjustment > 0 ? '+' : ''}${quickStockChange.adjustment} for "${item?.name}"!`);
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchItems();
    } catch (err) {
      setError(err.message || 'Failed to adjust stock');
      console.error('Error adjusting stock:', err);
      setShowQuickStockConfirm(false);
      setQuickStockChange(null);
    }
  };

  const handleDeleteItem = (id) => {
    setItemToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      const item = items.find(i => i.id === itemToDelete);
      await deleteInventoryItem(itemToDelete);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
      setSuccessMessage(`✓ Item "${item?.name || 'Item'}" deleted successfully!`);
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchItems();
    } catch (err) {
      setError(err.message || 'Failed to delete item');
      console.error('Error deleting item:', err);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      cost: item.cost,
      price: item.price || '',
      stock: item.stock,
      isActive: item.isActive
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      cost: 1,
      price: '',
      stock: 0,
      isActive: true
    });
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      status: 'all',
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

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => {
        const stock = normalizeStock(item.stock);
        if (!item.isActive || stock === 0) return filters.status === 'no-stock';
        if (stock < 20) return filters.status === 'low-stock';
        return filters.status === 'available';
      });
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

      if (filters.sortBy === 'createdAt') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal < bVal) return filters.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [items, filters]);

  const getStockStatus = (item) => {
    const safeStock = normalizeStock(item?.stock);
    if (!item?.isActive || safeStock === 0) return { label: 'No stock', class: 'no-stock' };
    if (safeStock < 20) return { label: 'Low on stock', class: 'low-stock' };
    return { label: 'Available', class: 'available' };
  };

  if (loading) {
    return <div className="p-4 md:p-6 max-w-7xl mx-auto"><div className="text-center py-10 text-lg text-gray-600">Loading inventory...</div></div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-600 mt-1">{filteredAndSortedItems.length} item{filteredAndSortedItems.length !== 1 ? 's' : ''} found</p>
        </div>
        <button className="px-5 py-2.5 border-none rounded-lg text-sm font-semibold cursor-pointer bg-green-600 text-white whitespace-nowrap transition-all hover:bg-green-700 hover:shadow-lg shadow-green-600/20 w-full sm:w-auto" onClick={() => setShowAddModal(true)}>
          + Add New Item
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-5 flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="bg-transparent border-none text-red-800 text-xl cursor-pointer px-2 hover:text-red-600">×</button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-5 flex justify-between items-center">
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="bg-transparent border-none text-green-800 text-xl cursor-pointer px-2 hover:text-green-600">×</button>
        </div>
      )}

      {/* Filters Section - Compact Grid Layout */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 mb-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Search</label>
            <input
              type="text"
              placeholder="Search items..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 transition-colors focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Status</label>
            <select 
              value={filters.status} 
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 transition-colors focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="low-stock">Low on stock (&lt;20)</option>
              <option value="no-stock">No stock</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Cost Range</label>
            <select 
              value={filters.costRange} 
              onChange={(e) => updateFilter('costRange', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 transition-colors focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            >
              <option value="all">All Costs</option>
              <option value="low">Low (≤2)</option>
              <option value="medium">Medium (3-4)</option>
              <option value="high">High (5+)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Sort By</label>
            <select 
              value={filters.sortBy} 
              onChange={(e) => updateFilter('sortBy', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 transition-colors focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            >
              <option value="name">Name</option>
              <option value="cost">Cost</option>
              <option value="stock">Stock</option>
              <option value="createdAt">Date Added</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Order</label>
            <select 
              value={filters.sortOrder} 
              onChange={(e) => updateFilter('sortOrder', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 transition-colors focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>

          <div className="flex items-end">
            <button onClick={resetFilters} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-all bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Items Grid/Table - Responsive Design */}
      <div className="space-y-4">
        {/* Desktop Table View - Hidden on Mobile */}
        <div className="hidden lg:block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Item</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Cost</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Price</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedItems.map(item => {
                const stockStatus = getStockStatus(item);
                return (
                  <tr key={item.id} className={`border-b border-gray-100 transition-all hover:bg-gray-50 ${!item.isActive ? 'opacity-50 bg-gray-50' : ''}`}>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{item.name}</span>
                        {item.description && <span className="text-xs text-gray-500 mt-0.5">{item.description}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        {toSafeNumber(item.cost)} coupon{toSafeNumber(item.cost) !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 font-medium">
                      {formatPrice(item.price) ? formatPrice(item.price) : <span className="text-gray-400">N/A</span>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="inline-flex items-center gap-2 bg-gray-50 py-1.5 px-2.5 rounded-lg border border-gray-200">
                        <button 
                          className="w-6 h-6 p-0 border border-red-400 bg-white rounded text-red-500 font-bold transition-all flex items-center justify-center hover:scale-110 hover:shadow-md hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed" 
                          onClick={() => handleQuickStockAdjust(item.id, -1)}
                          disabled={normalizeStock(item.stock) === 0}
                          title="Decrease"
                        >
                          −
                        </button>
                        <span className={`min-w-[35px] text-center font-bold text-sm ${stockStatus.class === 'available' ? 'text-green-600' : stockStatus.class === 'low-stock' ? 'text-orange-500' : 'text-gray-600'}`}>
                          {normalizeStock(item.stock)}
                        </span>
                        <button 
                          className="w-6 h-6 p-0 border border-green-500 bg-white rounded text-green-600 font-bold transition-all flex items-center justify-center hover:scale-110 hover:shadow-md hover:bg-green-50" 
                          onClick={() => handleQuickStockAdjust(item.id, 1)}
                          title="Increase"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${stockStatus.class === 'available' ? 'bg-emerald-100 text-emerald-800' : stockStatus.class === 'low-stock' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-700'}`}>
                        {stockStatus.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-2 border border-orange-300 bg-white rounded-md text-xs font-medium cursor-pointer transition-all hover:bg-orange-50 hover:border-orange-500 hover:shadow-md" onClick={() => openEditModal(item)} title="Edit">
                          ✏️ Edit
                        </button>
                        <button className="p-2 border border-red-300 bg-white rounded-md text-xs font-medium cursor-pointer transition-all hover:bg-red-50 hover:border-red-500 hover:shadow-md" onClick={() => handleDeleteItem(item.id)} title="Delete">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile/Tablet Card View - Hidden on Desktop */}
        <div className="block lg:hidden space-y-3">
          {filteredAndSortedItems.map(item => {
            const stockStatus = getStockStatus(item);
            return (
              <div key={item.id} className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm transition-all hover:shadow-md ${!item.isActive ? 'opacity-60 bg-gray-50' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-base">{item.name}</h3>
                    {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                  </div>
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${stockStatus.class === 'available' ? 'bg-emerald-100 text-emerald-800' : stockStatus.class === 'low-stock' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-700'}`}>
                    {stockStatus.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="text-xs text-gray-500 font-medium mb-1">Cost</div>
                    <div className="text-sm font-bold text-green-600">{toSafeNumber(item.cost)} coupon{toSafeNumber(item.cost) !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="text-xs text-gray-500 font-medium mb-1">Price</div>
                    <div className="text-sm font-bold text-gray-900">
                      {formatPrice(item.price) ? formatPrice(item.price) : <span className="text-gray-400">N/A</span>}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-xs text-gray-500 font-medium mb-2">Stock Level</div>
                  <div className="inline-flex items-center gap-2 bg-gray-50 py-2 px-3 rounded-lg border border-gray-200 w-full justify-center">
                    <button 
                      className="w-8 h-8 p-0 border border-red-400 bg-white rounded-md text-red-500 font-bold transition-all flex items-center justify-center hover:scale-110 hover:shadow-md hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed" 
                      onClick={() => handleQuickStockAdjust(item.id, -1)}
                      disabled={normalizeStock(item.stock) === 0}
                    >
                      −
                    </button>
                    <span className={`min-w-[45px] text-center font-bold text-lg ${stockStatus.class === 'available' ? 'text-green-600' : stockStatus.class === 'low-stock' ? 'text-orange-500' : 'text-gray-600'}`}>
                      {normalizeStock(item.stock)}
                    </span>
                    <button 
                      className="w-8 h-8 p-0 border border-green-500 bg-white rounded-md text-green-600 font-bold transition-all flex items-center justify-center hover:scale-110 hover:shadow-md hover:bg-green-50" 
                      onClick={() => handleQuickStockAdjust(item.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button className="py-2.5 px-2 border border-orange-300 bg-white rounded-lg text-xs font-medium cursor-pointer transition-all hover:bg-orange-50 hover:border-orange-500 hover:shadow-md" onClick={() => openEditModal(item)}>
                    ✏️ Edit
                  </button>
                  <button className="py-2.5 px-2 border border-red-300 bg-white rounded-lg text-xs font-medium cursor-pointer transition-all hover:bg-red-50 hover:border-red-500 hover:shadow-md" onClick={() => handleDeleteItem(item.id)}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredAndSortedItems.length === 0 && !loading && (
          <div className="text-center py-16 px-5 bg-white border border-gray-200 rounded-xl">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-lg text-gray-600 font-medium mb-2">No items found</p>
            {(filters.search || filters.status !== 'all' || filters.costRange !== 'all') && (
              <button className="mt-4 py-2 px-5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all bg-gray-600 text-white hover:bg-gray-700" onClick={resetFilters}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[1000]" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-7 max-w-[500px] w-[90%] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-5 text-2xl text-gray-900">Add New Item</h3>
            <form onSubmit={handleAddItem}>
              <div className="mb-5">
                <label className="block mb-2 font-medium text-gray-900">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full py-2.5 px-2 border border-gray-300 rounded-md text-sm transition-colors bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              
              <div className="mb-5">
                <label className="block mb-2 font-medium text-gray-900">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  className="w-full py-2.5 px-2 border border-gray-300 rounded-md text-sm transition-colors bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-y"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-5">
                  <label className="block mb-2 font-medium text-gray-900">Cost (coupons) *</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={formData.cost}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 999)) {
                        setFormData({ ...formData, cost: value === '' ? '' : parseInt(value) });
                      }
                    }}
                    required
                    className="w-full py-2.5 px-2 border border-gray-300 rounded-md text-sm transition-colors bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                
                <div className="mb-5">
                  <label className="block mb-2 font-medium text-gray-900">Price (₱)</label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || parseFloat(value) <= 999) {
                        setFormData({ ...formData, price: value });
                      }
                    }}
                    placeholder="Optional"
                    className="w-full py-2.5 px-2 border border-gray-300 rounded-md text-sm transition-colors bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              
              <div className="mb-5">
                <label className="block mb-2 font-medium text-gray-900">Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={formData.stock}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 999)) {
                      setFormData({ ...formData, stock: value === '' ? 0 : parseInt(value) });
                    }
                  }}
                  className="w-full py-2.5 px-2 border border-gray-300 rounded-md text-sm transition-colors bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              
              <div className="mb-5 flex items-center">
                <label className="flex items-center gap-2 m-0 cursor-pointer text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-auto m-0 cursor-pointer"
                  />
                  Available for redemption
                </label>
              </div>
              
              <div className="flex gap-3 mt-6 justify-end">
                <button type="button" className="py-2 px-4 border-none rounded-md text-sm font-medium cursor-pointer transition-all flex-1 bg-gray-500 text-white hover:bg-gray-600 min-w-[100px]" onClick={() => { setShowAddModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="bg-green-600 text-white py-2 px-4 border-none rounded-md text-sm font-medium cursor-pointer transition-all flex-1 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed min-w-[100px]">
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[1000]" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl p-7 max-w-[500px] w-[90%] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-5 text-2xl text-gray-900">Edit Item</h3>
            <form onSubmit={handleEditItem}>
              <div className="mb-5">
                <label className="block mb-2 font-medium text-gray-900">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full py-2.5 px-2 border border-gray-300 rounded-md text-sm transition-colors bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              
              <div className="mb-5">
                <label className="block mb-2 font-medium text-gray-900">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  className="w-full py-2.5 px-2 border border-gray-300 rounded-md text-sm transition-colors bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-y"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-5">
                  <label className="block mb-2 font-medium text-gray-900">Cost (coupons) *</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={formData.cost}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 999)) {
                        setFormData({ ...formData, cost: value === '' ? '' : parseInt(value) });
                      }
                    }}
                    required
                    className="w-full py-2.5 px-2 border border-gray-300 rounded-md text-sm transition-colors bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                
                <div className="mb-5">
                  <label className="block mb-2 font-medium text-gray-900">Price (₱)</label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || parseFloat(value) <= 999) {
                        setFormData({ ...formData, price: value });
                      }
                    }}
                    placeholder="Optional"
                    className="w-full py-2.5 px-2 border border-gray-300 rounded-md text-sm transition-colors bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              
              <div className="mb-5">
                <label className="block mb-2 font-medium text-gray-900">Current Stock</label>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={formData.stock}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 999)) {
                      setFormData({ ...formData, stock: value === '' ? 0 : parseInt(value) });
                    }
                  }}
                  className="w-full py-2.5 px-2 border border-gray-300 rounded-md text-sm transition-colors bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              
              <div className="mb-5 flex items-center">
                <label className="flex items-center gap-2 m-0 cursor-pointer text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-auto m-0 cursor-pointer"
                  />
                  Available for redemption
                </label>
              </div>
              
              <div className="flex gap-3 mt-6 justify-end">
                <button type="button" className="py-2 px-4 border-none rounded-md text-sm font-medium cursor-pointer transition-all flex-1 bg-gray-500 text-white hover:bg-gray-600 min-w-[100px]" onClick={() => { setShowEditModal(false); setSelectedItem(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="bg-green-600 text-white py-2 px-4 border-none rounded-md text-sm font-medium cursor-pointer transition-all flex-1 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed min-w-[100px]">
                  Update Item
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
            <p className="text-gray-700 mb-6">Are you sure you want to delete this item? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                className="py-2 px-4 border border-gray-300 rounded-md text-sm font-medium cursor-pointer transition-all bg-white text-gray-700 hover:bg-gray-50"
                onClick={() => { setShowDeleteConfirm(false); setItemToDelete(null); }}
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

      {/* Quick Stock Adjustment Confirmation Modal */}
      {showQuickStockConfirm && quickStockChange && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Confirm Stock Adjustment</h3>
            <p className="text-gray-700 mb-6">
              {quickStockChange.adjustment > 0 
                ? `Add ${quickStockChange.adjustment} item(s) to stock?`
                : `Remove ${Math.abs(quickStockChange.adjustment)} item(s) from stock?`
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="py-2 px-4 border border-gray-300 rounded-md text-sm font-medium cursor-pointer transition-all bg-white text-gray-700 hover:bg-gray-50"
                onClick={() => { setShowQuickStockConfirm(false); setQuickStockChange(null); }}
              >
                Cancel
              </button>
              <button
                className="py-2 px-4 border-none rounded-md text-sm font-medium cursor-pointer transition-all bg-green-600 text-white hover:bg-green-700"
                onClick={confirmQuickStock}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
