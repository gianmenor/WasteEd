import { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Visibility, VisibilityOff, Recycling } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(credentials);
      
      if (!result.success) {
        setError(result.error);
      }
      // If successful, the AuthContext will handle the redirect
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container
      maxWidth="sm"
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800"
    >
      <Paper
        elevation={8}
        className="p-8 w-full max-w-md rounded-xl bg-white dark:bg-gray-800"
      >
        <Box className="text-center mb-6">
          <Box className="flex justify-center mb-4">
            <Box className="p-3 rounded-full bg-green-100 dark:bg-green-900">
              <Recycling className="text-4xl text-green-600 dark:text-green-400" />
            </Box>
          </Box>
          <Typography
            variant="h4"
            component="h1"
            className="font-bold text-gray-800 dark:text-white mb-2"
          >
            RecycList
          </Typography>
          <Typography
            variant="body1"
            color="textSecondary"
            className="text-gray-600 dark:text-gray-300"
          >
            Smart Waste Management System
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            name="username"
            value={credentials.username}
            onChange={handleChange}
            margin="normal"
            required
            autoComplete="username"
            autoFocus
            className="mb-4"
          />

          <TextField
            fullWidth
            label="Password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={credentials.password}
            onChange={handleChange}
            margin="normal"
            required
            autoComplete="current-password"
            className="mb-6"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            className="py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
            sx={{
              backgroundColor: 'green.600',
              '&:hover': {
                backgroundColor: 'green.700',
              },
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        <Box className="mt-6 text-center">
          <Typography
            variant="body2"
            color="textSecondary"
            className="text-gray-600 dark:text-gray-400 mb-4"
          >
            Connect your Arduino devices to start tracking waste data
          </Typography>
          
          <Box className="p-3 bg-green-50 dark:bg-green-900 rounded-lg">
            <Typography variant="caption" className="block text-green-700 dark:text-green-300 font-semibold mb-1">
              Demo Credentials:
            </Typography>
            <Typography variant="caption" className="block text-green-600 dark:text-green-400">
              Username: admin | Password: 123456
            </Typography>
            <Typography variant="caption" className="block text-green-600 dark:text-green-400">
              Username: testuser | Password: password123
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login;