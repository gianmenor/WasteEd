import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import WasteTable from './components/WasteTable';
import Analytics from './components/Analytics';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#22c55e', // Green primary color
    },
    secondary: {
      main: '#059669',
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box 
        className="min-h-screen flex items-center justify-center"
        sx={{ bgcolor: 'grey.50' }}
      >
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Main App Content
const AppContent = () => {
  const { isAuthenticated, user, logout, loading } = useAuth();

  if (loading) {
    return (
      <Box 
        className="min-h-screen flex items-center justify-center"
        sx={{ bgcolor: 'grey.50' }}
      >
        <CircularProgress size={60} thickness={4} />
      </Box>
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
                <Box className="space-y-6">
                  <div className="text-center py-12">
                    <h2 className="text-3xl font-bold text-gray-800 mb-4">
                      Welcome to RecycList Dashboard
                    </h2>
                    <p className="text-gray-600 mb-8">
                      Smart waste management system powered by Arduino IoT devices
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-xl font-semibold text-green-600 mb-2">Real-time Monitoring</h3>
                        <p className="text-gray-600">Track waste collection in real-time with Arduino sensors</p>
                      </div>
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-xl font-semibold text-blue-600 mb-2">Analytics & Reports</h3>
                        <p className="text-gray-600">Comprehensive analytics and reporting dashboard</p>
                      </div>
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-xl font-semibold text-orange-600 mb-2">Smart Notifications</h3>
                        <p className="text-gray-600">Get alerts when bins are full or need maintenance</p>
                      </div>
                    </div>
                  </div>
                </Box>
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
                <Box className="text-center py-12">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Settings</h2>
                  <p className="text-gray-600">Settings panel coming soon...</p>
                </Box>
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
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <CssBaseline />
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
