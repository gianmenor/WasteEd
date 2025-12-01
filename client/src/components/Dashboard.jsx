import { useState, createContext, useContext, memo, useCallback, useMemo, lazy, Suspense, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePreferences } from '../contexts/PreferencesContext';
import { useBinNotifications } from '../contexts/BinNotificationContext';
import './Dashboard.css';

// Lazy load BinFullModal for code splitting
const BinFullModal = lazy(() => import('./BinFullModal'));

// Theme Context
const ThemeContext = createContext();

export const useThemeContext = () => useContext(ThemeContext);

// Settings Context
const SettingsContext = createContext();
export const useSettings = () => useContext(SettingsContext);

// Memoized menu items to prevent re-creation on every render
const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { id: 'waste', label: 'Waste Management', icon: '♻️', path: '/waste' },
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
];

// Memoized notification item component
const NotificationItem = memo(({ notification, onClick, formatTime }) => {
  const handleClick = useCallback(() => {
    onClick(notification);
  }, [notification, onClick]);

  return (
    <div
      className={`notification-item ${notification.isRead ? 'read' : 'unread'}`}
      onClick={handleClick}
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
            {formatTime(notification.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';

// Memoized sidebar navigation
const SidebarNav = memo(({ items, currentPath, onItemClick }) => (
  <nav className="sidebar-nav">
    <ul className="nav-list">
      {items.map((item) => (
        <li key={item.id}>
          <button
            className={`nav-item ${currentPath === item.path ? 'active' : ''}`}
            onClick={() => onItemClick(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        </li>
      ))}
    </ul>
  </nav>
));

SidebarNav.displayName = 'SidebarNav';

const Dashboard = ({ user, onLogout, children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  
  // Refs for click-outside detection
  const userMenuRef = useRef(null);
  const notificationMenuRef = useRef(null);
  
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

  // Memoize menu items
  const menuItems = useMemo(() => MENU_ITEMS, []);

  // Memoize callbacks to prevent re-renders
  const handleMenuClick = useCallback((path) => {
    navigate(path);
    if (window.innerWidth <= 768) {
      setMobileOpen(false);
    }
  }, [navigate]);

  const toggleSidebar = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);

  const handleDarkModeToggle = useCallback(async () => {
    const newTheme = preferences.theme === 'dark' ? 'light' : 'dark';
    await updatePreference('theme', newTheme);
  }, [preferences.theme, updatePreference]);

  const toggleNotificationMenu = useCallback(() => {
    setNotificationMenuOpen(prev => !prev);
    setUserMenuOpen(false);
  }, []);

  const handleNotificationClick = useCallback((notification) => {
    markAsRead(notification.id);
    setNotificationMenuOpen(false);
    
    if (notification.type === 'bin_full') {
      navigate('/waste');
    }
  }, [markAsRead, navigate]);

  const formatNotificationTime = useCallback((timestamp) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - notifTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  }, []);

  const toggleUserMenu = useCallback(() => {
    setUserMenuOpen(prev => !prev);
    setNotificationMenuOpen(false);
  }, []);

  const handleSettingsClick = useCallback(() => {
    navigate('/settings');
    setUserMenuOpen(false);
  }, [navigate]);

  const handleLogout = useCallback(() => {
    onLogout();
    setUserMenuOpen(false);
  }, [onLogout]);

  // Memoize computed values
  const themeClasses = useMemo(() => 
    preferences.theme === 'dark' ? 'dark-theme' : 'light-theme',
    [preferences.theme]
  );

  const fontSizeClass = useMemo(() => 
    `font-${preferences.uiSize}`,
    [preferences.uiSize]
  );

  const currentPageTitle = useMemo(() => 
    menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard',
    [menuItems, location.pathname]
  );

  // Memoize notification list (show max 10)
  const displayNotifications = useMemo(() => 
    notifications.slice(0, 10),
    [notifications]
  );

  // Memoize settings object
  const settingsValue = useMemo(() => ({
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
    updateSettings: () => {}
  }), [preferences.theme, preferences.uiSize, preferences.notifications, preferences.autoRefresh]);

  const themeValue = useMemo(() => ({
    darkMode: preferences.theme === 'dark',
    toggleDarkMode: handleDarkModeToggle
  }), [preferences.theme, handleDarkModeToggle]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target)) {
        setNotificationMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <SettingsContext.Provider value={settingsValue}>
      <ThemeContext.Provider value={themeValue}>
        <div className={`dashboard ${themeClasses} ${fontSizeClass} scale-normal`}>
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

            <SidebarNav 
              items={menuItems}
              currentPath={location.pathname}
              onItemClick={handleMenuClick}
            />

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
                  {currentPageTitle}
                </h2>
              </div>

              <div className="top-bar-right">
                <div className="notification-container" ref={notificationMenuRef}>
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
                          displayNotifications.map((notification) => (
                            <NotificationItem
                              key={notification.id}
                              notification={notification}
                              onClick={handleNotificationClick}
                              formatTime={formatNotificationTime}
                            />
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

                <div className="user-menu" ref={userMenuRef}>
                  <button
                    className="user-avatar"
                    onClick={toggleUserMenu}
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
                      <button className="dropdown-item" onClick={handleSettingsClick}>
                        <span className="dropdown-icon">⚙️</span>
                        Settings
                      </button>
                      <button className="dropdown-item" onClick={handleLogout}>
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
        
        {/* Bin Full Modal - Lazy loaded */}
        <Suspense fallback={null}>
          <BinFullModal />
        </Suspense>
      </ThemeContext.Provider>
    </SettingsContext.Provider>
  );
};

export default memo(Dashboard);
