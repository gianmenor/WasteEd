import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { useAuth } from './AuthContext';

const PreferencesContext = createContext();

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};

export const PreferencesProvider = ({ children }) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({
    theme: 'light',
    binFullAlert: true,
    recordsPerPage: 10,
    uiSize: 'medium',
    notifications: true,
    autoRefresh: true,
    compactMode: false,
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load preferences when user logs in
  const loadPreferences = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const response = await fetch(API_ENDPOINTS.PREFERENCES, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPreferences(data.preferences);
        } else {
          throw new Error(data.error || 'Failed to load preferences');
        }
      } else {
        throw new Error('Failed to load preferences');
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      setError(error.message);
      // Keep default preferences on error
    } finally {
      setIsLoading(false);
    }
  };

  // Save preferences to backend
  const savePreferences = async (newPreferences) => {
    if (!user) return false;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const response = await fetch(API_ENDPOINTS.PREFERENCES, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPreferences)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPreferences(data.preferences);
          return true;
        } else {
          throw new Error(data.error || 'Failed to save preferences');
        }
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Update specific preference
  const updatePreference = async (key, value) => {
    const newPreferences = { ...preferences, [key]: value };
    const success = await savePreferences({ [key]: value });
    if (success) {
      setPreferences(newPreferences);
    }
    return success;
  };

  // Update multiple preferences
  const updatePreferences = async (updates) => {
    const newPreferences = { ...preferences, ...updates };
    const success = await savePreferences(updates);
    if (success) {
      setPreferences(newPreferences);
    }
    return success;
  };

  // Reset preferences to default
  const resetPreferences = async () => {
    if (!user) return false;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const response = await fetch(`${API_ENDPOINTS.PREFERENCES}/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPreferences(data.preferences);
          return true;
        } else {
          throw new Error(data.error || 'Failed to reset preferences');
        }
      } else {
        throw new Error('Failed to reset preferences');
      }
    } catch (error) {
      console.error('Error resetting preferences:', error);
      setError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Load preferences when user changes
  useEffect(() => {
    if (user) {
      loadPreferences();
    } else {
      // Reset to defaults when user logs out
      setPreferences({
        theme: 'light',
        binFullAlert: true,
        recordsPerPage: 10,
        uiSize: 'medium',
        notifications: true,
        autoRefresh: true,
        compactMode: false,
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY'
      });
    }
  }, [user]);

  const value = {
    preferences,
    isLoading,
    error,
    updatePreference,
    updatePreferences,
    resetPreferences,
    loadPreferences
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};