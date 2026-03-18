import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import ArrowBackIosNewOutlinedIcon from '@mui/icons-material/ArrowBackIosNewOutlined';
import { useAuth } from '../contexts/AuthContext';

const KioskAdminLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onChange = useCallback((event) => {
    const { name, value } = event.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  }, []);

  const onSubmit = useCallback(async (event) => {
    event.preventDefault();

    if (!credentials.username.trim() || !credentials.password) {
      setError('Username and password are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(credentials);
      if (!result.success) {
        setError(result.error || 'Invalid credentials');
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [credentials, login, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900/80 backdrop-blur-sm p-7 shadow-2xl">
        <button
          type="button"
          className="mb-6 text-sm text-slate-200 hover:text-white inline-flex items-center gap-2"
          onClick={() => navigate('/kiosk')}
        >
          <ArrowBackIosNewOutlinedIcon fontSize="inherit" />
          Return to kiosk
        </button>

        <h1 className="text-2xl font-semibold mb-1">Admin Access</h1>
        <p className="text-slate-300 text-sm mb-6">
          Enter admin credentials to open the dashboard.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm text-slate-300 mb-2">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={credentials.username}
              onChange={onChange}
              className="w-full rounded-lg border border-white/20 bg-slate-800/70 px-3 py-2.5 text-white outline-none focus:border-cyan-300"
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-slate-300 mb-2">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={credentials.password}
              onChange={onChange}
              className="w-full rounded-lg border border-white/20 bg-slate-800/70 px-3 py-2.5 text-white outline-none focus:border-cyan-300"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 px-4 py-2.5 font-semibold text-slate-900 inline-flex items-center justify-center gap-2"
          >
            <LoginOutlinedIcon fontSize="small" />
            {isSubmitting ? 'Signing in...' : 'Open Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default KioskAdminLogin;
