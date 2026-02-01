// API Configuration
// This automatically detects the environment and sets the correct API base URL

const getApiBaseUrl = () => {
  // In production, use relative URLs (same domain as the frontend)
  // In development, use localhost:3000
  
  if (import.meta.env.MODE === 'production') {
    // Production: Use relative URLs, the backend serves the frontend
    return '';
  } else {
    // Development: Use localhost for local development
    return 'http://localhost:3000';
  }
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to create full API URLs
export const createApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/api/${cleanEndpoint}`;
};

// Export individual API endpoints for convenience
export const API_ENDPOINTS = {
  // Auth endpoints
  VALIDATE_TOKEN: `${API_BASE_URL}/api/accounts/validate`,
  LOGIN: `${API_BASE_URL}/api/accounts/login`,
  LOGOUT: `${API_BASE_URL}/api/accounts/logout`,
  USER_ROLE: `${API_BASE_URL}/api/accounts/role`,
  
  // User preferences
  PREFERENCES: `${API_BASE_URL}/api/accounts/preferences`,
  
  // Waste records
  WASTE_RECORDS: `${API_BASE_URL}/api/waste/records`,
  WASTE_ANALYTICS: `${API_BASE_URL}/api/waste/analytics`,
  WASTE_ADD: `${API_BASE_URL}/api/waste/add`,
  WASTE_DELETE_TODAY: `${API_BASE_URL}/api/waste/delete-today`,
  
  // Bin records
  BIN_RECORDS: `${API_BASE_URL}/api/bin/records`,
  BIN_FULL: `${API_BASE_URL}/api/bin/full`,
  BIN_NOTIFICATIONS_STREAM: `${API_BASE_URL}/api/bin/notifications/stream`,
  BIN_ANALYTICS_SUMMARY: `${API_BASE_URL}/api/bin/analytics/summary`,
  BIN_ANALYTICS_NOTIFICATIONS: `${API_BASE_URL}/api/bin/analytics/notifications`,
  
  // Coupon endpoints
  COUPON_BALANCE: `${API_BASE_URL}/api/coupon/balance`,
  COUPON_TRANSACTIONS: `${API_BASE_URL}/api/coupon/transactions`,
  COUPON_ADD: `${API_BASE_URL}/api/coupon/add`,
  COUPON_ADJUST: `${API_BASE_URL}/api/coupon/adjust`,
  COUPON_SUMMARY: `${API_BASE_URL}/api/coupon/summary`,
  
  // Profit & Rewards endpoints
  PROFIT_RECORDS: `${API_BASE_URL}/api/profit/records`,
  PROFIT_ADD: `${API_BASE_URL}/api/profit/add`,
  PROFIT_UPDATE: `${API_BASE_URL}/api/profit/update`,
  PROFIT_DELETE: `${API_BASE_URL}/api/profit/delete`,
  PROFIT_SUMMARY: `${API_BASE_URL}/api/profit/summary`,
  PROFIT_NET_PROFIT: `${API_BASE_URL}/api/profit/net-profit`,
  
  // Video endpoints
  VIDEO_MAPPING: `${API_BASE_URL}/api/video/mapping`,
  VIDEO_MAPPING_BY_TYPE: (wasteType) => `${API_BASE_URL}/api/video/mapping/${wasteType}`,
  VIDEO_UPLOAD: `${API_BASE_URL}/api/video/upload`,
  VIDEO_UPDATE: (wasteType) => `${API_BASE_URL}/api/video/update/${wasteType}`,
  VIDEO_DELETE: (wasteType) => `${API_BASE_URL}/api/video/delete/${wasteType}`,
  VIDEO_LIST: (wasteType) => `${API_BASE_URL}/api/video/list/${wasteType}`,
  VIDEO_SIGNED_URL: (wasteType) => `${API_BASE_URL}/api/video/signed-url/${wasteType}`,
  
  // Account analytics
  ACCOUNTS_ANALYTICS: `${API_BASE_URL}/api/accounts/analytics`,
  
  // Inventory endpoints
  INVENTORY_ITEMS: `${API_BASE_URL}/api/inventory`,
  INVENTORY_ITEM: (id) => `${API_BASE_URL}/api/inventory/${id}`,
  INVENTORY_STOCK: (id) => `${API_BASE_URL}/api/inventory/${id}/stock`,
  INVENTORY_REDEEM: (id) => `${API_BASE_URL}/api/inventory/${id}/redeem`,
  INVENTORY_REDEMPTION_HISTORY: `${API_BASE_URL}/api/inventory/redemptions/history`,
};

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Inventory API functions
export const getInventoryItems = async (activeOnly = true) => {
  const response = await fetch(`${API_ENDPOINTS.INVENTORY_ITEMS}?activeOnly=${activeOnly}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch inventory items');
  }
  return await response.json();
};

export const getInventoryItem = async (id) => {
  const response = await fetch(API_ENDPOINTS.INVENTORY_ITEM(id));
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch inventory item');
  }
  return await response.json();
};

export const createInventoryItem = async (itemData) => {
  const response = await fetch(API_ENDPOINTS.INVENTORY_ITEMS, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(itemData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create inventory item');
  }
  return await response.json();
};

export const updateInventoryItem = async (id, itemData) => {
  const response = await fetch(API_ENDPOINTS.INVENTORY_ITEM(id), {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(itemData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update inventory item');
  }
  return await response.json();
};

export const updateItemStock = async (id, adjustment) => {
  const response = await fetch(API_ENDPOINTS.INVENTORY_STOCK(id), {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ adjustment })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update stock');
  }
  return await response.json();
};

export const deleteInventoryItem = async (id) => {
  const response = await fetch(API_ENDPOINTS.INVENTORY_ITEM(id), {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete inventory item');
  }
  return await response.json();
};

export const redeemInventoryItem = async (id, quantity, notes = null) => {
  const response = await fetch(API_ENDPOINTS.INVENTORY_REDEEM(id), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ quantity, notes })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to redeem item');
  }
  return await response.json();
};

export const getRedemptionHistory = async (page = 1, limit = 20) => {
  const response = await fetch(`${API_ENDPOINTS.INVENTORY_REDEMPTION_HISTORY}?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch redemption history');
  }
  return await response.json();
};