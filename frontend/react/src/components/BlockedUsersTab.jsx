import { Block as BlockIcon, PersonRemove as PersonRemoveIcon } from '@mui/icons-material';
import {
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import { getBlockedUsers, unblockUser } from '../services/api';

const BlockedUsersTab = ({ setError, setSuccess, onDataUpdate }) => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);

  const fetchBlockedUsers = async () => {
    setLoading(true);
    try {
      const users = await getBlockedUsers();
      setBlockedUsers(users);
    } catch (err) {
      setError(err.message || 'Failed to fetch blocked users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const handleUnblock = async (userId, username) => {
    setUnblockingId(userId);
    try {
      await unblockUser(userId);
      setSuccess(`Unblocked ${username}`);
      setBlockedUsers(prev => prev.filter(user => user.id !== userId));
      if (onDataUpdate) onDataUpdate();
    } catch (err) {
      setError(err.message || 'Failed to unblock user');
    } finally {
      setUnblockingId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom fontWeight="600">
        Blocked Users
      </Typography>

      {blockedUsers.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          <BlockIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <br />
          No blocked users
        </Typography>
      ) : (
        <List>
          {blockedUsers.map((user) => (
            <ListItem
              key={user.id}
              sx={{
                p: 2,
                mb: 1,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: 'error.light',
                backgroundColor: 'rgba(211, 47, 47, 0.08)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }
              }}
            >
              <ListItemAvatar>
                <Avatar 
                  src={user.avatar_url} 
                  sx={{ width: 48, height: 48 }}
                  imgProps={{ 
                    onError: (e) => { 
                      e.target.style.display = 'none';
                    } 
                  }}
                >
                  <BlockIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" fontWeight="500">
                      {user.username}
                    </Typography>
                    <Chip 
                      label="Blocked" 
                      size="small" 
                      color="error" 
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={user.email}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  unblockingId === user.id ? (
                    <CircularProgress size={16} />
                  ) : (
                    <PersonRemoveIcon />
                  )
                }
                onClick={() => handleUnblock(user.id, user.username)}
                disabled={unblockingId === user.id}
                color="primary"
                sx={{ borderRadius: '8px', minWidth: 120 }}
              >
                {unblockingId === user.id ? 'Unblocking...' : 'Unblock'}
              </Button>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default BlockedUsersTab;