import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { API_ENDPOINTS } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import './Settings.css';

// Fetch accounts function
const fetchAccounts = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/accounts/manage/list', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch accounts');
  }

  const data = await response.json();
  return data.accounts || [];
};

const Settings = () => {
  const { user } = useAuth();
  const { preferences, updatePreference, isLoading: prefsLoading } = usePreferences();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('system');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  const [profile, setProfile] = useState({
    username: user?.username || '',
    password: '',
    confirmPassword: ''
  });

  const [newAccount, setNewAccount] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });

  // Use React Query for accounts data
  const { data: accounts = [], refetch: refetchAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
    enabled: activeTab === 'accounts',
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

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

  const handleThemeChange = useCallback(async (theme) => {
    const previousTheme = preferences.theme;
    
    try {
      await updatePreference('theme', theme);
      showMessage('Theme updated successfully');
    } catch (error) {
      await updatePreference('theme', previousTheme);
      showMessage('Failed to update theme', 'error');
    }
  }, [preferences.theme, updatePreference, showMessage]);

  const handleProfileSave = useCallback(async () => {
    if (profile.password && profile.password !== profile.confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
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

  const handleCreateAccount = useCallback(async () => {
    if (!newAccount.username || !newAccount.password) {
      showMessage('Username and password are required', 'error');
      return;
    }

    if (newAccount.password !== newAccount.confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/accounts/manage/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: newAccount.username,
          password: newAccount.password,
          role: newAccount.role
        })
      });

      if (response.ok) {
        showMessage('Account created successfully');
        setNewAccount({ username: '', password: '', confirmPassword: '', role: 'user' });
        refetchAccounts();
      } else {
        const error = await response.json();
        showMessage(error.message || 'Failed to create account', 'error');
      }
    } catch (error) {
      showMessage('Failed to create account', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [newAccount, refetchAccounts, showMessage]);

  const handleDeleteAccount = useCallback(async (accountId) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/accounts/manage/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showMessage('Account deleted successfully');
        refetchAccounts();
      } else {
        const error = await response.json();
        showMessage(error.message || 'Failed to delete account', 'error');
      }
    } catch (error) {
      showMessage('Failed to delete account', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [refetchAccounts, showMessage]);

  // Memoize tabs array
  const tabs = useMemo(() => [
    { id: 'system', label: 'System', icon: '⚙️' },
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'accounts', label: 'Account Management', icon: '👥' }
  ], []);

  // Memoize UI size class
  const uiSizeClass = useMemo(() => 
    `ui-size-${preferences?.uiSize || 'medium'}`,
    [preferences?.uiSize]
  );

  return (
    <div className={`settings-page ${uiSizeClass}`}>
      {(prefsLoading || isLoading) && <LoadingSpinner fullscreen message="Loading..." />}
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
      </div>

      {message && (
        <div className={`alert ${messageType === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      <div className="settings-layout">
        {/* Sidebar Navigation */}
        <nav className="settings-sidebar">
          <ul className="settings-nav">
            {tabs.map(tab => (
              <li key={tab.id} className="settings-nav-item">
                <button
                  className={`settings-nav-link ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.icon}</span> {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main Content */}
        <div className="settings-content">
          {activeTab === 'system' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">System Preferences</h2>
                <p className="settings-section-description">
                  Configure your application settings and preferences.
                </p>
              </div>
              <div className="settings-section-body">
                <div className="setting-item">
                  <div className="setting-info">
                    <label className="setting-label">Theme</label>
                    <p className="setting-description">
                      Choose between light and dark theme
                    </p>
                  </div>
                  <div className="setting-control">
                    <select
                      className="form-select"
                      value={preferences.theme}
                      onChange={(e) => handleThemeChange(e.target.value)}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <label className="setting-label">Bin Full Alert</label>
                    <p className="setting-description">
                      Receive notifications when bins are full
                    </p>
                  </div>
                  <div className="setting-control">
                    <button
                      className={`toggle-switch ${preferences.binFullAlert ? 'checked' : ''}`}
                      onClick={() => handleSettingChange('binFullAlert', !preferences.binFullAlert)}
                    >
                    </button>
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <label className="setting-label">Records per page</label>
                    <p className="setting-description">
                      Number of records to display per page
                    </p>
                  </div>
                  <div className="setting-control">
                    <select
                      className="form-select"
                      value={preferences.recordsPerPage}
                      onChange={(e) => handleSettingChange('recordsPerPage', parseInt(e.target.value))}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <label className="setting-label">UI Size</label>
                    <p className="setting-description">
                      Adjust the interface size
                    </p>
                  </div>
                  <div className="setting-control">
                    <select
                      className="form-select"
                      value={preferences.uiSize}
                      onChange={(e) => handleSettingChange('uiSize', e.target.value)}
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                </div>

                

                <div className="setting-item">
                  <div className="setting-info">
                    <label className="setting-label">Auto refresh</label>
                    <p className="setting-description">
                      Automatically refresh data
                    </p>
                  </div>
                  <div className="setting-control">
                    <button
                      className={`toggle-switch ${preferences.autoRefresh ? 'checked' : ''}`}
                      onClick={() => handleSettingChange('autoRefresh', !preferences.autoRefresh)}
                    >
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Profile Settings</h2>
                <p className="settings-section-description">
                  Update your personal information and password.
                </p>
              </div>
              <div className="settings-section-body">
                <div style={{ padding: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-input"
                      value={profile.username}
                      onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input
                      type="password"
                      className="form-input"
                      value={profile.password}
                      onChange={(e) => setProfile(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Leave blank to keep current password"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm Password</label>
                    <input
                      type="password"
                      className="form-input"
                      value={profile.confirmPassword}
                      onChange={(e) => setProfile(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                    />
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={handleProfileSave}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <>
              <div className="settings-section">
                <div className="settings-section-header">
                  <h2 className="settings-section-title">Account Management</h2>
                  <p className="settings-section-description">
                    Manage user accounts and permissions.
                  </p>
                </div>
                <div className="settings-section-body">
                  <ul className="account-list">
                    {accounts.map(account => (
                      <li key={account.id} className="account-item">
                        <div className="account-info">
                          <div className="account-avatar">
                            {account.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="account-details">
                            <h4>{account.username}</h4>
                            <p>'Admin'</p>
                          </div>
                        </div>
                        <div className="account-actions">
                          {account.id !== user?.id && (
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDeleteAccount(account.id)}
                              disabled={isLoading}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-header">
                  <h2 className="settings-section-title">Create New Account</h2>
                  <p className="settings-section-description">
                    Add a new user account to the system.
                  </p>
                </div>
                <div className="settings-section-body">
                  <div style={{ padding: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">Username</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newAccount.username}
                        onChange={(e) => setNewAccount(prev => ({ ...prev, username: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <input
                        type="password"
                        className="form-input"
                        value={newAccount.password}
                        onChange={(e) => setNewAccount(prev => ({ ...prev, password: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Confirm Password</label>
                      <input
                        type="password"
                        className="form-input"
                        value={newAccount.confirmPassword}
                        onChange={(e) => setNewAccount(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <select
                        className="form-select"
                        value={newAccount.role}
                        onChange={(e) => setNewAccount(prev => ({ ...prev, role: e.target.value }))}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={handleCreateAccount}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Creating...' : 'Create Account'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(Settings);