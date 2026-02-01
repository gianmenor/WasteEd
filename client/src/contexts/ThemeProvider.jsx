const ThemeProvider = ({ children }) => {
  // Dark mode is fully removed; light theme is defined via CSS variables in index.css
  return children;
};

export default ThemeProvider;