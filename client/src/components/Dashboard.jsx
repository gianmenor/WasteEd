import { useState, createContext, useContext, memo, useCallback, useMemo, lazy, Suspense, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePreferences } from '../contexts/PreferencesContext';
import { useBinNotifications } from '../contexts/BinNotificationContext';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import RecyclingOutlinedIcon from '@mui/icons-material/RecyclingOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import brandLogo from '../assets/brandName.png';

// Lazy load BinFullModal and WasteNotificationModal for code splitting
const BinFullModal = lazy(() => import('./BinFullModal'));
const WasteNotificationModal = lazy(() => import('./WasteNotificationModal'));

// Theme Context
const ThemeContext = createContext();

export const useThemeContext = () => useContext(ThemeContext);

// Settings Context
const SettingsContext = createContext();
export const useSettings = () => useContext(SettingsContext);

// Memoized menu items to prevent re-creation on every render
const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '', path: '/dashboard' },
  { id: 'coupons', label: 'Coupon Records', icon: '', path: '/coupons' },
  { id: 'profit', label: 'Rewards', icon: '', path: '/profit' },
  { id: 'waste', label: 'Waste Management', icon: '', path: '/waste' },
];

// Admin-only menu items
const ADMIN_MENU_ITEMS = [
  { id: 'inventory', label: 'Inventory Management', icon: '', path: '/inventory' },
  { id: 'settings', label: 'Settings', icon: '', path: '/settings' },
];

const BOTTOM_NAV_META = {
  dashboard: { label: 'Home', icon: <DashboardOutlinedIcon fontSize="inherit" /> },
  waste: { label: 'Waste', icon: <RecyclingOutlinedIcon fontSize="inherit" /> },
  coupons: { label: 'Coupons', icon: <ConfirmationNumberOutlinedIcon fontSize="inherit" /> },
  profit: { label: 'Profit', icon: <MonetizationOnOutlinedIcon fontSize="inherit" /> },
  inventory: { label: 'Inventory', icon: <Inventory2OutlinedIcon fontSize="inherit" /> },
  settings: { label: 'Settings', icon: <SettingsOutlinedIcon fontSize="inherit" /> },
};

