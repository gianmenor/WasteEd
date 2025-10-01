import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(credentials);
      
      if (!result.success) {
        setError(result.error);
      }
      // If successful, the AuthContext will handle the redirect
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="background-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>
      
      <div className="login-container">
        <div className="login-card">
          {/* Header */}
          <div className="login-header">
            <div className="logo-container">
              <div className="logo">
                <div className="logo-icon">♻️</div>
                <div className="logo-text">
                  <span className="brand-name">RecycList</span>
                  <span className="brand-tagline">Smart Waste Management</span>
                </div>
              </div>
            </div>
            <p className="welcome-text">Welcome back! Sign in to continue managing waste efficiently.</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="error-alert">
              <div className="error-icon">⚠️</div>
              <div className="error-message">{error}</div>
              <button 
                className="error-close"
                onClick={() => setError('')}
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
                <span className="label-icon">👤</span>
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
                <span className="label-icon">🔒</span>
                Password
              </label>
              <div className="password-input-container">
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
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={`login-button ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Signing In...
                </>
              ) : (
                <>
                  <span className="button-icon">🚀</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Features */}
          <div className="features-section">
            <div className="features-grid">
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <span className="feature-text">Real-time Analytics</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔗</span>
                <span className="feature-text">Arduino Integration</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🌱</span>
                <span className="feature-text">Environmental Impact</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;