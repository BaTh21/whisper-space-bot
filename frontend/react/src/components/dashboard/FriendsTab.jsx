import { Block as BlockIcon } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
  ToggleButton,
  ListItemIcon,
  Tooltip
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAvatar } from '../../hooks/useAvatar';
import { acceptFriendRequest, blockUser, unfriend, sendFriendRequest, deletePendingRequest } from '../../services/api';
import BlockedUsersTab from '../BlockedUsersTab';
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SuggestFriendComponent from '../friend/SuggestFriendComponent';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import { toast } from 'react-toastify';
import AssistantIcon from '@mui/icons-material/Assistant';

const FriendsTab = ({
  friends,
  pendingRequests,
  setActiveTab,
  setError,
  setSuccess,
  onDataUpdate,
  suggestFriends,
  pendingFriends,
  blockedUsers,
}) => {
  const [acceptingId, setAcceptingId] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [activeMenu, setActiveMenu] = useState(0);
  const [suggestFriend, setSuggestFriend] = useState(suggestFriends);
  const [pendingFriend, setPendingFriend] = useState(pendingFriends);

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

  const handleSendFriendRequest = async (userId) => {
    const result = await sendFriendRequest(userId);
    if (result.success) {
      toast.success(result.message);
      setSuggestFriend(prev => prev.filter(f => f.id !== userId));
      onDataUpdate();
    } else {
      toast.error(result.message);
    }
  };

  const handleDeletePendingRequest = async (pendingId) => {
    const res = await deletePendingRequest(pendingId);

    if (res === true) {
      toast.success("Pending has been canceled");
      setPendingFriend(prev => prev.filter(f => f.id !== pendingId));
      onDataUpdate();
    } else {
      toast.error(res);
    }
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
    { label: `All Friends (${friends.length})`, icon: <PeopleIcon /> },
    { label: `Add Friends `, icon: <PersonAddIcon /> },
    { label: `Request (${pendingRequests.length})`, icon: <PersonSearchIcon /> },
    { label: `Pending (${pendingFriend.length})`, icon: <AccessTimeIcon /> },
    { label: `Block (${blockedUsers.length})`, icon: <BlockIcon /> },
  ];

  return (
    <Box
      sx={{
        py: { xs: 2, sm: 2 },
        maxWidth: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        height: '90vh',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      <SuggestFriendComponent
        suggestFriends={suggestFriend}
      />
      <Typography variant="h5" gutterBottom fontWeight="600" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        {t('friends')}
      </Typography>

      <Box
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
            e.preventDefault();
          }
        }}
        sx={{
          display: 'flex',
          overflowX: 'auto',
          scrollBehavior: 'smooth',
          whiteSpace: 'nowrap',
          '&::-webkit-scrollbar': { display: 'none' },
          my: 2
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            width: { xs: 200, md: '100%' },
            whiteSpace: 'nowrap',
          }}
        >
          {menus.map((item, index) => {
            const selected = activeMenu === index;

            return (
              <ToggleButton
                key={item.label}
                value={index}
                selected={selected}
                onClick={() => setActiveMenu(index)}
                sx={{
                  flexShrink: 0,
                  px: 2,
                  py: 1,
                  minHeight: 40,
                  border: 'none',
                  bgcolor: 'transparent',
                  userSelect: 'none',
                  color: selected ? 'primary.main' : 'text.secondary',
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
                    transform: selected ? 'scaleX(1)' : 'scaleX(0)',
                    transition: 'transform 0.25s ease',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 26,
                    color: selected ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: selected ? 600 : 500,
                    whiteSpace: 'nowrap',
                  }}
                />
              </ToggleButton>
            );
          })}
        </Box>
      </Box>

      {activeMenu === 0 && (
        !friends || friends.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            {t('no_friends_yet')}
          </Typography>
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
              gap: { xs: 1, md: 2 },
            }}
          >
            {friends.map((friend) => (
              <ListItem
                key={friend.id}
                sx={{
                  mb: { xs: 0, md: 1 },
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'white',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: { xs: 2, sm: 0 },
                  '&:hover': {
                    transform: { xs: 'none', sm: 'translateY(-2px)' },
                    boxShadow: { xs: 'none', sm: '0 4px 12px rgba(0,0,0,0.1)' },
                  }
                }}
                onClick={(e) => handleActionMenuOpen(e, friend)}
              >
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  width: { xs: '100%', sm: 'auto' },
                  flex: 1,
                  minWidth: 0,
                  gap: 1
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

                <Tooltip title={`send ${friend.username} a message?`}>
                  <IconButton
                    variant="outlined"
                    size="small"
                    onClick={() => handleMessageFriend(friend)}
                    sx={{
                      bgcolor: 'transparent',
                      '&:hover': {
                        bgcolor: 'transparent',
                        transform: 'scale(1.2)',
                      }
                    }}
                  >
                    <AssistantIcon color='primary.main' />
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        )
      )}

      {activeMenu === 1 && (
        !suggestFriend || suggestFriend.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            {t('no_friends_yet')}
          </Typography>
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
              gap: { xs: 1, md: 2 },
            }}
          >
            {suggestFriend.map((friend) => (
              <ListItem
                key={friend.id}
                sx={{
                  mb: { xs: 0, md: 1 },
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'white',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
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
                  width: { xs: '80%', sm: 'auto' },
                  flex: 1,
                  minWidth: 0,
                  gap: 1,
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

                <Tooltip title={`add ${friend.username} as friend`}>
                  <IconButton
                    variant="outlined"
                    size="small"
                    onClick={() => handleSendFriendRequest(friend.id)}
                    sx={{
                      minWidth: 0,
                      bgcolor: 'transparent',
                      '&:hover': {
                        bgcolor: 'transparent',
                        transform: 'scale(1.2)'
                      }
                    }}
                  >
                    <PersonAddIcon />
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        )
      )}

      {activeMenu === 2 && (
        pendingRequests && pendingRequests.length > 0 ? (
          <Box
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
              gap: { xs: 1, md: 2 },
            }}
          >
            {pendingRequests?.map((request, index) => {
              const requesterData = getRequesterData(request);
              const requestId = requesterData.id || `request-${index}`;

              return (
                <Box
                  key={requestId}
                  sx={{
                    p: 1,
                    mb: { xs: 0, md: 1 },
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'white',
                    transition: 'all 0.2s ease',
                    // flexDirection: { xs: 'column', sm: 'row' },
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
                      minWidth: 0,
                      gap: 1
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
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
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
                    variant="outlined"
                    size="small"
                    onClick={() => handleAcceptRequest(requesterData.requesterId)}
                    disabled={acceptingId === requesterData.requesterId}
                    sx={{
                      borderRadius: '8px',
                      minWidth: 0,
                      mt: { xs: 1, sm: 0 },
                      ml: { xs: 0, sm: 2 }
                    }}
                  >
                    Confirm
                  </Button>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Typography
            color="text.secondary"
            sx={{ py: 2, textAlign: 'center' }}
          >
            No requesting friend
          </Typography>
        )
      )}

      {activeMenu === 3 && (
        pendingFriend && pendingFriend.length > 0 ? (
          <Box
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
              gap: { xs: 1, md: 2 },
            }}
          >
            {pendingFriend?.map((friend) => (
              <Box
                key={friend.id}
                sx={{
                  p: 1,
                  mb: { xs: 0, md: 1 },
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'white',
                  transition: 'all 0.2s ease',
                  // flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: 'center',
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
                    minWidth: 0,
                    gap: 1
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: { xs: 40, sm: 48 } }}>
                    <Avatar
                      src={friend?.friend?.avatar_url}
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
                      {getUserInitials(friend?.friend?.username)}
                    </Avatar>
                  </ListItemAvatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
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
                      {friend?.friend?.username || t('unknown_user')}
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
                      {friend?.friend?.email || ''}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{
                    borderRadius: '8px',
                    minWidth: 0,
                    mt: { xs: 1, sm: 0 },
                    ml: { xs: 0, sm: 2 }
                  }}
                  onClick={() => handleDeletePendingRequest(friend.id)}
                >
                  Cancel
                </Button>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography
            color="text.secondary"
            sx={{ py: 2, textAlign: 'center' }}
          >
            No pending requests
          </Typography>
        )
      )}

      {activeMenu === 4 && (
        <BlockedUsersTab
          setError={setError}
          setSuccess={setSuccess}
          onSucess={setSuccess}
          blockedUser={blockedUsers}
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