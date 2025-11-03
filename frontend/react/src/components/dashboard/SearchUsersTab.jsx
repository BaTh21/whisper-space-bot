import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography
} from '@mui/material';
import { useState } from 'react';
import { searchUsers, sendFriendRequest } from '../../services/api';

const SearchUsersTab = ({ setError, setSuccess, onDataUpdate, friends = [], pendingRequests = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingRequests, setSendingRequests] = useState(new Set()); // Track multiple requests

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      setError('Search query must be at least 2 characters');
      return;
    }
    
    setLoading(true);
    try {
      const results = await searchUsers(searchQuery.trim());
      setSearchResults(results);
      setError(null);
    } catch (err) {
      setError(err.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

const handleSendFriendRequest = async (user) => {
  if (sendingRequests.has(user.id)) return;

  console.log('👤 Checking user status:', {
    user: user.username,
    userId: user.id,
    friends: friends.map(f => ({ id: f.id, username: f.username })),
    pendingRequests: pendingRequests
  });

  // Check if already friends
  const isAlreadyFriend = friends.some(friend => friend.id === user.id);
  if (isAlreadyFriend) {
    setError(`You are already friends with ${user.username}`);
    return;
  }

  // Check if pending request exists
  const hasPendingRequest = pendingRequests.some(request => request.id === user.id);
  if (hasPendingRequest) {
    setError(`Friend request already pending with ${user.username}`);
    return;
  }

  setSendingRequests(prev => new Set(prev).add(user.id));
  
  try {
    console.log('📤 Sending friend request to:', user.id);
    const result = await sendFriendRequest(user.id);
    console.log('✅ Request result:', result);
    
    // Handle both success and "already exists" cases
    if (result.alreadyExists) {
      setSuccess(result.message || 'Friend request already sent');
      // Remove user from search results since request already exists
      setSearchResults(prev => prev.filter(u => u.id !== user.id));
    } else {
      setSuccess(result.msg || result.message || 'Friend request sent successfully');
      // Remove user from search results after successful request
      setSearchResults(prev => prev.filter(u => u.id !== user.id));
    }
    
    if (onDataUpdate) onDataUpdate();
    
  } catch (err) {
    console.error('❌ Send request failed:', err);
    setError(err.message);
  } finally {
    setSendingRequests(prev => {
      const newSet = new Set(prev);
      newSet.delete(user.id);
      return newSet;
    });
  }
};

  const getButtonState = (user) => {
  const isAlreadyFriend = friends.some(friend => friend.id === user.id);
  const hasPendingRequest = pendingRequests.some(request => request.id === user.id);
  const isSending = sendingRequests.has(user.id);

  if (isAlreadyFriend) {
    return { disabled: true, text: 'Already Friends' };
  }
  if (hasPendingRequest) {
    return { disabled: true, text: 'Request Pending' };
  }
  if (isSending) {
    return { disabled: true, text: 'Sending...' };
  }
  return { disabled: false, text: 'Add Friend' };
};

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom fontWeight="600">
        Search Users
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField
          fullWidth
          label="Search by username or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          disabled={loading}
          sx={{ borderRadius: '8px' }}
        />
        <Button 
          variant="contained" 
          onClick={handleSearch}
          disabled={loading || searchQuery.trim().length < 2}
          sx={{ borderRadius: '8px', minWidth: 120 }}
        >
          {loading ? <CircularProgress size={20} /> : 'Search'}
        </Button>
      </Box>

      {searchResults.length === 0 && searchQuery.trim().length >= 2 && !loading && (
        <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
          No users found matching "{searchQuery}"
        </Typography>
      )}

      <List>
        {searchResults.map((user) => {
          const buttonState = getButtonState(user);
          
          return (
            <ListItem
              key={user.id}
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
                  src={user.avatar_url} 
                  sx={{ width: 48, height: 48 }}
                  imgProps={{ 
                    onError: (e) => { 
                      e.target.style.display = 'none';
                    } 
                  }}
                >
                  {user.username?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="body1" fontWeight="500">
                    {user.username}
                  </Typography>
                }
                secondary={user.email}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={
                  buttonState.text === 'Sending...' ? 
                    <CircularProgress size={16} /> : 
                    <PersonAddIcon />
                }
                onClick={() => handleSendFriendRequest(user)}
                disabled={buttonState.disabled}
                sx={{ borderRadius: '8px', minWidth: 120 }}
              >
                {buttonState.text}
              </Button>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default SearchUsersTab;