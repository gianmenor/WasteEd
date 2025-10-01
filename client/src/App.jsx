import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { BinNotificationProvider } from './contexts/BinNotificationContext';
import ThemeProvider from './contexts/ThemeProvider';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import WasteTable from './components/WasteTable';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import Settings from './components/Settings';
import NotificationTest from './components/NotificationTest';
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
        <div className="loading-spinner">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="spinning"
          >
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="m20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
        </div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <PreferencesProvider>
      <BinNotificationProvider>
        <ThemeProvider>
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
                    <AnalyticsDashboard />
                  </Dashboard>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard user={user} onLogout={logout}>
                    <AnalyticsDashboard />
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
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Dashboard user={user} onLogout={logout}>
                    <Settings />
                  </Dashboard>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/test-notifications" 
              element={
                <ProtectedRoute>
                  <Dashboard user={user} onLogout={logout}>
                    <NotificationTest />
                  </Dashboard>
                </ProtectedRoute>
              } 
            />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
      </BinNotificationProvider>
    </PreferencesProvider>
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
