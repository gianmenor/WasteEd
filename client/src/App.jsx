import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import WasteTable from './components/WasteTable';
import Analytics from './components/Analytics';
import './App.css';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">⚡</div>
        <p>Loading...</p>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Main App Content
const AppContent = () => {
  const { isAuthenticated, user, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">⚡</div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
            <Navigate to="/" replace /> : 
            <Login />
          } 
        />
        
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard user={user} onLogout={logout}>
                <div className="welcome-container">
                  <div className="welcome-content">
                    <h2 className="welcome-title">
                      Welcome to RecycList Dashboard
                    </h2>
                    <p className="welcome-subtitle">
                      Smart waste management system powered by Arduino IoT devices
                    </p>
                    <div className="feature-grid">
                      <div className="feature-card">
                        <h3 className="feature-title monitoring">Real-time Monitoring</h3>
                        <p className="feature-description">Track waste collection in real-time with Arduino sensors</p>
                      </div>
                      <div className="feature-card">
                        <h3 className="feature-title analytics">Analytics & Reports</h3>
                        <p className="feature-description">Comprehensive analytics and reporting dashboard</p>
                      </div>
                      <div className="feature-card">
                        <h3 className="feature-title notifications">Smart Notifications</h3>
                        <p className="feature-description">Get alerts when bins are full or need maintenance</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Dashboard>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/waste" 
          element={
            <ProtectedRoute>
              <Dashboard user={user} onLogout={logout}>
                <WasteTable />
              </Dashboard>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <Dashboard user={user} onLogout={logout}>
                <Analytics />
              </Dashboard>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Dashboard user={user} onLogout={logout}>
                <div className="settings-container">
                  <h2 className="settings-title">Settings</h2>
                  <p className="settings-description">Settings panel coming soon...</p>
                </div>
              </Dashboard>
            </ProtectedRoute>
          } 
        />
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
