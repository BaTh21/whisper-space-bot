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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  const fetchBlockedUsers = async () => {
    setLoading(true);
    try {
      const users = await getBlockedUsers();
      setBlockedUsers(users);
    } catch (err) {
      setError(t('error_fetch_blocked'));
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
    setSuccess(t('success_unblocked', { username }));
    setBlockedUsers(prev => prev.filter(user => user.id !== userId));
    
    // Notify parent to refresh friends list
    // if (onDataUpdate) onDataUpdate();
  } catch (err) {
    setError(t('error_unblock'));
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
            {t('no_blocked_users')}
          </Typography>
        </Box>
      ) : (
        <List sx={{ p: 0 }}>
          {blockedUsers.map((user) => {
            const imageUrl = getOptimizedImageUrl(user.avatar_url, {
              width: isMobile ? 80 : 100,
              height: isMobile ? 80 : 100,
              quality: 'auto:good',
              crop: 'fill',
              gravity: 'face'
            });

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
                {/* User Info */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  width: { xs: '100%', sm: 'auto' }
                }}>
                  <ListItemAvatar sx={{ minWidth: { xs: 40, sm: 48 } }}>
                    <Avatar 
                      src={imageUrl}
                      sx={{ width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 } }}
                      imgProps={{
                        crossOrigin: 'anonymous',
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
                          label={t('blocked')}
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
                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                    }
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
                  {unblockingId === user.id 
                    ? t('unblocking') 
                    : isMobile 
                      ? t('unblock') 
                      : t('unblock_user')}
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
