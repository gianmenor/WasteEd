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
import CouponRecords from './components/CouponRecords';
import ProfitRewards from './components/ProfitRewards';
import NotificationTest from './components/NotificationTest';
import DashboardSkeleton from './components/DashboardSkeleton';
import DevPage from './components/DevPage';
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
    return <DashboardSkeleton />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Main App Content
const AppContent = () => {
  const { isAuthenticated, user, logout, loading } = useAuth();

  if (loading) {
    return <DashboardSkeleton />;
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
              path="/coupons" 
              element={
                <ProtectedRoute>
                  <Dashboard user={user} onLogout={logout}>
                    <CouponRecords />
                  </Dashboard>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/profit" 
              element={
                <ProtectedRoute>
                  <Dashboard user={user} onLogout={logout}>
                    <ProfitRewards />
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
              path="/dev" 
              element={
                <Dashboard user={user} onLogout={logout}>
                  <DevPage />
                </Dashboard>
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
