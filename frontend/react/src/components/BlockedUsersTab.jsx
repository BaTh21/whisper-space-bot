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
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useImage } from '../hooks/useImage';
import { getBlockedUsers, unblockUser } from '../services/api';

const BlockedUsersTab = ({ setError, setSuccess, onDataUpdate }) => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);
  const { getImageUrl, getOptimizedImageUrl, handleImageError } = useImage();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchBlockedUsers = async () => {
    setLoading(true);
    try {
      const users = await getBlockedUsers();
      console.log('📋 Blocked users data:', users); // Debug log
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
    <Box sx={{ 
      p: { xs: 2, sm: 3 },
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      <Typography variant="h5" gutterBottom fontWeight="600" sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
        Blocked Users
      </Typography>

      {blockedUsers.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <BlockIcon sx={{ 
            fontSize: { xs: 40, sm: 48 }, 
            color: 'text.secondary', 
            mb: 2 
          }} />
          <Typography color="text.secondary">
            No blocked users
          </Typography>
        </Box>
      ) : (
        <List sx={{ p: 0 }}>
          {blockedUsers.map((user) => {
            // Debug user data
            console.log('👤 User data:', {
              id: user.id,
              username: user.username,
              avatar_url: user.avatar_url,
              email: user.email
            });

            // Get optimized Cloudinary image URL for avatar
            const imageUrl = getOptimizedImageUrl(user.avatar_url, {
              width: isMobile ? 80 : 100,
              height: isMobile ? 80 : 100,
              quality: 'auto:good',
              crop: 'fill',
              gravity: 'face'
            });

            console.log('🖼️ Final image URL:', imageUrl); // Debug log
            
            return (
              <ListItem
                key={user.id}
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  mb: 1,
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: 'error.light',
                  backgroundColor: 'rgba(211, 47, 47, 0.08)',
                  transition: 'all 0.2s ease',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                  gap: { xs: 2, sm: 0 },
                  '&:hover': {
                    transform: { xs: 'none', sm: 'translateY(-2px)' },
                    boxShadow: { xs: 'none', sm: '0 4px 12px rgba(0,0,0,0.1)' },
                  }
                }}
              >
                {/* User Info Section */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  width: { xs: '100%', sm: 'auto' },
                  mb: { xs: 0, sm: 0 }
                }}>
                  <ListItemAvatar sx={{ minWidth: { xs: 40, sm: 48 } }}>
                    <Avatar 
                      src={imageUrl}
                      sx={{ 
                        width: { xs: 40, sm: 48 }, 
                        height: { xs: 40, sm: 48 } 
                      }}
                      imgProps={{
                        crossOrigin: 'anonymous', // This prevents third-party cookie warnings
                        onError: (e) => handleImageError(user.avatar_url, e)
                      }}
                    >
                      {user.username?.charAt(0)?.toUpperCase() || <BlockIcon fontSize={isSmallMobile ? 'small' : 'medium'} />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: { xs: 0.5, sm: 1 }
                      }}>
                        <Typography variant="body1" fontWeight="500" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                          {user.username}
                        </Typography>
                        <Chip 
                          label="Blocked" 
                          size="small" 
                          color="error" 
                          variant="outlined"
                          sx={{ 
                            fontSize: { xs: '0.7rem', sm: '0.8rem' },
                            height: { xs: 20, sm: 24 }
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                        {user.email}
                      </Typography>
                    }
                    sx={{ my: 0 }}
                  />
                </Box>

                {/* Unblock Button */}
                <Button
                  variant="outlined"
                  size={isMobile ? 'small' : 'medium'}
                  startIcon={
                    unblockingId === user.id ? (
                      <CircularProgress size={16} />
                    ) : (
                      <PersonRemoveIcon fontSize={isSmallMobile ? 'small' : 'medium'} />
                    )
                  }
                  onClick={() => handleUnblock(user.id, user.username)}
                  disabled={unblockingId === user.id}
                  color="primary"
                  sx={{ 
                    borderRadius: '8px', 
                    minWidth: { xs: '100%', sm: 120 },
                    mt: { xs: 1, sm: 0 }
                  }}
                >
                  {unblockingId === user.id ? 'Unblocking...' : isMobile ? 'Unblock' : 'Unblock User'}
                </Button>
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
};

export default BlockedUsersTab;