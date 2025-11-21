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
  const [selectedFriend, setSelectedFriend] = useState(null);

  const handleForward = () => {
    if (selectedFriend && onForward && message) {
      onForward(message, selectedFriend);
      setSelectedFriend(null);
      onClose();
    }
  };

  const handleSelectFriend = (friend) => {
    setSelectedFriend(friend);
  };

  const handleCloseDialog = () => {
    setSelectedFriend(null);
    onClose();
  };

  // Determine message type for display
  const getMessagePreview = (msg) => {
    if (!msg) return '';
    
    if (msg.content.match(/\.(mp4|mp3|wav|m4a|ogg|aac|flac)$/i) || 
        msg.content.includes('voice_messages') ||
        msg.content.includes('audio')) {
      return '🎤 Voice message';
    }
    else if (msg.content.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i) ||
             msg.content.includes('images') ||
             msg.content.includes('photos')) {
      return '🖼️ Image';
    }
    else {
      return msg.content;
    }
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
              borderRadius: '8px',
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
            {message.reply_to && (
              <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                <Typography variant="caption" color="text.secondary">
                  Replying to: {message.reply_to.content}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Select a friend to forward to:
        </Typography>

        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {friends.map((friend) => (
            <ListItem
              key={friend.id}
              button
              selected={selectedFriend?.id === friend.id}
              onClick={() => handleSelectFriend(friend)}
              sx={{
                borderRadius: '8px',
                mb: 1,
                '&.Mui-selected': {
                  bgcolor: 'primary.light',
                  '&:hover': {
                    bgcolor: 'primary.light',
                  },
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
                  <Typography fontWeight="500">
                    {friend.username}
                  </Typography>
                }
                secondary={friend.email}
              />
            </ListItem>
          ))}

          {friends.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No friends available to forward to
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
          disabled={!selectedFriend}
          startIcon={<ForwardIcon />}
        >
          Forward
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForwardMessageDialog;