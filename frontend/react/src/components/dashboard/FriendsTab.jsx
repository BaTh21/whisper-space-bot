import { Block as BlockIcon, Message as MessageIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
  useTheme,
  ToggleButtonGroup,
  ToggleButton,
  ListItemIcon
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAvatar } from '../../hooks/useAvatar';
import { acceptFriendRequest, blockUser, unfriend } from '../../services/api';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HttpsIcon from '@mui/icons-material/Https';
import BlockedUsersTab from '../BlockedUsersTab';

const FriendsTab = ({
  friends,
  pendingRequests,
  setActiveTab,
  setError,
  setSuccess,
  onDataUpdate
}) => {
  const [acceptingId, setAcceptingId] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [activeMenu, setActiveMenu] = useState(0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  const { getUserAvatar, getUserInitials } = useAvatar();

  const handleAcceptRequest = async (requesterId) => {
    setAcceptingId(requesterId);
    try {
      await acceptFriendRequest(requesterId);
      setSuccess(t('friend_request_accepted'));
      onDataUpdate();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || t('friend_request_accept_failed'));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleActionMenuOpen = (event, friend) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedFriend(friend);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setSelectedFriend(null);
  };

  const handleUnfriend = async () => {
    if (!selectedFriend) return;

    setProcessingAction('unfriend');
    try {
      await unfriend(selectedFriend.id);
      setSuccess(t('unfriended_user', { username: selectedFriend.username }));
      onDataUpdate();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || t('unfriend_failed'));
    } finally {
      setProcessingAction(null);
      handleActionMenuClose();
    }
  };

  const handleBlock = async () => {
    if (!selectedFriend) return;

    setProcessingAction('block');
    try {
      await blockUser(selectedFriend.id);
      setSuccess(t('blocked_user', { username: selectedFriend.username }));
      onDataUpdate();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || t('block_user_failed'));
    } finally {
      setProcessingAction(null);
      handleActionMenuClose();
    }
  };

  const handleMessageFriend = (friend) => {
    if (typeof setActiveTab === 'function') {
      localStorage.setItem('selectedFriend', JSON.stringify(friend));
      setActiveTab(1);
      setSuccess(t('opening_chat', { username: friend.username }));

      setTimeout(() => {
        setSuccess('');
      }, 2000);
    } else {
      setError(t('cannot_open_messages'));

      setTimeout(() => {
        setError('');
      }, 2000);
    }
  };

  // Helper to extract data from pending requests with proper fallbacks
  const getRequesterData = (request) => {
    // Try to get data in multiple possible formats
    return {
      id: request.friend_request_id || request.id || request.requester_id,
      requesterId: request.requester_id || request.id,
      username: request.requester_username || request.username,
      email: request.requester_email || request.email,
      avatarUrl: request.requester_avatar_url || request.avatar_url
    };
  };

  const menus = [
    { label: `All Friends (${friends.length})`, icon: <MenuBookIcon /> },
    { label: `Pending (${pendingRequests.length})`, icon: <HttpsIcon /> },
    { label: 'Block', icon: <HttpsIcon /> },
  ];

  return (
    <Box
      sx={{
        py: { xs: 2, sm: 2 },
        maxWidth: '100%',
        overflow: 'hidden'
      }}
    >
      <Typography variant="h5" gutterBottom fontWeight="600" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        {t('friends')}
      </Typography>

      <Box
        sx={{
          my: 2,
          width: '100%',
          borderColor: 'divider',
        }}
      >
        <ToggleButtonGroup
          value={activeMenu}
          exclusive
          onChange={(event, newValue) => {
            if (newValue !== null) setActiveMenu(newValue);
          }}
          sx={{
            display: 'flex',
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {menus.map((item, index) => (
            <ToggleButton
              key={item.label}
              value={index}
              sx={{
                px: 1.5,
                py: 0.75,
                minHeight: 36,
                border: 'none',
                color: activeMenu === index ? 'primary.main' : 'text.secondary',
                '&:hover': {
                  bgcolor: 'action.hover',
                  color: 'primary.main',
                },
                '&.Mui-selected': {
                  bgcolor: 'transparent',
                  color: 'primary.main',
                },
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  height: 3,
                  bgcolor: 'primary.main',
                  transform: activeMenu === index ? 'scaleX(1)' : 'scaleX(0)',
                  transition: 'transform 0.25s ease',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 26, color: activeMenu === index ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: 12,
                  fontWeight: activeMenu === index ? 600 : 500,
                  lineHeight: 1.2,
                  mt: 0.25,
                  mr: 1,
                }}
              />
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>



      {activeMenu === 0 && (
        !friends || friends.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            {t('no_friends_yet')}
          </Typography>
        ) : (
          <List sx={{ p: 0 }}>
            {friends.map((friend) => (
              <ListItem
                key={friend.id}
                sx={{
                  mb: 1,
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'white',
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
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  width: { xs: '100%', sm: 'auto' },
                  flex: 1,
                  minWidth: 0
                }}>
                  <ListItemAvatar sx={{ minWidth: { xs: 40, sm: 48 } }}>
                    <Avatar
                      src={getUserAvatar(friend)}
                      sx={{
                        width: { xs: 40, sm: 48 },
                        height: { xs: 40, sm: 48 },
                        border: 1,
                        borderColor: 'divider'
                      }}
                      imgProps={{
                        onError: (e) => {
                          e.target.style.display = 'none';
                        }
                      }}
                    >
                      {getUserInitials(friend.username)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body1"
                        fontWeight="500"
                        sx={{
                          fontSize: { xs: '0.9rem', sm: '1rem' },
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {friend.username}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: { xs: '0.8rem', sm: '0.875rem' },
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {friend.email}
                      </Typography>
                    }
                    sx={{ my: 0, mr: { xs: 0, sm: 2 }, flex: 1, minWidth: 0 }}
                  />
                </Box>

                <Box sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  width: { xs: '100%', sm: 'auto' },
                  justifyContent: { xs: 'space-between', sm: 'flex-end' }
                }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleMessageFriend(friend)}
                    sx={{
                      borderRadius: '8px',
                      minWidth: { xs: 'auto', sm: 100 },
                      px: { xs: 1, sm: 2 },
                      flex: { xs: 1, sm: 'none' }
                    }}
                    startIcon={isMobile ? <MessageIcon /> : null}
                  >
                    {isMobile ? '' : t('messages')}
                  </Button>
                  <IconButton
                    onClick={(e) => handleActionMenuOpen(e, friend)}
                    disabled={processingAction === friend.id}
                    sx={{ borderRadius: '8px', flex: { xs: 'none', sm: 'none' } }}
                    aria-label="friend actions"
                    size={isMobile ? 'small' : 'medium'}
                  >
                    {processingAction === friend.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <MoreVertIcon fontSize={isMobile ? 'small' : 'medium'} />
                    )}
                  </IconButton>
                </Box>
              </ListItem>
            ))}
          </List>
        )
      )}

      {activeMenu === 1 && (
        pendingRequests && pendingRequests.length > 0 && (
          <Box sx={{ mb: 3 }}>
            {pendingRequests.map((request, index) => {
              const requesterData = getRequesterData(request);
              const requestId = requesterData.id || `request-${index}`;

              return (
                <Box
                  key={requestId}
                  sx={{
                    p: 1,
                    mb: 1,
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'white',
                    transition: 'all 0.2s ease',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: { xs: 2, sm: 0 },
                    '&:hover': {
                      transform: { xs: 'none', sm: 'translateY(-2px)' },
                      boxShadow: { xs: 'none', sm: '0 4px 12px rgba(0,0,0,0.1)' },
                    },
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      width: { xs: '100%', sm: 'auto' },
                      flex: 1,
                      minWidth: 0
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: { xs: 40, sm: 48 } }}>
                      <Avatar
                        src={requesterData.avatarUrl || getUserAvatar(request)}
                        sx={{
                          width: { xs: 40, sm: 48 },
                          height: { xs: 40, sm: 48 },
                          border: 1,
                          borderColor: 'divider'
                        }}
                        imgProps={{
                          onError: (e) => {
                            e.target.style.display = 'none';
                          }
                        }}
                      >
                        {getUserInitials(requesterData.username)}
                      </Avatar>
                    </ListItemAvatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0, ml: { xs: 1, sm: 2 } }}>
                      <Typography
                        variant="body1"
                        fontWeight="500"
                        sx={{
                          fontSize: { xs: '0.9rem', sm: '1rem' },
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {requesterData.username || t('unknown_user')}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: { xs: '0.8rem', sm: '0.875rem' },
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {requesterData.email || ''}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleAcceptRequest(requesterData.requesterId)}
                    disabled={acceptingId === requesterData.requesterId}
                    sx={{
                      borderRadius: '8px',
                      minWidth: { xs: '100%', sm: 100 },
                      mt: { xs: 1, sm: 0 },
                      ml: { xs: 0, sm: 2 }
                    }}
                  >
                    {acceptingId === requesterData.requesterId ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : t('accept')}
                  </Button>
                </Box>
              );
            })}
          </Box>
        )
      )}

      {activeMenu === 2 && (
        <BlockedUsersTab
          setError={setError}
          setSuccess={setSuccess}
          onDataUpdate={setSuccess}
        />
      )}

      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
        PaperProps={{
          sx: {
            borderRadius: '8px',
            minWidth: 140,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={handleUnfriend}
          disabled={processingAction === 'unfriend'}
          sx={{
            color: 'error.main',
            fontSize: { xs: '0.9rem', sm: '1rem' },
            py: 1.5
          }}
        >
          {processingAction === 'unfriend' ? (
            <CircularProgress size={16} sx={{ mr: 1 }} />
          ) : null}
          {processingAction === 'unfriend' ? t('unfriending') : t('unfriend')}
        </MenuItem>
        <MenuItem
          onClick={handleBlock}
          disabled={processingAction === 'block'}
          sx={{
            color: 'error.main',
            fontSize: { xs: '0.9rem', sm: '1rem' },
            py: 1.5
          }}
        >
          {processingAction === 'block' ? (
            <CircularProgress size={16} sx={{ mr: 1 }} />
          ) : (
            <BlockIcon sx={{ mr: 1, fontSize: { xs: 18, sm: 20 } }} />
          )}
          {processingAction === 'block' ? t('blocking') : t('block_user')}
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default FriendsTab;