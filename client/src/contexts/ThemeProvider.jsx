import { useEffect } from 'react';
import { usePreferences } from './PreferencesContext';

const ThemeProvider = ({ children }) => {
  const { preferences } = usePreferences();

  useEffect(() => {
    // Apply theme class to document body for global theming
    const body = document.body;
    const html = document.documentElement;
    
    if (preferences.theme === 'dark') {
      body.classList.add('dark-theme');
      html.classList.add('dark-theme');
      body.classList.remove('light-theme');
      html.classList.remove('light-theme');
      html.setAttribute('data-theme', 'dark');
    } else {
      body.classList.add('light-theme');
      html.classList.add('light-theme');
      body.classList.remove('dark-theme');
      html.classList.remove('dark-theme');
      html.setAttribute('data-theme', 'light');
    }

    // Cleanup function
    return () => {
      body.classList.remove('dark-theme', 'light-theme');
      html.classList.remove('dark-theme', 'light-theme');
      html.removeAttribute('data-theme');
    };
  }, [preferences.theme]);

  return children;
};

export default ThemeProvider;