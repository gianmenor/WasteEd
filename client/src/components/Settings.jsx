import React, { useState, useMemo, useCallback, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import LoadingSpinner from './LoadingSpinner';

const Settings = () => {
  const { user } = useAuth();
  const { preferences, updatePreference, isLoading: prefsLoading } = usePreferences();
  
  const [activeTab, setActiveTab] = useState('system');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  const [profile, setProfile] = useState({
    username: user?.username || '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Memoize message handler
  const showMessage = useCallback((text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  }, []);

  // Memoized handlers with optimistic updates
  const handleSettingChange = useCallback(async (setting, value) => {
    // Optimistic update
    const previousValue = preferences[setting];
    
    try {
      await updatePreference(setting, value);
      showMessage('Setting updated successfully');
    } catch (error) {
      // Revert on error
      await updatePreference(setting, previousValue);
      showMessage('Failed to update setting', 'error');
    }
  }, [preferences, updatePreference, showMessage]);

  const handleProfileSave = useCallback(async () => {
    if (profile.password && profile.password !== profile.confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }

    // Password validation
    if (profile.password) {
      const hasNumber = /\d/.test(profile.password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(profile.password);
      
      if (!hasNumber) {
        showMessage('Password must contain at least one number', 'error');
        return;
      }
      
      if (!hasSpecialChar) {
        showMessage('Password must contain at least one special character', 'error');
        return;
      }
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const updateData = { username: profile.username };
      
      if (profile.password) {
        updateData.password = profile.password;
      }

      const response = await fetch(`/api/accounts/manage/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        showMessage('Profile updated successfully');
        setProfile(prev => ({ ...prev, password: '', confirmPassword: '' }));
      } else {
        const error = await response.json();
        showMessage(error.message || 'Failed to update profile', 'error');
      }
    } catch (error) {
      showMessage('Failed to update profile', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [profile, user.id, showMessage]);

  // Memoize tabs array - removed accounts tab per PRD (single admin user)
  const tabs = useMemo(() => [
    { id: 'system', label: 'System', icon: '' },
    { id: 'profile', label: 'Profile', icon: '' },
  ], []);

  // Memoize UI size class
  const uiSizeClass = useMemo(() => {
    const size = preferences?.uiSize || 'medium';
    if (size === 'small') return 'text-sm';
    if (size === 'large') return 'text-lg';
    return 'text-base';
  }, [preferences?.uiSize]);

  return (
    <div className={`max-w-[1200px] mx-auto p-6 pb-20 md:pb-6 font-sans ${uiSizeClass}`}>
      {(prefsLoading || isLoading) && <LoadingSpinner fullscreen message="Loading..." />}
      <div className="pb-4 mb-6 border-b border-[#d1d9e0]">
        <h1 className="text-2xl font-semibold text-[#1f2328] m-0">Settings</h1>
      </div>

      {message && (
        <div className={`p-3 px-4 rounded-md text-sm mb-4 border ${
          messageType === 'error' 
            ? 'bg-[#f8d7da] border-[#f5c2c7] text-[#842029]' 
            : 'bg-[#d1e7dd] border-[#badbcc] text-[#0f5132]'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[296px_1fr] gap-6">
        {/* Sidebar Navigation */}
        <nav className="bg-transparent order-2 md:order-1">
          <ul className="list-none m-0 p-0 flex md:block overflow-x-auto md:overflow-visible gap-1 md:gap-0 pb-2 md:pb-0">
            {tabs.map(tab => (
              <li key={tab.id} className="mb-0 md:mb-0.5 flex-shrink-0">
                <button
                  className={`block py-2 px-4 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer border-0 w-full text-left whitespace-nowrap md:whitespace-normal ${
                    activeTab === tab.id
                      ? 'bg-[#1f2328] text-white'
                      : 'bg-transparent text-[#656d76] hover:bg-[#f6f8fa] hover:text-[#1f2328]'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main Content */}
        <div className="min-w-0 order-1 md:order-2">
          {activeTab === 'system' && (
            <div className="bg-white border border-[#d1d9e0] rounded-md mb-6 overflow-hidden">
              <div className="p-4 px-5 bg-[#f6f8fa] border-b border-[#d1d9e0]">
                <h2 className="text-base font-semibold text-[#1f2328] m-0">System Preferences</h2>
                <p className="text-sm text-[#656d76] mt-1 mb-0">
                  Configure your application settings and preferences.
                </p>
              </div>
              <div className="p-0">
                {/* Theme setting removed - using single theme as per PRD */}
                
                <div className="flex flex-col md:flex-row md:items-start md:justify-between p-4 px-5 border-b border-[#d1d9e0] gap-3 md:gap-0">
                  <div className="flex-1 md:mr-4">
                    <label className="text-sm font-semibold text-[#1f2328] mb-1 block">Bin Full Alert</label>
                    <p className="text-[13px] text-[#656d76] m-0 leading-snug">
                      Receive notifications when bins are full
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center">
                    <button
                      className={`relative w-12 h-7 rounded-full cursor-pointer transition-colors duration-200 border-0 outline-0 focus:shadow-[0_0_0_3px_rgba(31,136,61,0.3)] before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-6 before:h-6 before:bg-white before:rounded-full before:transition-transform before:duration-200 before:shadow-md ${
                        preferences.binFullAlert 
                          ? 'bg-[#1f883d] before:translate-x-5' 
                          : 'bg-[#d1d9e0]'
                      }`}
                      onClick={() => handleSettingChange('binFullAlert', !preferences.binFullAlert)}
                    >
                    </button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-start md:justify-between p-4 px-5 border-b border-[#d1d9e0] last:border-b-0 gap-3 md:gap-0">              
                  <div className="flex-1 md:mr-4">
                    <label className="text-sm font-semibold text-[#1f2328] mb-1 block">Auto refresh</label>
                    <p className="text-[13px] text-[#656d76] m-0 leading-snug">
                      Automatically refresh data
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center">
                    <button
                      className={`relative w-12 h-7 rounded-full cursor-pointer transition-colors duration-200 border-0 outline-0 focus:shadow-[0_0_0_3px_rgba(31,136,61,0.3)] before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-6 before:h-6 before:bg-white before:rounded-full before:transition-transform before:duration-200 before:shadow-md ${
                        preferences.autoRefresh 
                          ? 'bg-[#1f883d] before:translate-x-5' 
                          : 'bg-[#d1d9e0]'
                      }`}
                      onClick={() => handleSettingChange('autoRefresh', !preferences.autoRefresh)}
                    >
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-white border border-[#d1d9e0] rounded-md mb-6 overflow-hidden">
              <div className="p-4 px-5 bg-[#f6f8fa] border-b border-[#d1d9e0]">
                <h2 className="text-base font-semibold text-[#1f2328] m-0">Profile Settings</h2>
                <p className="text-sm text-[#656d76] mt-1 mb-0">
                  Update your personal information and password.
                </p>
              </div>
              <div className="p-0">
                <div className="p-5">
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-[#1f2328] mb-2">Username</label>
                    <input
                      type="text"
                      className="bg-[#f6f8fa] border border-[#d1d9e0] rounded-md text-[#1f2328] text-sm py-1.5 px-3 w-full max-w-[320px] focus:bg-white focus:border-[#0969da] focus:outline-none focus:shadow-[0_0_0_3px_rgba(9,105,218,0.3)]"
                      value={profile.username}
                      onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-[#1f2328] mb-2">New Password</label>
                    <div className="relative max-w-[320px]">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="bg-[#f6f8fa] border border-[#d1d9e0] rounded-md text-[#1f2328] text-sm py-1.5 px-3 w-full focus:bg-white focus:border-[#0969da] focus:outline-none focus:shadow-[0_0_0_3px_rgba(9,105,218,0.3)]"
                        value={profile.password}
                        onChange={(e) => setProfile(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Leave blank to keep current password"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {profile.password && (
                      <p className="text-xs text-gray-600 mt-1">Must contain at least one number and one special character</p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-[#1f2328] mb-2">Confirm Password</label>
                    <div className="relative max-w-[320px]">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        className="bg-[#f6f8fa] border border-[#d1d9e0] rounded-md text-[#1f2328] text-sm py-1.5 px-3 w-full focus:bg-white focus:border-[#0969da] focus:outline-none focus:shadow-[0_0_0_3px_rgba(9,105,218,0.3)]"
                        value={profile.confirmPassword}
                        onChange={(e) => setProfile(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </div>

                  <button
                    className="border rounded-md cursor-pointer text-sm font-medium py-1.5 px-4 transition-all duration-150 inline-flex items-center gap-1 bg-[#1f883d] border-[#1f883d] text-white hover:bg-[#1a7f37] hover:border-[#1a7f37] disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleProfileSave}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(Settings);