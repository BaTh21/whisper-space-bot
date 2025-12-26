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
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useImage } from '../hooks/useImage';
import { unblockUser } from '../services/api';

const BlockedUsersTab = ({ setError, setSuccess, onSuccess, blockedUser }) => {
  const [blockedUsers, setBlockedUsers] = useState(blockedUser);
  const [loading, setLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);
  const { getOptimizedImageUrl, handleImageError } = useImage();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();

  const handleUnblock = async (userId, username) => {
    setUnblockingId(userId);
    try {
      await unblockUser(userId);
      setSuccess(t('success_unblocked', { username }));
      setBlockedUsers(prev => prev.filter(user => user.id !== userId));

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
      maxWidth: '100%',
      overflow: 'hidden'
    }}>

      {blockedUsers.length === 0 ? (
        <Box sx={{
          textAlign: 'center',
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
        <List
          sx={{
            p: 0,
            mb: 1,
            transition: 'all 0.2s ease',
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              lg: '1fr 1fr 1fr',
            },
            alignItems: 'center',
            gap: 2,

          }}>
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
                  mb: 1,
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: 'red',
                  backgroundColor: 'white',
                  transition: 'all 0.2s ease',
                  alignItems: 'center',
                  gap: { xs: 2, sm: 0 },
                  display: 'flex',
                  justifyContent: 'space-between',
                  px: 2
                }}
              >
                {/* User Info */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    width: { xs: '100%', sm: 'auto' },
                    flex: 1,
                    minWidth: 0,
                    gap: 1,
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: { xs: 40, sm: 48 } }}>
                    <Avatar
                      src={imageUrl}
                      sx={{
                        width: { xs: 40, sm: 48 },
                        height: { xs: 40, sm: 48 },
                        border: 1,
                        borderColor: 'divider',
                        color: 'white',
                        backgroundColor: 'red'
                      }}
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
                        flexDirection: 'row',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: { xs: 0.5, sm: 1 }
                      }}>
                        <Typography variant="body1" fontWeight="500" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, color: 'red' }}>
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
                      <Typography
                        variant="body2" color="error.main"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: { xs: 150, md: 190 },
                        }}
                      >
                        {user.email}
                      </Typography>
                    }
                  />
                </Box>

                {/* Unblock Button */}
                <Tooltip title='Unblock user'>
                  <Button
                    size='small'
                    onClick={() => handleUnblock(user.id, user.username)}
                    disabled={unblockingId === user.id}
                    color="green"
                    sx={{
                      borderRadius: '8px',
                      minWidth: 0,
                      color: 'green',
                      border: { xs: 'none', md: 1 }
                    }}
                  >
                    <PersonRemoveIcon />
                  </Button>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
};

export default BlockedUsersTab;
