//dashboard/SearchUsersTab.jsx
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
  Typography,
  useMediaQuery,
  useTheme
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
  const [failedImages, setFailedImages] = useState(new Set());

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Function to get full avatar URL
  const getAvatarUrl = (url) => {
    if (!url) {
      console.log('No avatar URL provided');
      return null;
    }

    if (failedImages.has(url)) {
      console.log('Avatar URL previously failed:', url);
      return null;
    }

    // If it's already a full URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      console.log('Using full avatar URL:', url);
      return url;
    }

    // For relative paths, construct full URL to your backend
    const baseUrl = 'http://localhost:8000'; // Your FastAPI server
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = `${baseUrl}${cleanUrl}`;
    console.log('Constructed avatar URL:', fullUrl);
    return fullUrl;
  };

  const handleImageError = (userId, url) => {
    console.log(`Avatar failed to load for user ${userId}:`, url);
    setFailedImages(prev => new Set([...prev, url]));
  };

  const handleImageLoad = (userId, url) => {
    console.log(`Avatar loaded successfully for user ${userId}:`, url);
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      setError('Search query must be at least 2 characters');
      return;
    }
    
    setLoading(true);
    try {
      const results = await searchUsers(searchQuery.trim());
      console.log('🔍 Search results received:', results);
      
      // Debug: Check avatar URLs in results
      results.forEach(user => {
        console.log(`👤 User ${user.username}: avatar_url =`, user.avatar_url);
      });
      
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
      
      if (result.success) {
        if (result.code === 'ALREADY_EXISTS') {
          setSuccess(result.message || 'Friend request already sent');
        } else {
          setSuccess(result.message || 'Friend request sent successfully');
        }
        
        setSearchResults(prev => prev.filter(u => u.id !== user.id));
        if (onDataUpdate) onDataUpdate();
      } else {
        setError(result.message || 'Failed to send friend request');
      }
      
    } catch (err) {
      console.error('Send request failed:', err);
      setError(err.message || 'An unexpected error occurred');
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
    <Box sx={{ 
      p: { xs: 2, sm: 3 },
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      <Typography variant="h5" gutterBottom fontWeight="600">
        Search Users
      </Typography>
      
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1, 
        mb: 3 
      }}>
        <TextField
          fullWidth
          label="Search by username or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          disabled={loading}
          sx={{ borderRadius: '8px' }}
          size={isMobile ? 'small' : 'medium'}
        />
        <Button 
          variant="contained" 
          onClick={handleSearch}
          disabled={loading || searchQuery.trim().length < 2}
          sx={{ 
            borderRadius: '8px', 
            minWidth: { xs: '100%', sm: 120 },
            height: { xs: '40px', sm: '56px' }
          }}
          size={isMobile ? 'small' : 'medium'}
        >
          {loading ? <CircularProgress size={20} /> : 'Search'}
        </Button>
      </Box>

      {searchResults.length === 0 && searchQuery.trim().length >= 2 && !loading && (
        <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
          No users found matching "{searchQuery}"
        </Typography>
      )}

      <List sx={{ p: 0 }}>
        {searchResults.map((user) => {
          const showAddButton = shouldShowAddButton(user);
          const statusText = getUserStatusText(user);
          const isSending = sendingRequests.has(user.id);
          const avatarUrl = getAvatarUrl(user.avatar_url);

          console.log(`🎨 Rendering user ${user.username}:`, {
            avatarUrl,
            hasAvatarUrl: !!user.avatar_url,
            showAddButton
          });

          return (
            <ListItem
              key={user.id}
              sx={{
                p: { xs: 1.5, sm: 2 },
                mb: 1,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
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
                mb: { xs: 2, sm: 0 }
              }}>
                <ListItemAvatar sx={{ minWidth: { xs: 40, sm: 48 } }}>
                  <Avatar 
                    src={avatarUrl}
                    sx={{ width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 } }}
                    imgProps={{
                      onError: () => handleImageError(user.id, user.avatar_url),
                      onLoad: () => handleImageLoad(user.id, user.avatar_url),
                    }}
                  >
                    {user.username?.charAt(0)?.toUpperCase() || 'U'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body1" fontWeight="500" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                      {user.username}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                      {user.email}
                    </Typography>
                  }
                  sx={{ my: 0 }}
                />
              </Box>
              
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
                  sx={{ 
                    borderRadius: '8px', 
                    minWidth: { xs: '100%', sm: 120 },
                    mt: { xs: 1, sm: 0 }
                  }}
                >
                  {isMobile ? 'Add' : statusText}
                </Button>
              ) : (
                <Chip 
                  label={isMobile ? statusText.replace('Request Sent', 'Sent') : statusText} 
                  color={getStatusColor(statusText)}
                  variant="outlined"
                  size="small"
                  sx={{ 
                    mt: { xs: 1, sm: 0 },
                    alignSelf: { xs: 'center', sm: 'auto' }
                  }}
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