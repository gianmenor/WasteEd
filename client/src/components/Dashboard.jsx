import { useState, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePreferences } from '../contexts/PreferencesContext';
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
  
  // Use preferences context for theme and settings
  const { preferences, updatePreference } = usePreferences();
  
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
                {preferences.notifications && (
                  <button className="notification-btn" title="Notifications">
                    <span className="notification-icon">🔔</span>
                    <span className="notification-badge">3</span>
                  </button>
                )}

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
      </ThemeContext.Provider>
    </SettingsContext.Provider>
  );
};

export default Dashboard;
