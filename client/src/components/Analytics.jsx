import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  MenuItem,
  ButtonGroup,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Recycling,
  Timeline,
  Assessment,
  Nature,
  DeviceHub,
  Warning
} from '@mui/icons-material';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [chartType, setChartType] = useState('line');
  const [metric, setMetric] = useState('weight');

  // Fetch analytics data
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', timeRange, metric],
    queryFn: async () => {
      const response = await fetch(`/api/waste/analytics?range=${timeRange}&metric=${metric}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Mock data for demonstration (replace with real API data)
  const mockTrendData = [
    { date: '2024-09-24', weight: 45.2, volume: 120, count: 8, recyclable: 25, organic: 15, general: 5 },
    { date: '2024-09-25', weight: 52.1, volume: 135, count: 12, recyclable: 30, organic: 18, general: 4 },
    { date: '2024-09-26', weight: 38.9, volume: 98, count: 6, recyclable: 20, organic: 12, general: 7 },
    { date: '2024-09-27', weight: 64.5, volume: 178, count: 15, recyclable: 35, organic: 22, general: 8 },
    { date: '2024-09-28', weight: 71.3, volume: 195, count: 18, recyclable: 42, organic: 25, general: 4 },
    { date: '2024-09-29', weight: 49.7, volume: 132, count: 10, recyclable: 28, organic: 16, general: 6 },
    { date: '2024-09-30', weight: 58.8, volume: 156, count: 14, recyclable: 33, organic: 20, general: 6 }
  ];

  const wasteTypeData = [
    { name: 'Recyclable', value: 45, color: '#22c55e' },
    { name: 'Organic', value: 30, color: '#f97316' },
    { name: 'General', value: 20, color: '#6b7280' },
    { name: 'Hazardous', value: 5, color: '#ef4444' }
  ];

  const devicePerformance = [
    { device: 'ARD001', weight: 234.5, efficiency: 92, status: 'online', lastSeen: '2 min ago' },
    { device: 'ARD002', weight: 189.2, efficiency: 88, status: 'online', lastSeen: '1 min ago' },
    { device: 'ARD003', weight: 156.8, efficiency: 85, status: 'offline', lastSeen: '15 min ago' },
    { device: 'ARD004', weight: 198.7, efficiency: 90, status: 'online', lastSeen: '3 min ago' },
    { device: 'ARD005', weight: 167.3, efficiency: 82, status: 'warning', lastSeen: '8 min ago' }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'error';
      case 'warning': return 'warning';
      default: return 'default';
    }
  };

  const formatValue = (value, type) => {
    switch (type) {
      case 'weight': return `${value.toFixed(1)} kg`;
      case 'volume': return `${value.toFixed(0)} L`;
      case 'count': return value.toString();
      default: return value.toString();
    }
  };

  const renderChart = () => {
    const data = analyticsData?.trends || mockTrendData;
    
    switch (chartType) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value) => formatValue(value, metric)}
                labelStyle={{ color: '#374151' }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey={metric} 
                stroke="#22c55e" 
                fill="#22c55e"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value) => formatValue(value, metric)}
                labelStyle={{ color: '#374151' }}
              />
              <Legend />
              <Bar dataKey={metric} fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      
      default: // line
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value) => formatValue(value, metric)}
                labelStyle={{ color: '#374151' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={metric} 
                stroke="#22c55e" 
                strokeWidth={3}
                dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Box className="space-y-6">
      {/* Header and Controls */}
      <Box className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <Box>
          <Typography variant="h4" className="font-bold text-gray-800 dark:text-white mb-2">
            Analytics Dashboard
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Track waste management performance and Arduino device analytics
          </Typography>
        </Box>
        
        <Box className="flex flex-wrap gap-2">
          <TextField
            select
            size="small"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="w-32"
          >
            <MenuItem value="24h">Last 24 Hours</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
            <MenuItem value="30d">Last 30 Days</MenuItem>
            <MenuItem value="90d">Last 90 Days</MenuItem>
          </TextField>
          
          <TextField
            select
            size="small"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="w-32"
          >
            <MenuItem value="weight">Weight</MenuItem>
            <MenuItem value="volume">Volume</MenuItem>
            <MenuItem value="count">Count</MenuItem>
          </TextField>
          
          <ButtonGroup size="small">
            <Button
              variant={chartType === 'line' ? 'contained' : 'outlined'}
              onClick={() => setChartType('line')}
            >
              Line
            </Button>
            <Button
              variant={chartType === 'area' ? 'contained' : 'outlined'}
              onClick={() => setChartType('area')}
            >
              Area
            </Button>
            <Button
              variant={chartType === 'bar' ? 'contained' : 'outlined'}
              onClick={() => setChartType('bar')}
            >
              Bar
            </Button>
          </ButtonGroup>
        </Box>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3}>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent>
              <Box className="flex items-center justify-between">
                <Box>
                  <Typography variant="h4" className="font-bold">
                    {analyticsData?.totalWeight?.toFixed(1) || '847.2'} kg
                  </Typography>
                  <Typography variant="body2">Total Weight</Typography>
                  <Box className="flex items-center mt-1">
                    <TrendingUp className="text-sm mr-1" />
                    <Typography variant="caption">+12.5% vs last week</Typography>
                  </Box>
                </Box>
                <Recycling className="text-4xl opacity-80" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent>
              <Box className="flex items-center justify-between">
                <Box>
                  <Typography variant="h4" className="font-bold">
                    {analyticsData?.efficiency?.toFixed(0) || '89'}%
                  </Typography>
                  <Typography variant="body2">Efficiency Rate</Typography>
                  <Box className="flex items-center mt-1">
                    <TrendingUp className="text-sm mr-1" />
                    <Typography variant="caption">+3.2% vs last week</Typography>
                  </Box>
                </Box>
                <Assessment className="text-4xl opacity-80" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent>
              <Box className="flex items-center justify-between">
                <Box>
                  <Typography variant="h4" className="font-bold">
                    {analyticsData?.activeDevices || '5'}
                  </Typography>
                  <Typography variant="body2">Active Devices</Typography>
                  <Box className="flex items-center mt-1">
                    <DeviceHub className="text-sm mr-1" />
                    <Typography variant="caption">All systems online</Typography>
                  </Box>
                </Box>
                <DeviceHub className="text-4xl opacity-80" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent>
              <Box className="flex items-center justify-between">
                <Box>
                  <Typography variant="h4" className="font-bold">
                    {analyticsData?.co2Saved?.toFixed(1) || '156.8'} kg
                  </Typography>
                  <Typography variant="body2">CO₂ Saved</Typography>
                  <Box className="flex items-center mt-1">
                    <Nature className="text-sm mr-1" />
                    <Typography variant="caption">Environmental impact</Typography>
                  </Box>
                </Box>
                <Nature className="text-4xl opacity-80" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Chart */}
      <Paper className="p-4">
        <Typography variant="h6" className="mb-4">
          Waste Collection Trends - {metric.charAt(0).toUpperCase() + metric.slice(1)}
        </Typography>
        {isLoading ? (
          <Box className="h-96 flex items-center justify-center">
            <LinearProgress className="w-48" />
          </Box>
        ) : (
          renderChart()
        )}
      </Paper>

      {/* Charts Row */}
      <Grid container spacing={3}>
        {/* Waste Type Distribution */}
        <Grid size={{xs: 12, md: 6}}>
          <Paper className="p-4">
            <Typography variant="h6" className="mb-4">Waste Type Distribution</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={wasteTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {wasteTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Device Performance */}
        <Grid size={{xs: 12, md: 6}}>
          <Paper className="p-4">
            <Typography variant="h6" className="mb-4">Device Performance</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Device</TableCell>
                    <TableCell align="right">Weight (kg)</TableCell>
                    <TableCell align="right">Efficiency</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {devicePerformance.map((device) => (
                    <TableRow key={device.device}>
                      <TableCell>
                        <Typography variant="body2" className="font-medium">
                          {device.device}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {device.lastSeen}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{device.weight}</TableCell>
                      <TableCell align="right">
                        <Box className="flex items-center justify-end">
                          <Box className="w-16 mr-2">
                            <LinearProgress
                              variant="determinate"
                              value={device.efficiency}
                              className="h-1"
                              sx={{
                                backgroundColor: 'gray.200',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: device.efficiency > 85 ? 'green.500' : 
                                                 device.efficiency > 70 ? 'orange.500' : 'red.500'
                                }
                              }}
                            />
                          </Box>
                          <Typography variant="body2">{device.efficiency}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={device.status}
                          size="small"
                          color={getStatusColor(device.status)}
                          icon={device.status === 'warning' ? <Warning /> : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Waste Type Trends */}
      <Paper className="p-4">
        <Typography variant="h6" className="mb-4">Waste Type Trends</Typography>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={mockTrendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="recyclable"
              stackId="1"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.8}
            />
            <Area
              type="monotone"
              dataKey="organic"
              stackId="1"
              stroke="#f97316"
              fill="#f97316"
              fillOpacity={0.8}
            />
            <Area
              type="monotone"
              dataKey="general"
              stackId="1"
              stroke="#6b7280"
              fill="#6b7280"
              fillOpacity={0.8}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Paper>
    </Box>
  );
};

export default Analytics;