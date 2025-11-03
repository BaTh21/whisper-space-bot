import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText
} from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { searchUsers, sendFriendRequest } from '../../services/api';

const SearchUsersTab = ({ setError, setSuccess, onDataUpdate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      setError('Search query must be at least 2 characters');
      return;
    }
    setLoading(true);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
      setError(null);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (userId) => {
    try {
      await sendFriendRequest(userId);
      setSuccess('Friend request sent');
      setSearchResults(searchResults.filter(user => user.id !== userId));
      if (onDataUpdate) onDataUpdate();
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
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
          label="Search by username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          disabled={loading}
          sx={{ borderRadius: '8px' }}
        />
        <Button 
          variant="contained" 
          onClick={handleSearch}
          disabled={loading}
          sx={{ borderRadius: '8px' }}
        >
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </Box>

      {searchResults.length === 0 && searchQuery.length >= 2 && (
        <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
          No users found matching "{searchQuery}"
        </Typography>
      )}

      <List>
        {searchResults.map((user) => (
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
              startIcon={<PersonAddIcon />}
              onClick={() => handleSendFriendRequest(user.id)}
              sx={{ borderRadius: '8px' }}
            >
              Add Friend
            </Button>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default SearchUsersTab;