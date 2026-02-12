import { useState, useEffect, useMemo } from 'react';
import { getInventoryItems, createInventoryItem, updateInventoryItem, updateItemStock, deleteInventoryItem } from '../config/api';
import './InventoryManagement.css';

export default function InventoryManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cost: 1,
    price: '',
    stock: 0,
    isActive: true
  });
  const [stockAdjustment, setStockAdjustment] = useState(0);
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all', // all, active, inactive
    stockLevel: 'all', // all, in-stock, low-stock, out-of-stock
    costRange: 'all', // all, low, medium, high
    sortBy: 'name', // name, cost, stock, createdAt
    sortOrder: 'asc' // asc, desc
  });

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
      fetchItems();
    } catch (err) {
      setError(err.message || 'Failed to update item');
      console.error('Error updating item:', err);
    }
  };

  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    try {
      await updateItemStock(selectedItem.id, stockAdjustment);
      setShowStockModal(false);
      setSelectedItem(null);
      setStockAdjustment(0);
      fetchItems();
    } catch (err) {
      setError(err.message || 'Failed to adjust stock');
      console.error('Error adjusting stock:', err);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteInventoryItem(id);
      fetchItems();
    } catch (err) {
      setError(err.message || 'Failed to delete item');
      console.error('Error deleting item:', err);
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

  const openStockModal = (item) => {
    setSelectedItem(item);
    setStockAdjustment(0);
    setShowStockModal(true);
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
      stockLevel: 'all',
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
      filtered = filtered.filter(item => 
        filters.status === 'active' ? item.isActive : !item.isActive
      );
    }

    // Stock level filter
    if (filters.stockLevel !== 'all') {
      filtered = filtered.filter(item => {
        if (filters.stockLevel === 'out-of-stock') return item.stock === 0;
        if (filters.stockLevel === 'low-stock') return item.stock > 0 && item.stock < 10;
        if (filters.stockLevel === 'in-stock') return item.stock >= 10;
        return true;
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

  const getStockStatus = (stock) => {
    if (stock === 0) return { label: 'Out of Stock', class: 'out-of-stock' };
    if (stock < 10) return { label: 'Low Stock', class: 'low-stock' };
    return { label: 'In Stock', class: 'in-stock' };
  };

  if (loading) {
    return <div className="inventory-management"><div className="loading">Loading inventory...</div></div>;
  }

  return (
    <div className="inventory-management">
      <div className="inventory-header">
        <div>
          <h2>Inventory Management</h2>
          <p className="subtitle">{filteredAndSortedItems.length} item{filteredAndSortedItems.length !== 1 ? 's' : ''} {filters.search || filters.status !== 'all' || filters.stockLevel !== 'all' || filters.costRange !== 'all' ? '(filtered)' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          + Add New Item
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group filter-group--search">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search by name or description..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select 
              value={filters.status} 
              onChange={(e) => updateFilter('status', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Stock Level</label>
            <select 
              value={filters.stockLevel} 
              onChange={(e) => updateFilter('stockLevel', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Levels</option>
              <option value="in-stock">In Stock (≥10)</option>
              <option value="low-stock">Low Stock (1-9)</option>
              <option value="out-of-stock">Out of Stock (0)</option>
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
              <option value="createdAt">Date Added</option>
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
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Cost</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Stock Status</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedItems.map(item => {
              const stockStatus = getStockStatus(item.stock);
              return (
                <tr key={item.id} className={!item.isActive ? 'inactive-row' : ''}>
                  <td className="item-name" data-label="Name">{item.name}</td>
                  <td className="item-cost" data-label="Cost">{item.cost} coupon{item.cost !== 1 ? 's' : ''}</td>
                  <td className="item-price" data-label="Price">
                    {item.price !== null && item.price !== undefined ? `₱${parseFloat(item.price).toFixed(2)}` : 'N/A'}
                  </td>
                  <td className="item-stock" data-label="Stock">
                    <span className={stockStatus.class}>{item.stock}</span>
                  </td>
                  <td data-label="Stock Status">
                    <span className={`stock-badge ${stockStatus.class}`}>
                      {stockStatus.label}
                    </span>
                  </td>
                  <td data-label="Status">
                    <span className={`status-badge ${item.isActive ? 'active' : 'inactive'}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="actions-cell" data-label="Actions">
                    <button className="btn-action btn-stock" onClick={() => openStockModal(item)} title="Adjust stock">
                      Stock
                    </button>
                    <button className="btn-action btn-edit" onClick={() => openEditModal(item)} title="Edit item">
                      Edit
                    </button>
                    <button className="btn-action btn-delete" onClick={() => handleDeleteItem(item.id)} title="Delete item">
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAndSortedItems.length === 0 && !loading && (
          <div className="empty-state">
            <p>No items found matching your filters.</p>
            {(filters.search || filters.status !== 'all' || filters.stockLevel !== 'all' || filters.costRange !== 'all') && (
              <button className="btn-secondary" onClick={resetFilters}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Item</h3>
            <form onSubmit={handleAddItem}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Cost (coupons) *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: parseInt(e.target.value) })}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Price (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                />
              </div>
              
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Active (available for redemption)
                </label>
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowAddModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Item</h3>
            <form onSubmit={handleEditItem}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Cost (coupons) *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: parseInt(e.target.value) })}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Price (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Current Stock</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                />
              </div>
              
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Active (available for redemption)
                </label>
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowEditModal(false); setSelectedItem(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Update Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowStockModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Adjust Stock: {selectedItem.name}</h3>
            <p className="current-stock">Current Stock: <strong>{selectedItem.stock}</strong></p>
            
            <form onSubmit={handleStockAdjustment}>
              <div className="form-group">
                <label>Adjustment Amount</label>
                <input
                  type="number"
                  value={stockAdjustment}
                  onChange={(e) => setStockAdjustment(parseInt(e.target.value))}
                  placeholder="Enter positive to add, negative to remove"
                  required
                />
                <small className="help-text">
                  {stockAdjustment > 0 && `Will add ${stockAdjustment} items`}
                  {stockAdjustment < 0 && `Will remove ${Math.abs(stockAdjustment)} items`}
                  {stockAdjustment === 0 && 'Enter an adjustment amount'}
                </small>
              </div>
              
              {stockAdjustment !== 0 && (
                <p className="new-stock">
                  New Stock: <strong>{selectedItem.stock + stockAdjustment}</strong>
                </p>
              )}
              
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowStockModal(false); setSelectedItem(null); setStockAdjustment(0); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={stockAdjustment === 0}>
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
