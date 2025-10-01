import React, { useState, useContext, useRef, useEffect } from 'react';
import { BinNotificationContext } from '../contexts/BinNotificationContext';
import { API_ENDPOINTS } from '../config/api';

const NotificationTest = () => {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    showModal, 
    latestNotification,
    forceRefresh,
    clearSeenNotifications,
    markAllAsRead,
    clearAllNotifications 
  } = useBinNotifications();

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>🧪 Bin Notification Test Panel</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Status</h3>
        <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
        <p>Unread Count: {unreadCount}</p>
        <p>Total Notifications: {notifications.length}</p>
        <p>Modal Visible: {showModal ? 'Yes' : 'No'}</p>
        <p>Latest: {latestNotification ? latestNotification.title : 'None'}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Actions</h3>
        <button 
          onClick={forceRefresh}
          style={{ marginRight: '10px', padding: '10px' }}
        >
          🔄 Force Refresh
        </button>
        <button 
          onClick={markAllAsRead}
          style={{ marginRight: '10px', padding: '10px' }}
        >
          ✅ Mark All Read
        </button>
        <button 
          onClick={clearAllNotifications}
          style={{ padding: '10px' }}
        >
          🗑️ Clear All
        </button>
        <button 
          onClick={clearSeenNotifications}
          style={{ marginLeft: '10px', padding: '10px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          🔄 Reset Seen (Testing)
        </button>
      </div>

      <div>
        <h3>Recent Notifications</h3>
        {notifications.length === 0 ? (
          <p>No notifications</p>
        ) : (
          <ul>
            {notifications.slice(0, 5).map(notif => (
              <li key={notif.id} style={{ margin: '10px 0' }}>
                <strong>{notif.title}</strong> - {notif.message}
                <br />
                <small>
                  {new Date(notif.timestamp).toLocaleString()} 
                  {notif.isRead ? ' (Read)' : ' (Unread)'}
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Create Test Notification</h3>
        <button 
          onClick={async () => {
            try {
              const response = await fetch(API_ENDPOINTS.BIN_FULL, {
                method: 'POST'
              });
              const data = await response.json();
              console.log('Created test notification:', data);
              setTimeout(() => forceRefresh(), 1000);
            } catch (error) {
              console.error('Error creating notification:', error);
            }
          }}
          style={{ padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          🗑️ Trigger Bin Full
        </button>
      </div>
    </div>
  );
};

export default NotificationTest;