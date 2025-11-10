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
  useTheme
} from '@mui/material';
import { useState } from 'react';
import { useAvatar } from '../../hooks/useAvatar';
import { acceptFriendRequest, blockUser, unfriend } from '../../services/api';

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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Use the avatar hook
  const { getUserAvatar, getUserInitials } = useAvatar();

  const handleAcceptRequest = async (requesterId) => {
    setAcceptingId(requesterId);
    try {
      await acceptFriendRequest(requesterId);
      setSuccess('Friend request accepted successfully!');
      onDataUpdate();
    } catch (err) {
      console.error('Accept request failed:', err);
      setError(err.message || 'Failed to accept friend request');
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
      setSuccess(`Unfriended ${selectedFriend.username}`);
      onDataUpdate();
    } catch (err) {
      console.error('Unfriend failed:', err);
      setError(err.message || 'Failed to unfriend');
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
      setSuccess(`Blocked ${selectedFriend.username}`);
      onDataUpdate();
    } catch (err) {
      console.error('Block failed:', err);
      setError(err.message || 'Failed to block user');
    } finally {
      setProcessingAction(null);
      handleActionMenuClose();
    }
  };

  const handleMessageFriend = (friend) => {
  console.log('Message button clicked for friend:', friend);
  
  if (typeof setActiveTab === 'function') {
    localStorage.setItem('selectedFriend', JSON.stringify(friend));
    setActiveTab(1);
    setSuccess(`Opening chat with ${friend.username}`);
    
    // Auto-hide success message after 2 seconds
    setTimeout(() => {
      setSuccess('');
    }, 2000);
  } else {
    console.error('setActiveTab is not a function');
    setError('Cannot open messages. Please try again.');
    
    // Auto-hide error message after 2 seconds
    setTimeout(() => {
      setError('');
    }, 2000);
  }
};

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 },
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      <Typography variant="h5" gutterBottom fontWeight="600" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        Friends
      </Typography>

      {pendingRequests.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom color="primary" fontWeight="600" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Pending Requests ({pendingRequests.length})
          </Typography>
          {pendingRequests.map((request) => (
            <Card 
              key={request.id} 
              sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                mb: 1, 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                gap: { xs: 2, sm: 0 },
                borderRadius: '12px'
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center',
                width: { xs: '100%', sm: 'auto' }
              }}>
                <ListItemAvatar sx={{ minWidth: { xs: 40, sm: 48 } }}>
                  <Avatar 
                    src={getUserAvatar(request)} 
                    sx={{ 
                      width: { xs: 40, sm: 48 }, 
                      height: { xs: 40, sm: 48 } 
                    }}
                    imgProps={{
                      onError: (e) => {
                        e.target.style.display = 'none';
                      }
                    }}
                  >
                    {getUserInitials(request.username)}
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
                    {request.username}
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
                    {request.email}
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleAcceptRequest(request.id)}
                disabled={acceptingId === request.id}
                sx={{ 
                  borderRadius: '8px', 
                  minWidth: { xs: '100%', sm: 100 },
                  mt: { xs: 1, sm: 0 }
                }}
              >
                {acceptingId === request.id ? (
                  <CircularProgress size={20} />
                ) : (
                  'Accept'
                )}
              </Button>
            </Card>
          ))}
        </Box>
      )}

      <Typography variant="h6" gutterBottom fontWeight="600" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
        Your Friends ({friends.length})
      </Typography>
      {friends.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          No friends yet. Search for users to add friends!
        </Typography>
      ) : (
        <List sx={{ p: 0 }}>
          {friends.map((friend) => (
            <ListItem
              key={friend.id}
              sx={{
                p: { xs: 1.5, sm: 2 },
                mb: 1,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: 'divider',
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
              {/* Friend Info Section */}
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
                      height: { xs: 40, sm: 48 } 
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
                  sx={{ 
                    my: 0,
                    mr: { xs: 0, sm: 2 },
                    flex: 1,
                    minWidth: 0
                  }}
                />
              </Box>

              {/* Action Buttons */}
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
                  {isMobile ? '' : 'Message'}
                </Button>
                <IconButton
                  onClick={(e) => handleActionMenuOpen(e, friend)}
                  disabled={processingAction === friend.id}
                  sx={{ 
                    borderRadius: '8px',
                    flex: { xs: 'none', sm: 'none' }
                  }}
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
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
        PaperProps={{
          sx: { 
            borderRadius: '8px',
            minWidth: 140
          }
        }}
      >
        <MenuItem 
          onClick={handleUnfriend}
          disabled={processingAction === 'unfriend'}
          sx={{ color: 'error.main', fontSize: { xs: '0.9rem', sm: '1rem' } }}
        >
          {processingAction === 'unfriend' ? 'Unfriending...' : 'Unfriend'}
        </MenuItem>
        <MenuItem 
          onClick={handleBlock}
          disabled={processingAction === 'block'}
          sx={{ color: 'error.main', fontSize: { xs: '0.9rem', sm: '1rem' } }}
        >
          <BlockIcon sx={{ mr: 1, fontSize: { xs: 18, sm: 20 } }} />
          {processingAction === 'block' ? 'Blocking...' : 'Block User'}
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default FriendsTab;