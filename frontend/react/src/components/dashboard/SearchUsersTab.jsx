import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
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
  TextField,
  Typography
} from '@mui/material';
import { useState } from 'react';
import { searchUsers, sendFriendRequest } from '../../services/api';

const SearchUsersTab = ({ 
  setError, 
  setSuccess, 
  onDataUpdate, 
  friends = [], 
  pendingRequests = [], 
  currentUser 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingRequests, setSendingRequests] = useState(new Set());

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

    setSendingRequests(prev => new Set(prev).add(user.id));
    
    try {
      const result = await sendFriendRequest(user.id);
      
      if (result.alreadyExists) {
        setSuccess(result.message || 'Friend request already sent');
      } else {
        setSuccess(result.msg || result.message || 'Friend request sent successfully');
      }
      
      // Remove user from search results after sending request
      setSearchResults(prev => prev.filter(u => u.id !== user.id));
      
      if (onDataUpdate) onDataUpdate();
      
    } catch (err) {
      console.error('Send request failed:', err);
      setError(err.message);
    } finally {
      setSendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(user.id);
        return newSet;
      });
    }
  };

  const shouldShowAddButton = (user) => {
    if (!currentUser) return false;
    
    const isCurrentUser = user.id === currentUser.id;
    const isAlreadyFriend = friends.some(friend => friend.id === user.id);
    const hasPendingRequest = pendingRequests.some(request => request.id === user.id);
    const isSending = sendingRequests.has(user.id);

    return !isCurrentUser && !isAlreadyFriend && !hasPendingRequest && !isSending;
  };

  const getUserStatusText = (user) => {
    if (!currentUser) return 'Add Friend';
    
    const isCurrentUser = user.id === currentUser.id;
    const isAlreadyFriend = friends.some(friend => friend.id === user.id);
    const hasPendingRequest = pendingRequests.some(request => request.id === user.id);
    const isSending = sendingRequests.has(user.id);

    if (isCurrentUser) return 'You';
    if (isAlreadyFriend) return 'Friends';
    if (hasPendingRequest) return 'Request Sent';
    if (isSending) return 'Sending...';
    return 'Add Friend';
  };

  const getStatusColor = (statusText) => {
    switch (statusText) {
      case 'Friends': return 'success';
      case 'Request Sent': return 'warning';
      case 'You': return 'default';
      default: return 'default';
    }
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
          const showAddButton = shouldShowAddButton(user);
          const statusText = getUserStatusText(user);
          const isSending = sendingRequests.has(user.id);

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
              
              {showAddButton ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={
                    isSending ? 
                      <CircularProgress size={16} /> : 
                      <PersonAddIcon />
                  }
                  onClick={() => handleSendFriendRequest(user)}
                  disabled={isSending}
                  sx={{ borderRadius: '8px', minWidth: 120 }}
                >
                  {statusText}
                </Button>
              ) : (
                <Chip 
                  label={statusText} 
                  color={getStatusColor(statusText)}
                  variant="outlined"
                  size="small"
                />
              )}
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default SearchUsersTab;