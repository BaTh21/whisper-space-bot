import {
  Avatar,
  Box,
  Button,
  Card,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import { MoreVert as MoreVertIcon, Block as BlockIcon } from '@mui/icons-material';
import { useState } from 'react';
import { acceptFriendRequest, unfriend, blockUser } from '../../services/api';

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
    } else {
      console.error('setActiveTab is not a function');
      setError('Cannot open messages. Please try again.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom fontWeight="600">
        Friends
      </Typography>

      {pendingRequests.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom color="primary" fontWeight="600">
            Pending Requests ({pendingRequests.length})
          </Typography>
          {pendingRequests.map((request) => (
            <Card 
              key={request.id} 
              sx={{ 
                p: 2, 
                mb: 1, 
                display: 'flex', 
                alignItems: 'center',
                borderRadius: '12px'
              }}
            >
              <Avatar 
                src={request.avatar_url} 
                sx={{ mr: 2, width: 48, height: 48 }}
                imgProps={{ 
                  onError: (e) => { 
                    e.target.style.display = 'none';
                  } 
                }}
              >
                {request.username?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body1" fontWeight="500">{request.username}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {request.email}
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleAcceptRequest(request.id)}
                disabled={acceptingId === request.id}
                sx={{ borderRadius: '8px', minWidth: 100 }}
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

      <Typography variant="h6" gutterBottom fontWeight="600">
        Your Friends ({friends.length})
      </Typography>
      {friends.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No friends yet. Search for users to add friends!
        </Typography>
      ) : (
        <List>
          {friends.map((friend) => (
            <ListItem
              key={friend.id}
              sx={{
                p: 2,
                mb: 1,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }
              }}
            >
              <ListItemAvatar>
                <Avatar 
                  src={friend.avatar_url} 
                  sx={{ width: 48, height: 48 }}
                  imgProps={{ 
                    onError: (e) => { 
                      e.target.style.display = 'none';
                    } 
                  }}
                >
                  {friend.username?.charAt(0)?.toUpperCase() || 'F'}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="body1" fontWeight="500">
                    {friend.username}
                  </Typography>
                }
                secondary={friend.email}
              />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleMessageFriend(friend)}
                  sx={{ borderRadius: '8px' }}
                >
                  Message
                </Button>
                <IconButton
                  onClick={(e) => handleActionMenuOpen(e, friend)}
                  disabled={processingAction === friend.id}
                  sx={{ borderRadius: '8px' }}
                >
                  {processingAction === friend.id ? (
                    <CircularProgress size={20} />
                  ) : (
                    <MoreVertIcon />
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
          sx: { borderRadius: '8px' }
        }}
      >
        <MenuItem 
          onClick={handleUnfriend}
          disabled={processingAction === 'unfriend'}
          sx={{ color: 'error.main' }}
        >
          {processingAction === 'unfriend' ? 'Unfriending...' : 'Unfriend'}
        </MenuItem>
        <MenuItem 
          onClick={handleBlock}
          disabled={processingAction === 'block'}
          sx={{ color: 'error.main' }}
        >
          <BlockIcon sx={{ mr: 1, fontSize: 20 }} />
          {processingAction === 'block' ? 'Blocking...' : 'Block User'}
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default FriendsTab;