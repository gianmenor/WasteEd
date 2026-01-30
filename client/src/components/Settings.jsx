import React, { useState, useMemo, useCallback, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import LoadingSpinner from './LoadingSpinner';
import './Settings.css';

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
    { id: 'system', label: 'System', icon: '⚙️' },
    { id: 'profile', label: 'Profile', icon: '👤' }
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
                {/* Theme setting removed - using single theme as per PRD */}
                
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
        </div>
      </div>
    </div>
  );
};

export default memo(Settings);