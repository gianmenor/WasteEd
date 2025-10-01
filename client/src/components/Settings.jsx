import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import './Settings.css';

const Settings = () => {
  const { user } = useAuth();
  const { preferences, updatePreference, isLoading: prefsLoading } = usePreferences();
  
  const [activeTab, setActiveTab] = useState('system');
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  
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

  const API_BASE = 'http://localhost:3000/api';

  // Check user role
  const checkUserRole = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/accounts/role`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.isAdmin || false);
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      setIsAdmin(false);
    } finally {
      setRoleLoading(false);
    }
  };

  // Fetch accounts
  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/accounts/manage/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  useEffect(() => {
    checkUserRole();
    if (activeTab === 'accounts') {
      fetchAccounts();
    }
  }, [activeTab]);

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  const handleSettingChange = async (setting, value) => {
    try {
      await updatePreference(setting, value);
      showMessage('Setting updated successfully');
    } catch (error) {
      showMessage('Failed to update setting', 'error');
    }
  };

  const handleThemeChange = async (theme) => {
    try {
      await updatePreference('theme', theme);
      showMessage('Theme updated successfully');
    } catch (error) {
      showMessage('Failed to update theme', 'error');
    }
  };

  const handleProfileSave = async () => {
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

      const response = await fetch(`${API_BASE}/accounts/manage/${user.id}`, {
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
  };

  const handleCreateAccount = async () => {
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
      const response = await fetch(`${API_BASE}/accounts/manage/create`, {
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
        fetchAccounts();
      } else {
        const error = await response.json();
        showMessage(error.message || 'Failed to create account', 'error');
      }
    } catch (error) {
      showMessage('Failed to create account', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/accounts/manage/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showMessage('Account deleted successfully');
        fetchAccounts();
      } else {
        const error = await response.json();
        showMessage(error.message || 'Failed to delete account', 'error');
      }
    } catch (error) {
      showMessage('Failed to delete account', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'system', label: 'System', icon: '⚙️' },
    { id: 'profile', label: 'Profile', icon: '👤' },
    ...(isAdmin ? [{ id: 'accounts', label: 'Account Management', icon: '👥' }] : [])
  ];

  return (
    <div className={`settings-page ui-size-${preferences?.uiSize || 'medium'}`}>
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
                    <label className="setting-label">Notifications</label>
                    <p className="setting-description">
                      Enable desktop notifications
                    </p>
                  </div>
                  <div className="setting-control">
                    <button
                      className={`toggle-switch ${preferences.notifications ? 'checked' : ''}`}
                      onClick={() => handleSettingChange('notifications', !preferences.notifications)}
                    >
                    </button>
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
                            <p>{account.role || 'User'}</p>
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

export default Settings;