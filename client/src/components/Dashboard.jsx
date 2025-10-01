import { useState, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Switch,
  FormControlLabel,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  TableChart,
  Analytics,
  Settings,
  Logout,
  Recycling,
  DarkMode,
  LightMode,
  NotificationsActive
} from '@mui/icons-material';

// Theme Context
const ThemeContext = createContext();

export const useThemeContext = () => useContext(ThemeContext);

const drawerWidth = 240;

const Dashboard = ({ user, onLogout, children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Determine current page from URL
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === '/waste') return 'waste';
    if (path === '/analytics') return 'analytics';
    if (path === '/settings') return 'settings';
    return 'dashboard';
  };

  const currentPage = getCurrentPage();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    onLogout();
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleNavigation = (key) => {
    const routes = {
      'dashboard': '/',
      'waste': '/waste',
      'analytics': '/analytics',
      'settings': '/settings',
    };
    navigate(routes[key]);
    
    // Close mobile drawer after navigation
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, key: 'dashboard' },
    { text: 'Waste Management', icon: <TableChart />, key: 'waste' },
    { text: 'Analytics', icon: <Analytics />, key: 'analytics' },
    { text: 'Settings', icon: <Settings />, key: 'settings' },
  ];

  const drawer = (
    <Box>
      <Box className="p-4 bg-green-600 text-white">
        <Box className="flex items-center space-x-2 mb-2">
          <Recycling className="text-2xl" />
          <Typography variant="h6" className="font-bold">
            RecycList
          </Typography>
        </Box>
        <Typography variant="body2" className="opacity-90">
          Smart Waste Management
        </Typography>
      </Box>
      
      <Divider />
      
      <List className="mt-2">
        {menuItems.map((item) => (
          <ListItem
            key={item.key}
            onClick={() => handleNavigation(item.key)}
            className={`mx-2 mb-1 rounded-lg transition-colors duration-200 cursor-pointer ${
              currentPage === item.key
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'hover:bg-gray-100'
            }`}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: currentPage === item.key ? 'green.200' : 'grey.100'
              }
            }}
          >
            <ListItemIcon
              className={currentPage === item.key ? 'text-green-700' : 'text-gray-600'}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.text}
              className={currentPage === item.key ? 'text-green-700' : 'text-gray-700'}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <Box className={`flex h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        {/* App Bar */}
        <AppBar
          position="fixed"
          className="z-10"
          sx={{
            width: { md: `calc(100% - ${drawerWidth}px)` },
            ml: { md: `${drawerWidth}px` },
            backgroundColor: '#16a34a',
            color: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            
            <Typography variant="h6" noWrap component="div" className="flex-1">
              {menuItems.find(item => item.key === currentPage)?.text || 'Dashboard'}
            </Typography>

            <Box className="flex items-center space-x-2">
              <FormControlLabel
                control={
                  <Switch
                    checked={darkMode}
                    onChange={toggleDarkMode}
                    icon={<LightMode />}
                    checkedIcon={<DarkMode />}
                  />
                }
                label=""
              />
              
              <IconButton color="inherit">
                <Badge badgeContent={3} color="error">
                  <NotificationsActive />
                </Badge>
              </IconButton>

              <IconButton
                onClick={handleProfileMenuOpen}
                color="inherit"
                className="ml-2"
              >
                <Avatar
                  className="w-8 h-8 bg-green-600"
                  sx={{ bgcolor: 'green.600' }}
                >
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Profile Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleProfileMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleProfileMenuClose}>
            <ListItemIcon>
              <Settings fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>

        {/* Navigation Drawer */}
        <Box
          component="nav"
          sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        >
          <Drawer
            container={undefined}
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
              },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { md: `calc(100% - ${drawerWidth}px)` },
            mt: 8,
          }}
          className={`${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'} min-h-screen`}
        >
          {children}
        </Box>
      </Box>
    </ThemeContext.Provider>
  );
};

export default Dashboard;