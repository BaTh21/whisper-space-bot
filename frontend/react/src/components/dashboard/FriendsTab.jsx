// components/dashboard/FriendsTab.jsx
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
  Typography
} from '@mui/material';
import { useState } from 'react';
import { acceptFriendRequest } from '../../services/api';

const FriendsTab = ({ 
  friends, 
  pendingRequests, 
  setActiveTab, 
  setError, 
  setSuccess, 
  onDataUpdate 
}) => {
  const [acceptingId, setAcceptingId] = useState(null);

  const handleAcceptRequest = async (requesterId) => {
    setAcceptingId(requesterId);
    try {
      await acceptFriendRequest(requesterId);
      setSuccess('Friend request accepted successfully!');
      onDataUpdate(); // Refresh the data
    } catch (err) {
      console.error('Accept request failed:', err);
      setError(err.message || 'Failed to accept friend request');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleMessageFriend = (friend) => {
    console.log('Message button clicked for friend:', friend);
    
    if (typeof setActiveTab === 'function') {
      // Store the selected friend for MessagesTab to use
      localStorage.setItem('selectedFriend', JSON.stringify(friend));
      
      // Switch to Messages tab (index 1)
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
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleMessageFriend(friend)}
                sx={{ borderRadius: '8px' }}
              >
                Message
              </Button>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default FriendsTab;