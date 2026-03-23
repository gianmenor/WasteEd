import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { API_ENDPOINTS } from '../config/api';
import brandLogo from '../assets/brandName.png';

const RECOVERY_EMAIL = 'wasteed277@gmail.com';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loadingSendOtp, setLoadingSendOtp] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const showMessage = useCallback((text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
  }, []);

  const handleSendOtp = useCallback(async () => {
    setLoadingSendOtp(true);
    setMessage('');

    try {
      const response = await fetch(API_ENDPOINTS.FORGOT_PASSWORD_REQUEST_OTP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.message || 'Failed to send OTP.', 'error');
        return;
      }

      setOtpSent(true);
      showMessage(data.message || 'OTP sent successfully.', 'success');
    } catch (error) {
      console.error('Send OTP error:', error);
      showMessage('Network error. Please try again.', 'error');
    } finally {
      setLoadingSendOtp(false);
    }
  }, [showMessage]);

  const handleVerifyAndReset = useCallback(async (e) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(otp)) {
      showMessage('OTP must be exactly 6 digits.', 'error');
      return;
    }

    if (!newPassword || newPassword.length < 3) {
      showMessage('New password must be at least 3 characters.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('Passwords do not match.', 'error');
      return;
    }

    setLoadingVerify(true);
    setMessage('');

    try {
      const response = await fetch(API_ENDPOINTS.FORGOT_PASSWORD_VERIFY_OTP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          otp,
          newPassword
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.message || 'Failed to reset password.', 'error');
        return;
      }

      showMessage(data.message || 'Password reset successful.', 'success');
      setTimeout(() => {
        navigate('/login');
      }, 1200);
    } catch (error) {
      console.error('Verify OTP error:', error);
      showMessage('Network error. Please try again.', 'error');
    } finally {
      setLoadingVerify(false);
    }
  }, [otp, newPassword, confirmPassword, showMessage, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] overflow-hidden">
        <div className="px-6 md:px-8 py-6 bg-gradient-to-r from-emerald-700 to-teal-700 text-white">
          <img src={brandLogo} alt="Waste-Ed" className="w-[130px] h-auto mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight">Reset Your Password</h1>
          <p className="text-emerald-100 text-sm mt-1">Secure OTP verification for account recovery</p>
        </div>

        <div className="px-6 md:px-8 py-6 md:py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-800 font-medium mb-1">
                <MarkEmailReadOutlinedIcon fontSize="small" />
                OTP Delivery
              </div>
              <p className="text-sm text-emerald-700">OTP will be sent to {RECOVERY_EMAIL}.</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-800 font-medium mb-1">
                <ShieldOutlinedIcon fontSize="small" />
                Security
              </div>
              <p className="text-sm text-blue-700">OTP expires in 10 minutes for protection.</p>
            </div>
          </div>

          {message && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border mb-5 text-sm ${messageType === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              <WarningAmberIcon fontSize="small" />
              <span>{message}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSendOtp}
            disabled={loadingSendOtp}
            className="w-full md:w-auto px-5 py-3 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:enabled:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingSendOtp ? 'Sending OTP...' : otpSent ? 'Resend OTP' : 'Send OTP'}
          </button>

          <form onSubmit={handleVerifyAndReset} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">OTP Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-100"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loadingVerify || !otpSent}
                className="flex-1 px-5 py-3 rounded-lg bg-slate-900 text-white text-sm font-medium hover:enabled:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingVerify ? 'Verifying...' : 'Verify OTP & Reset Password'}
              </button>
              <Link
                to="/login"
                className="flex-1 px-5 py-3 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium text-center hover:bg-slate-50"
              >
                Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
