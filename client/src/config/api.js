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
  
  // Bin records
  BIN_RECORDS: `${API_BASE_URL}/api/bin/records`,
  BIN_FULL: `${API_BASE_URL}/api/bin/full`,
  BIN_NOTIFICATIONS_STREAM: `${API_BASE_URL}/api/bin/notifications/stream`,
  BIN_ANALYTICS_SUMMARY: `${API_BASE_URL}/api/bin/analytics/summary`,
  BIN_ANALYTICS_NOTIFICATIONS: `${API_BASE_URL}/api/bin/analytics/notifications`,
  
  // Account analytics
  ACCOUNTS_ANALYTICS: `${API_BASE_URL}/api/accounts/analytics`,
};