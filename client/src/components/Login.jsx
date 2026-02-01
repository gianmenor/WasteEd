import { useState, useCallback, useMemo } from 'react';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import DashboardSkeleton from './DashboardSkeleton';
import brandLogo from '../assets/brandName.png';
import './Login.css';

const Login = () => {
  const { login } = useAuth();
  const { preferences } = usePreferences();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Memoize input change handler
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  }, []);

  // Memoize submit handler with validation
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Basic validation
    if (!credentials.username.trim()) {
      setError('Username is required');
      return;
    }
    
    if (!credentials.password) {
      setError('Password is required');
      return;
    }
    
    if (credentials.password.length < 3) {
      setError('Password must be at least 3 characters');
      return;
    }
    
    setError('');

    try {
      const result = await login(credentials);
      
      if (!result.success) {
        // Provide helpful error messages
        const errorMsg = result.error || 'Login failed';
        
        // Check for specific error patterns
        if (errorMsg.toLowerCase().includes('network')) {
          setError('Network error. Please check your internet connection and try again.');
        } else if (errorMsg.toLowerCase().includes('required')) {
          setError('Username and password are required.');
        } else if (errorMsg.toLowerCase().includes('invalid')) {
          // This is the most common error from backend
          setError('Invalid credentials');
        } else {
          setError(errorMsg);
        }
      } else {
        // Only show dashboard skeleton after successful login
        setLoading(true);
      }
    } catch (err) {
      console.error('Login exception:', err);
      setError('Network error. Please check your internet connection and try again.');
    }
  }, [credentials, login]);

  // Memoize password toggle
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // Memoize error dismiss handler
  const dismissError = useCallback(() => {
    setError('');
  }, []);

  // Memoize remember me change handler
  const handleRememberMeChange = useCallback((e) => {
    setRememberMe(e.target.checked);
  }, []);

  // Memoize UI size class
  const uiSizeClass = useMemo(() => 
    `ui-size-${preferences?.uiSize || 'medium'}`,
    [preferences?.uiSize]
  );

  // Memoize button disabled state
  const isSubmitDisabled = useMemo(() => 
    loading || !credentials.username.trim() || !credentials.password,
    [loading, credentials.username, credentials.password]
  );

  // Show dashboard skeleton while loading (successful login)
  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className={`login-page ${uiSizeClass}`}>
      <div className="login-container">
        <div className="login-card">
          {/* Welcome Section */}
          <div className="login-header">
            <img src={brandLogo} alt="Waste-Ed Logo" className="login-brand-logo" />
            <p className="login-subtitle">Smart Waste Management System</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-error" role="alert">
              <span className="alert-icon" aria-hidden="true"><WarningAmberIcon fontSize="small" /></span>
              <span className="alert-message">{error}</span>
              <button 
                className="alert-close"
                onClick={dismissError}
                aria-label="Close error"
              >
                ✕
              </button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={credentials.username}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your username"
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="password-input-group">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="form-group remember-me-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={handleRememberMeChange}
                  className="checkbox-input"
                />
                <span className="checkbox-custom"></span>
                <span className="checkbox-text">Remember me for 30 days</span>
              </label>
            </div>

            <button
              type="submit"
              className={`btn btn-primary login-btn ${loading ? 'loading' : ''}`}
              disabled={isSubmitDisabled}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;