import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import DashboardSkeleton from './DashboardSkeleton';
import brandLogo from '../assets/brandName.png';

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

  // Memoize button disabled state
  const isSubmitDisabled = useMemo(() => 
    loading || !credentials.username.trim() || !credentials.password,
    [loading, credentials.username, credentials.password]
  );

  // Show dashboard skeleton while loading (successful login)
  if (loading) {
    return <DashboardSkeleton />;
  }

  // Determine padding class based on UI size
  const cardPaddingClass = useMemo(() => {
    if (preferences?.uiSize === 'small') return 'p-6';
    if (preferences?.uiSize === 'large') return 'p-10';
    return 'p-10';
  }, [preferences?.uiSize]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50/30 to-green-50 p-6">
      {/* Logo Section - Outside the card */}
      <div className="text-center mb-8 animate-fadeInDown">
        <img src={brandLogo} alt="Waste-Ed Logo" className="w-[180px] h-auto mb-4 block mx-auto" />
        <p className="text-gray-500 text-base mt-2 mb-0 font-medium">Smart Waste Management System</p>
      </div>

      <div className="w-full max-w-[420px] animate-fadeInUp">
        <div className={`bg-white border border-gray-200 rounded-2xl ${cardPaddingClass} shadow-[0_10px_25px_rgba(0,0,0,0.1),0_6px_12px_rgba(0,0,0,0.08)]`}>
          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg mb-6 text-sm bg-red-50 border border-red-200 text-red-800" role="alert">
              <span className="flex-shrink-0" aria-hidden="true"><WarningAmberIcon fontSize="small" /></span>
              <span className="flex-1">{error}</span>
              <button 
                className="bg-transparent border-none text-red-800 cursor-pointer p-1 rounded flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity duration-200"
                onClick={dismissError}
                aria-label="Close error"
              >
                <CloseRoundedIcon fontSize="small" />
              </button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-sm font-medium text-gray-800">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={credentials.username}
                onChange={handleChange}
                className="px-4 py-3 border border-gray-200 rounded-lg text-base bg-white text-gray-800 transition-all duration-200 focus:outline-none focus:border-green-600 focus:ring-[3px] focus:ring-green-600/10 placeholder:text-gray-400"
                placeholder="Enter your username"
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-800">
                Password
              </label>
              <div className="relative flex w-full">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={handleChange}
                  className="w-full min-w-0 pr-12 px-4 py-3 border border-gray-200 rounded-lg text-base bg-white text-gray-800 transition-all duration-200 focus:outline-none focus:border-green-600 focus:ring-[3px] focus:ring-green-600/10 placeholder:text-gray-400"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-gray-500 cursor-pointer p-1 rounded flex items-center justify-center transition-colors duration-200 hover:bg-gray-100"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                </button>
              </div>
            </div>

            <div className="m-0 flex flex-row flex-nowrap w-full">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={handleRememberMeChange}
                  className="peer sr-only"
                />
                <span className="w-5 h-5 border-2 border-gray-200 rounded bg-white relative transition-all duration-200 flex items-center justify-center flex-shrink-0 peer-checked:bg-green-600 peer-checked:border-green-600 peer-focus:ring-[3px] peer-focus:ring-green-600/10 after:content-['✓'] after:text-white after:text-sm after:font-bold after:hidden peer-checked:after:block"></span>
                <span className="select-none">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="ml-auto text-sm text-green-700 hover:text-green-800"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-4 border border-transparent rounded-lg text-base font-medium no-underline cursor-pointer transition-all duration-200 whitespace-nowrap w-full bg-green-600 text-white hover:enabled:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
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