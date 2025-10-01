import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { usePreferences } from './PreferencesContext';

const BinNotificationContext = createContext();

export const useBinNotifications = () => {
  const context = useContext(BinNotificationContext);
  if (!context) {
    throw new Error('useBinNotifications must be used within a BinNotificationProvider');
  }
  return context;
};

export const BinNotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [latestNotification, setLatestNotification] = useState(null);
  
  // Use refs to store current values without causing re-renders
  const userRef = useRef(user);
  const preferencesRef = useRef(preferences);
  
  // Update refs when values change
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);

  const API_BASE = 'http://localhost:3000/api';

  // Fetch bin records from API - using refs to avoid dependency issues
  const fetchBinNotifications = useCallback(async () => {
    const currentUser = userRef.current;
    const currentPreferences = preferencesRef.current;
    
    if (!currentUser || !currentPreferences.binFullAlert) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/bin/records?limit=50&sortBy=fullAt&sortOrder=desc`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch bin notifications');
      }

      const data = await response.json();
      
      if (data.success && data.data?.records) {
        const binRecords = data.data.records.map(record => ({
          id: record.id,
          type: 'bin_full',
          title: 'Bin Full Alert',
          message: 'The waste bin is full and needs to be emptied.',
          timestamp: new Date(record.fullAt),
          isRead: seenNotifications.current.has(record.id.toString()), // Mark as read if already seen
          icon: '🗑️',
          priority: 'high'
        }));

        setNotifications(binRecords);
        setUnreadCount(binRecords.filter(notif => !notif.isRead).length);
      }
    } catch (error) {
      console.error('Error fetching bin notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, isRead: true }
          : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    // Also mark as seen so it won't show modal again
    seenNotifications.current.add(notificationId.toString());
    try {
      const seenArray = Array.from(seenNotifications.current);
      localStorage.setItem('seenBinNotifications', JSON.stringify(seenArray));
    } catch (error) {
      console.error('Error saving seen notification:', error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    const allIds = notifications.map(notif => notif.id.toString());
    
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    );
    setUnreadCount(0);
    
    // Mark all as seen so they won't show modals again
    allIds.forEach(id => seenNotifications.current.add(id));
    try {
      const seenArray = Array.from(seenNotifications.current);
      localStorage.setItem('seenBinNotifications', JSON.stringify(seenArray));
    } catch (error) {
      console.error('Error saving seen notifications:', error);
    }
  }, [notifications]);

  // Close modal and mark notification as seen permanently
  const closeModal = useCallback(() => {
    setShowModal(false);
    if (latestNotification) {
      // Mark as seen in memory and localStorage
      seenNotifications.current.add(latestNotification.id.toString());
      
      try {
        const seenArray = Array.from(seenNotifications.current);
        localStorage.setItem('seenBinNotifications', JSON.stringify(seenArray));
      } catch (error) {
        console.error('Error saving seen notification:', error);
      }
      
      // Also mark as read in current session
      markAsRead(latestNotification.id);
      setLatestNotification(null);
      
      console.log(`Notification ${latestNotification.id} marked as seen permanently`);
    }
  }, [latestNotification, markAsRead]);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Get latest bin full notification
  const getLatestBinFull = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/bin/records/latest`);
      if (response.ok) {
        const data = await response.json();
        return data.success ? data.data : null;
      }
    } catch (error) {
      console.error('Error fetching latest bin record:', error);
    }
    return null;
  }, [API_BASE]);

  // Store seen notifications in a ref to avoid dependency issues
  const seenNotifications = useRef(new Set());

  // Load seen notifications from localStorage on mount
  useEffect(() => {
    try {
      const seen = localStorage.getItem('seenBinNotifications');
      if (seen) {
        const seenArray = JSON.parse(seen);
        seenNotifications.current = new Set(seenArray);
        console.log('Loaded seen notifications:', seenArray.length);
      }
    } catch (error) {
      console.error('Error loading seen notifications:', error);
    }
  }, []);

  // SSE connection for real-time bin notifications
  useEffect(() => {
    if (!user?.id || !preferences.binFullAlert) {
      console.log('Skipping SSE setup - missing requirements');
      return;
    }

    console.log('Setting up SSE connection for real-time bin notifications...');
    
    // Create SSE connection
    const eventSource = new EventSource('http://localhost:3000/api/bin/notifications/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE message received:', data);
        
        // Handle connection confirmation message
        if (data.type === 'connected') {
          console.log('SSE connection confirmed:', data.message);
          return;
        }
        
        // Process bin notification
        const binRecord = data;
        console.log('Real-time bin notification received:', binRecord);
        
        // Validate binRecord has required properties
        if (!binRecord || !binRecord.id || !binRecord.fullAt) {
          console.error('Invalid bin record received:', binRecord);
          return;
        }
        
        // Create notification object
        const notification = {
          id: binRecord.id,
          type: 'bin_full',
          title: 'Bin Full Alert',
          message: 'The waste bin is full and needs to be emptied.',
          timestamp: new Date(binRecord.fullAt),
          isRead: false,
          icon: '🗑️',
          priority: 'high'
        };
        
        // Check if we've already seen this notification
        const notificationId = binRecord.id.toString();
        if (seenNotifications.current.has(notificationId)) {
          console.log('Notification already seen, skipping:', notificationId);
          return;
        }
        
        // Add to notifications list
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Show modal if auto-notifications enabled
        console.log('Preferences check - binFullAlert:', preferences.binFullAlert);
        if (preferences.binFullAlert) {
          setLatestNotification(notification);
          setShowModal(true);
          console.log('Showing modal for new bin notification:', notification.id);
        } else {
          console.log('Modal not shown - binFullAlert preference is disabled');
        }
      } catch (error) {
        console.error('Error parsing SSE notification:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };
    
    eventSource.onopen = () => {
      console.log('SSE connection established');
    };
    
    // Initial fetch of existing notifications
    fetchBinNotifications();
    
    // Cleanup function
    return () => {
      console.log('Closing SSE connection');
      eventSource.close();
    };
  }, [user?.id, preferences.binFullAlert]);

  // Force refresh notifications (for testing)
  const forceRefresh = useCallback(() => {
    console.log('Force refreshing bin notifications...');
    fetchBinNotifications();
  }, [fetchBinNotifications]);

  // Clear seen notifications (for testing - to reset which notifications have been seen)
  const clearSeenNotifications = useCallback(() => {
    try {
      seenNotifications.current.clear();
      localStorage.removeItem('seenBinNotifications');
      console.log('Cleared all seen notifications - modals will show again');
      forceRefresh();
    } catch (error) {
      console.error('Error clearing seen notifications:', error);
    }
  }, [forceRefresh]);

  // Context value
  const value = {
    notifications,
    unreadCount,
    isLoading,
    showModal,
    latestNotification,
    fetchBinNotifications,
    forceRefresh,
    clearSeenNotifications,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    closeModal,
    getLatestBinFull
  };

  return (
    <BinNotificationContext.Provider value={value}>
      {children}
    </BinNotificationContext.Provider>
  );
};

export default BinNotificationProvider;