// Memoized notification item component
const NotificationItem = memo(({ notification, onClick, formatTime }) => {
  const handleClick = useCallback(() => {
    onClick(notification);
  }, [notification, onClick]);

  return (
    <div
      className={`p-4 md:p-5 border-b border-gray-200 cursor-pointer transition-all duration-200 hover:bg-green-50 last:border-b-0 ${!notification.isRead ? 'bg-green-50' : ''}`}
      onClick={handleClick}
    >
      <div className="flex gap-3 items-start">
        <div className="relative flex-shrink-0">
          <span className="text-2xl md:text-xl block">
            {notification.icon}
          </span>
          {!notification.isRead && (
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm md:text-[0.9rem] mb-1">
            {notification.title}
          </div>
          <div className="text-gray-600 text-[0.85rem] md:text-[0.85rem] leading-relaxed mb-2">
            {notification.message}
          </div>
          <div className="text-gray-500 text-xs">
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
  <nav className="flex-1 py-4 overflow-y-auto">
    <ul className="list-none p-0 m-0">
      {items.map((item) => (
        <li key={item.id}>
          <button
            className={`flex items-center py-4 px-5 m-0 border-none bg-none rounded-none border-l-[3px] border-l-transparent cursor-pointer transition-all duration-200 text-gray-600 text-[0.95rem] font-medium text-left w-full tracking-wide hover:bg-green-50/60 hover:text-green-600 hover:border-l-green-600/30 ${currentPath === item.path ? 'bg-green-50/100 text-green-600 border-l-green-600 font-semibold' : ''}`}
            onClick={() => onItemClick(item.path)}
          >
            <span className="text-xl mr-3 w-6 text-center hidden">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
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
    forceRefresh,
    showWasteModal,
    latestWasteNotification,
    closeWasteModal
  } = useBinNotifications();
  
  const navigate = useNavigate();
  const location = useLocation();

  // Memoize menu items - include admin items if user is admin
  const menuItems = useMemo(() => {
    const items = [...MENU_ITEMS];
    if (user?.role === 'admin') {
      return [...items, ...ADMIN_MENU_ITEMS];
    }
    return items;
  }, [user?.role]);

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
    setShowLogoutConfirm(true);
    setUserMenuOpen(false);
  }, []);

  const confirmLogout = useCallback(() => {
    setShowLogoutConfirm(false);
    onLogout();
  }, [onLogout]);

  // Memoize computed values
  const themeClasses = useMemo(() => 
    'light-theme', // Fixed to light theme per PRD
    []
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
      darkMode: false, // Fixed to light mode per PRD
      fontSize: preferences.uiSize,
      uiScale: 'normal',
      notifications: preferences.notifications,
      soundEffects: true,
      compactMode: false,
      showTooltips: true,
      autoSave: preferences.autoRefresh
    },
    updateSettings: () => {}
  }), [preferences.uiSize, preferences.notifications, preferences.autoRefresh]);

  const themeValue = useMemo(() => ({
    darkMode: false, // Fixed to light mode per PRD
    toggleDarkMode: () => {} // No-op function
  }), []);

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
        <div className="flex h-screen bg-[#f8fdf8] text-gray-900 font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif] transition-all duration-300">
          {/* Mobile Overlay */}
          {mobileOpen && (
            <div className="fixed top-0 left-0 w-full h-full bg-black/50 z-[998] md:hidden" onClick={() => setMobileOpen(false)}></div>
          )}

          {/* Sidebar */}
          <aside className={`w-[280px] bg-white border-r border-gray-200 flex-col transition-all duration-300 shadow-[2px_0_8px_rgba(0,0,0,0.1)] z-[999] fixed top-0 h-screen ${mobileOpen ? 'left-0' : '-left-[280px]'} md:left-0 hidden md:flex`}>
            <div className="p-5 border-b-2 border-gray-200 bg-gradient-to-br from-green-600/5 to-green-500/5">
              <img src={brandLogo} alt="Waste-Ed" className="w-[90px] h-auto block m-0" />
            </div>

            <SidebarNav 
              items={menuItems}
              currentPath={location.pathname}
              onItemClick={handleMenuClick}
            />

            {/* Dark mode toggle removed as per PRD requirements */}
          </aside>

          {/* Mobile Bottom Navigation */}
          <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pt-1.5 z-[1000] shadow-[0_-2px_10px_rgba(0,0,0,0.1)] [padding-bottom:max(8px,env(safe-area-inset-bottom))]">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`flex flex-col items-center justify-center py-2.5 px-1 border-none bg-none text-[0.65rem] font-medium cursor-pointer transition-all duration-200 flex-1 min-w-0 min-h-[56px] gap-0.5 active:scale-95 active:bg-green-50 ${location.pathname === item.path ? 'text-green-600 font-semibold' : 'text-gray-600'}`}
                onClick={() => handleMenuClick(item.path)}
              >
                <span className={`text-2xl transition-transform duration-200 leading-none ${location.pathname === item.path ? 'scale-110' : ''}`}>
                  {BOTTOM_NAV_META[item.id]?.icon || null}
                </span>
                <span className="mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full leading-tight">
                  {BOTTOM_NAV_META[item.id]?.label || item.label}
                </span>
              </button>
            ))}
          </nav>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden pb-[76px] md:pb-0 md:ml-[280px]">
            {/* Top Bar */}
            <header className="bg-white border-b border-gray-200 py-3 px-6 md:px-4 flex justify-between items-center shadow-[0_2px_4px_rgba(0,0,0,0.1)] z-[100]">
              <div className="flex items-center gap-4">
                <button className="md:hidden bg-none border-none p-2 rounded-md cursor-pointer text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900" onClick={toggleSidebar}>
                  <span className="text-xl">☰</span>
                </button>
                <h2 className="text-2xl md:text-[1.1rem] font-semibold m-0 text-gray-900">
                  {currentPageTitle}
                </h2>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative" ref={notificationMenuRef}>
                  <button 
                    className="relative bg-none border-none p-2 rounded-md cursor-pointer text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900" 
                    title="Notifications"
                    onClick={toggleNotificationMenu}
                  >
                    <span className="text-xl">🔔</span>
                  </button>

                  {notificationMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-[360px] max-h-[500px] bg-white border border-gray-200 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-[20px] z-[1000] overflow-hidden animate-slideDown md:fixed md:top-auto md:bottom-[76px] md:right-0 md:left-0 md:w-full md:max-w-full md:max-h-[70vh] md:m-0 md:rounded-t-2xl md:rounded-b-none md:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] max-[480px]:max-h-[75vh]">
                      <div className="p-4 md:p-4 md:sticky md:top-0 md:bg-white md:z-[1] max-[480px]:p-3 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="m-0 text-base md:text-base max-[480px]:text-[0.9rem] font-semibold text-gray-900">Notifications</h3>
                      </div>
                      
                      <div className="max-h-[400px] md:max-h-[calc(70vh-70px)] max-[480px]:max-h-[calc(75vh-65px)] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-gray-600">
                            <span className="text-3xl mb-2 block">🔕</span>
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
                    </div>
                  )}
                </div>

                <div className="relative" ref={userMenuRef}>
                  <button
                    className="flex items-center gap-2 bg-none border-none py-2 px-3 rounded-md cursor-pointer text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900"
                    onClick={toggleUserMenu}
                  >
                    <span className="text-xl">👤</span>
                    <span className="font-medium text-[0.9rem] md:hidden">{user?.username || 'User'}</span>
                    <span className="text-xs transition-transform duration-200">▼</span>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute top-full right-0 bg-white border border-gray-200 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] min-w-[200px] z-[1000] mt-1">
                      <div className="py-3 px-4 border-b border-gray-200">
                        <p className="m-0 text-sm text-gray-600">{user?.email || 'admin@wasted.com'}</p>
                      </div>
                      <div className="h-px bg-gray-200 m-0"></div>
                      <button className="flex items-center gap-2 py-3 px-4 bg-none border-none w-full text-left cursor-pointer text-gray-600 transition-all duration-200 text-[0.9rem] hover:bg-green-50 hover:text-gray-900" onClick={handleSettingsClick}>
                        <span className="text-base">⚙️</span>
                        Settings
                      </button>
                      <button className="flex items-center gap-2 py-3 px-4 bg-none border-none w-full text-left cursor-pointer text-gray-600 transition-all duration-200 text-[0.9rem] rounded-b-lg hover:bg-green-50 hover:text-gray-900" onClick={handleLogout}>
                        <span className="text-base">⏻</span>
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] bg-[#f8fdf8]">
              {children}
            </main>
          </div>
        </div>
        
        {/* Bin Full Modal - Lazy loaded */}
        <Suspense fallback={null}>
          <BinFullModal />
        </Suspense>

        {/* Waste Notification Modal - Lazy loaded */}
        <Suspense fallback={null}>
          {showWasteModal && latestWasteNotification && (
            <WasteNotificationModal 
              notification={latestWasteNotification}
              onClose={closeWasteModal}
            />
          )}
        </Suspense>

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[10000]" onClick={() => setShowLogoutConfirm(false)}>
            <div className="bg-white rounded-xl p-7 max-w-[400px] w-[90%] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="m-0 mb-4 text-xl font-semibold text-gray-900">Confirm Logout</h3>
              <p className="mb-6 text-gray-600 text-sm">Are you sure you want to log out?</p>
              <div className="flex gap-3 justify-end">
                <button 
                  className="py-2 px-4 border-none rounded-md text-sm font-medium cursor-pointer transition-all bg-gray-500 text-white hover:bg-gray-600"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button 
                  className="py-2 px-4 border-none rounded-md text-sm font-medium cursor-pointer transition-all bg-red-500 text-white hover:bg-red-600"
                  onClick={confirmLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </ThemeContext.Provider>
    </SettingsContext.Provider>
  );
};

export default memo(Dashboard);
