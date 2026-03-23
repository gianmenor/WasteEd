import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { BinNotificationProvider } from './contexts/BinNotificationContext';
import ThemeProvider from './contexts/ThemeProvider';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import Dashboard from './components/Dashboard';
import DashboardSkeleton from './components/DashboardSkeleton';
import KioskMode from './components/KioskMode';
import KioskAdminLogin from './components/KioskAdminLogin';
import './App.css';

const WasteTable = lazy(() => import('./components/WasteTable'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const Settings = lazy(() => import('./components/Settings'));
const CouponRecords = lazy(() => import('./components/CouponRecords'));
const ProfitRewards = lazy(() => import('./components/ProfitRewards'));
const NotificationTest = lazy(() => import('./components/NotificationTest'));
const DevPage = lazy(() => import('./components/DevPage'));
const InventoryManagement = lazy(() => import('./components/InventoryManagement'));

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
            <Suspense fallback={<DashboardSkeleton />}>
              <Routes>
              <Route 
                path="/login" 
                element={
                  isAuthenticated ? 
                  <Navigate to="/dashboard" replace /> : 
                  <Login />
                } 
              />
              <Route 
                path="/forgot-password" 
                element={
                  isAuthenticated ? 
                  <Navigate to="/dashboard" replace /> : 
                  <ForgotPassword />
                } 
              />
              <Route 
                path="/" 
                element={
                  isAuthenticated ? 
                  <Navigate to="/dashboard" replace /> : 
                  <Login />
                } 
              />

              <Route
                path="/kiosk"
                element={<KioskMode />}
              />

              <Route
                path="/kiosk-admin"
                element={<KioskAdminLogin />}
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
              path="/inventory" 
              element={
                <ProtectedRoute>
                  <Dashboard user={user} onLogout={logout}>
                    <InventoryManagement />
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
            </Suspense>
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
