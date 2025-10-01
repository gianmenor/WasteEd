import { useState, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePreferences } from '../contexts/PreferencesContext';
import { useBinNotifications } from '../contexts/BinNotificationContext';
import BinFullModal from './BinFullModal';
import './Dashboard.css';

// Theme Context
const ThemeContext = createContext();

export const useThemeContext = () => useContext(ThemeContext);

// Settings Context
const SettingsContext = createContext();
export const useSettings = () => useContext(SettingsContext);

const Dashboard = ({ user, onLogout, children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  
  // Use preferences context for theme and settings
  const { preferences, updatePreference } = usePreferences();
  
  // Use bin notifications context
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearAllNotifications,
    forceRefresh
  } = useBinNotifications();
  
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
    { id: 'waste', label: 'Waste Management', icon: '♻️', path: '/waste' },
    { id: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
  ];

  const handleMenuClick = (path) => {
    navigate(path);
    if (window.innerWidth <= 768) {
      setMobileOpen(false);
    }
  };

  const toggleSidebar = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDarkModeToggle = async () => {
    const newTheme = preferences.theme === 'dark' ? 'light' : 'dark';
    await updatePreference('theme', newTheme);
  };

  const toggleNotificationMenu = () => {
    setNotificationMenuOpen(!notificationMenuOpen);
    setUserMenuOpen(false); // Close user menu if open
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    setNotificationMenuOpen(false);
    
    // Navigate based on notification type
    if (notification.type === 'bin_full') {
      navigate('/waste');
    }
  };

  const formatNotificationTime = (timestamp) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - notifTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const themeClasses = preferences.theme === 'dark' ? 'dark-theme' : 'light-theme';
  const fontSizeClass = `font-${preferences.uiSize}`;
  const scaleClass = `scale-normal`;

  return (
    <SettingsContext.Provider value={{ 
      settings: {
        darkMode: preferences.theme === 'dark',
        fontSize: preferences.uiSize,
        uiScale: 'normal',
        notifications: preferences.notifications,
        soundEffects: true,
        compactMode: false,
        showTooltips: true,
        autoSave: preferences.autoRefresh
      }, 
      updateSettings: () => {} // deprecated, use preferences context instead
    }}>
      <ThemeContext.Provider value={{ 
        darkMode: preferences.theme === 'dark', 
        toggleDarkMode: handleDarkModeToggle 
      }}>
        <div className={`dashboard ${themeClasses} ${fontSizeClass} ${scaleClass}`}>
          {/* Mobile Overlay */}
          {mobileOpen && (
            <div className="mobile-overlay" onClick={() => setMobileOpen(false)}></div>
          )}

          {/* Sidebar */}
          <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
              <div className="logo-container">
                <div className="logo"></div>
                <h1 className="brand-name">
                  Wast<span className="brand-accent">E</span>d
                </h1>
              </div>
              <p className="tagline">Smart Waste Management</p>
            </div>

            <nav className="sidebar-nav">
              <ul className="nav-list">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <button
                      className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                      onClick={() => handleMenuClick(item.path)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="sidebar-footer">
              <div className="quick-settings">
                <button
                  className="setting-toggle"
                  onClick={handleDarkModeToggle}
                  title="Toggle Dark Mode"
                >
                  <span className="setting-icon">{preferences.theme === 'dark' ? '☀️' : '🌙'}</span>
                  <span className="setting-label">
                    {preferences.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </span>
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="main-content">
            {/* Top Bar */}
            <header className="top-bar">
              <div className="top-bar-left">
                <button className="sidebar-toggle" onClick={toggleSidebar}>
                  <span className="hamburger">☰</span>
                </button>
                <h2 className="page-title">
                  {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                </h2>
              </div>

              <div className="top-bar-right">
                <div className="notification-container">
                  <button 
                    className="notification-btn" 
                    title="Notifications"
                    onClick={toggleNotificationMenu}
                  >
                    <span className="notification-icon">🔔</span>
                    {unreadCount > 0 && (
                      <span className="notification-badge">{unreadCount}</span>
                    )}
                  </button>

                  {notificationMenuOpen && (
                    <div className="notification-dropdown">
                      <div className="notification-header">
                        <h3>Notifications</h3>
                        {notifications.length > 0 && (
                          <div className="notification-actions">
                            <button 
                              className="btn-text"
                              onClick={forceRefresh}
                              title="Refresh notifications"
                            >
                              🔄 Refresh
                            </button>
                            <button 
                              className="btn-text"
                              onClick={markAllAsRead}
                            >
                              Mark all read
                            </button>
                            <button 
                              className="btn-text"
                              onClick={clearAllNotifications}
                            >
                              Clear all
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="notification-list">
                        {notifications.length === 0 ? (
                          <div className="no-notifications">
                            <span className="no-notif-icon">🔕</span>
                            <p>No notifications</p>
                          </div>
                        ) : (
                          notifications.slice(0, 10).map((notification) => (
                            <div
                              key={notification.id}
                              className={`notification-item ${notification.isRead ? 'read' : 'unread'}`}
                              onClick={() => handleNotificationClick(notification)}
                            >
                              <div className="notification-content">
                                <div className="notification-icon-wrapper">
                                  <span className="notification-type-icon">
                                    {notification.icon}
                                  </span>
                                  {!notification.isRead && (
                                    <div className="unread-indicator"></div>
                                  )}
                                </div>
                                <div className="notification-details">
                                  <div className="notification-title">
                                    {notification.title}
                                  </div>
                                  <div className="notification-message">
                                    {notification.message}
                                  </div>
                                  <div className="notification-time">
                                    {formatNotificationTime(notification.timestamp)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {notifications.length > 10 && (
                        <div className="notification-footer">
                          <button className="btn-text">
                            View all notifications
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="user-menu">
                  <button
                    className="user-avatar"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                  >
                    <span className="avatar-icon">👤</span>
                    <span className="user-name">{user?.username || 'User'}</span>
                    <span className="dropdown-arrow">▼</span>
                  </button>

                  {userMenuOpen && (
                    <div className="user-dropdown">
                      <div className="dropdown-header">
                        <p className="user-email">{user?.email || 'user@example.com'}</p>
                      </div>
                      <div className="dropdown-divider"></div>
                      <button className="dropdown-item" onClick={() => navigate('/settings')}>
                        <span className="dropdown-icon">⚙️</span>
                        Settings
                      </button>
                      <button className="dropdown-item" onClick={onLogout}>
                        <span className="dropdown-icon">🚪</span>
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className="page-content">
              {children}
            </main>
          </div>
        </div>
        
        {/* Bin Full Modal */}
        <BinFullModal />
      </ThemeContext.Provider>
    </SettingsContext.Provider>
  );
};

export default Dashboard;
