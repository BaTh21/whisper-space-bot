// components/SystemLogs.jsx - Fixed hydration errors
import {
    Computer,
    Delete,
    DesktopWindows,
    Edit,
    FilterList,
    Info,
    Login,
    Logout,
    PhoneAndroid,
    Refresh,
    Search,
    Security,
    Tablet
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMyDevices, getMyLogs } from '../services/api';
// Import your date utilities - adjust the path based on where your file is
import { formatCambodiaTime } from '../utils/dateUtils'; // Adjust this path

const SystemLogs = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [selectedAction, setSelectedAction] = useState('all');

  const actionTypes = [
    { value: 'all', label: t('all_actions') },
    { value: 'login', label: t('login'), icon: <Login /> },
    { value: 'logout', label: t('logout'), icon: <Logout /> },
    { value: 'profile_update', label: t('profile_update'), icon: <Edit /> },
    { value: 'password_change', label: t('password_change'), icon: <Security /> },
    { value: 'diary_created', label: t('diary_created'), icon: <Edit /> },
    { value: 'diary_deleted', label: t('diary_deleted'), icon: <Delete /> },
  ];

  const getDeviceIcon = (deviceType) => {
    if (!deviceType) return <Computer />;
    
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return <PhoneAndroid />;
      case 'tablet':
        return <Tablet />;
      case 'desktop':
        return <DesktopWindows />;
      default:
        return <Computer />;
    }
  };

  const getActionColor = (action) => {
    if (!action) return 'default';
    
    switch (action) {
      case 'login':
        return 'success';
      case 'logout':
        return 'warning';
      case 'profile_update':
        return 'info';
      case 'password_change':
        return 'primary';
      case 'diary_created':
        return 'success';
      case 'diary_deleted':
        return 'error';
      default:
        return 'default';
    }
  };

  const getActionIcon = (action) => {
    if (!action) return <Info />;
    
    switch (action) {
      case 'login':
        return <Login />;
      case 'logout':
        return <Logout />;
      case 'profile_update':
        return <Edit />;
      case 'password_change':
        return <Security />;
      case 'diary_created':
        return <Edit />;
      case 'diary_deleted':
        return <Delete />;
      default:
        return <Info />;
    }
  };

  const getTranslatedAction = (action) => {
    if (!action) return t('unknown_action');
    const translationKey = `action_${action}`;
    const translation = t(translationKey);
    // If translation doesn't exist, return the action itself
    return translation === translationKey ? action : translation;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch logs and devices in parallel
      const [logsData, devicesData] = await Promise.all([
        getMyLogs(selectedAction === 'all' ? null : selectedAction, 100),
        getMyDevices()
      ]);
      
      console.log('=== Raw API Response ===');
      console.log('Logs data:', logsData);
      console.log('Devices data:', devicesData);
      
      // Ensure logs and devices are always arrays
      setLogs(Array.isArray(logsData) ? logsData : []);
      setDevices(Array.isArray(devicesData) ? devicesData : []);
    } catch (err) {
      console.error('Fetch system logs error:', err);
      setError(err.message || t('failed_to_load_system_logs'));
      setLogs([]);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedAction]);

  // Ensure filteredLogs is always an array
  const filteredLogs = Array.isArray(logs) ? logs.filter(log => {
    if (!log || typeof log !== 'object') return false;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (log.action && log.action.toLowerCase().includes(searchLower)) ||
      (log.device_name && log.device_name.toLowerCase().includes(searchLower)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(searchLower)) ||
      (log.browser && log.browser.toLowerCase().includes(searchLower)) ||
      (log.os && log.os.toLowerCase().includes(searchLower))
    );
  }) : [];

  const handleFilterClick = (event) => {
    setFilterMenuAnchor(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterMenuAnchor(null);
  };

  const handleActionSelect = (action) => {
    setSelectedAction(action);
    handleFilterClose();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom fontWeight={600}>
        {t('system_logs')}
      </Typography>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('system_logs_description')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Devices Section */}
      <Paper elevation={0} sx={{ mb: 4, p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={600}>
            {t('active_devices')}
          </Typography>
          <Chip 
            label={`${devices.length} ${t('devices')}`} 
            color="primary" 
            variant="outlined"
            size="small"
          />
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        {devices.length === 0 ? (
          <Typography color="text.secondary" align="center" py={3}>
            {t('no_devices_found')}
          </Typography>
        ) : (
          <List disablePadding>
            {devices.map((device, index) => (
              <React.Fragment key={device.id || index}>
                <ListItem
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: 'transparent',
                    border: 'none',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getDeviceIcon(device.device_type)}
                  </ListItemIcon>
                  <Box sx={{ flex: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Typography variant="subtitle1" fontWeight={500} component="div">
                        {device.device_name || t('unknown_device')}
                      </Typography>
                    </Box>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary" component="div">
                        {device.browser || 'Unknown'} • {device.os || 'Unknown'}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" component="div">
                        <Typography variant="caption" color="text.secondary" component="span">
                          <strong>IP:</strong> {device.ip_address || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="span">
                          •
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="span">
                          <strong>{t('last_login')}:</strong> {formatCambodiaTime(device.last_login)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                  <Chip
                    icon={getDeviceIcon(device.device_type)}
                    label={device.device_type || t('unknown')}
                    size="small"
                    variant="outlined"
                    sx={{ ml: 1 }}
                  />
                </ListItem>
                {index < devices.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Activity Logs Section */}
      {/* <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={600}>
            {t('recent_activity')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              placeholder={t('search_activity')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 200 }}
            />
            <Tooltip title={t('filter_actions')}>
              <IconButton onClick={handleFilterClick} size="small">
                <FilterList />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('refresh')}>
              <IconButton onClick={fetchData} size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Menu
          anchorEl={filterMenuAnchor}
          open={Boolean(filterMenuAnchor)}
          onClose={handleFilterClose}
        >
          {actionTypes.map((action) => (
            <MenuItem
              key={action.value}
              onClick={() => handleActionSelect(action.value)}
              selected={selectedAction === action.value}
            >
              {action.icon && <ListItemIcon>{action.icon}</ListItemIcon>}
              <ListItemText>{action.label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>

        {selectedAction !== 'all' && (
          <Chip
            label={actionTypes.find(a => a.value === selectedAction)?.label}
            onDelete={() => setSelectedAction('all')}
            size="small"
            sx={{ mb: 2 }}
          />
        )}

        <Divider sx={{ mb: 2 }} />

        {filteredLogs.length === 0 ? (
          <Typography color="text.secondary" align="center" py={3}>
            {searchTerm ? t('no_activity_found_for_search') : t('no_activity_found')}
          </Typography>
        ) : (
          <List disablePadding>
            {filteredLogs.map((log, index) => (
              <React.Fragment key={log.id || index}>
                <ListItem 
                  sx={{ 
                    borderRadius: 1, 
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getActionIcon(log.action)}
                  </ListItemIcon>
                  <Box sx={{ flex: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5} flexWrap="wrap">
                      <Typography variant="subtitle1" fontWeight={500} component="div">
                        {getTranslatedAction(log.action)}
                      </Typography>
                      <Chip
                        label={log.action || 'unknown'}
                        color={getActionColor(log.action)}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary" component="div">
                        {log.device_name || 'Unknown device'} • {log.browser || 'Unknown'} • {log.os || 'Unknown'}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" component="div">
                        <Typography variant="caption" color="text.secondary" component="span">
                          <strong>IP:</strong> {log.ip_address || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="span">
                          •
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="span">
                          <strong>Time:</strong> {formatCambodiaTime(log.created_at)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                </ListItem>
                {index < filteredLogs.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper> */}
    </Box>
  );
};

export default SystemLogs;