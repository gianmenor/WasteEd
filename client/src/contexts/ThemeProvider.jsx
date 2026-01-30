import { useEffect } from 'react';

const ThemeProvider = ({ children }) => {
  useEffect(() => {
    // Apply light theme only (dark mode removed per PRD)
    const body = document.body;
    const html = document.documentElement;
    
    body.classList.add('light-theme');
    html.classList.add('light-theme');
    body.classList.remove('dark-theme');
    html.classList.remove('dark-theme');
    html.setAttribute('data-theme', 'light');

    // Cleanup function
    return () => {
      body.classList.remove('dark-theme', 'light-theme');
      html.classList.remove('dark-theme', 'light-theme');
      html.removeAttribute('data-theme');
    };
  }, []); // No dependencies - always light theme

  return children;
};

export default ThemeProvider;