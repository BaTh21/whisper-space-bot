import {
  Forward as ForwardIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from '@mui/material';
import { useState } from 'react';

const ForwardMessageDialog = ({
  open,
  onClose,
  message,
  friends,
  onForward,
  getAvatarUrl,
  getUserInitials
}) => {
  const [selectedFriends, setSelectedFriends] = useState([]);

  const toggleFriend = (friend) => {
    setSelectedFriends(prev => {
      const exists = prev.some(f => f.id === friend.id);
      if (exists) {
        return prev.filter(f => f.id !== friend.id);
      }
      return [...prev, friend];
    });
  };

  const handleForward = () => {
    if (selectedFriends.length && onForward && message) {
      onForward(message, selectedFriends);
      setSelectedFriends([]);
      onClose();
    }
  };

  const handleCloseDialog = () => {
    setSelectedFriends([]);
    onClose();
  };

  // Message preview
  const getMessagePreview = (msg) => {
    if (!msg) return '';

    if (
      msg.content.match(/\.(mp4|mp3|wav|m4a|ogg|aac|flac)$/i) ||
      msg.content.includes('voice_messages')
    ) {
      return '🎤 Voice message';
    }

    if (
      msg.content.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)
    ) {
      return '🖼️ Image';
    }

    return msg.content;
  };

  return (
    <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ForwardIcon color="primary" />
          <Typography variant="h6" fontWeight="600">
            Forward Message
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Message Preview */}
        {message && (
          <Box
            sx={{
              p: 2,
              mb: 2,
              bgcolor: 'grey.50',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'grey.200',
            }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Forwarding:
            </Typography>
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
              {getMessagePreview(message)}
            </Typography>
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Select friends to forward to:
        </Typography>

        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {friends.map(friend => {
            const selected = selectedFriends.some(f => f.id === friend.id);

            return (
              <ListItem
                key={friend.id}
                onClick={() => toggleFriend(friend)}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 2,
                  mb: 1,
                  bgcolor: selected ? 'primary.light' : 'transparent',
                  '&:hover': {
                    bgcolor: selected ? 'primary.light' : 'action.hover',
                  },
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    src={getAvatarUrl(friend.avatar_url || friend.avatar)}
                    sx={{ width: 40, height: 40 }}
                  >
                    {getUserInitials(friend.username)}
                  </Avatar>
                </ListItemAvatar>

                <ListItemText
                  primary={
                    <Typography fontWeight={selected ? 600 : 500}>
                      {friend.username}
                    </Typography>
                  }
                  secondary={friend.email}
                />
              </ListItem>
            );
          })}

          {friends.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No friends available
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleCloseDialog} variant="outlined">
          Cancel
        </Button>

        <Button
          onClick={handleForward}
          variant="contained"
          disabled={!selectedFriends.length}
          startIcon={<ForwardIcon />}
        >
          Forward {selectedFriends.length || ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForwardMessageDialog;
