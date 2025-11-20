import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Box,
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
    if (selectedFriend && onForward) {
      onForward(message, selectedFriend);
      setSelectedFriend(null);
      onClose();
    }
  };

  const handleSelectFriend = (friend) => {
    setSelectedFriend(friend);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" fontWeight="600">
          Forward Message
        </Typography>
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
              {message.content}
            </Typography>
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Select a friend to forward to:
        </Typography>

        <List sx={{ maxHeight: 300, overflow: 'auto' }}>
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
                  color: 'primary.contrastText',
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
        </List>

        {friends.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No friends available to forward to
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleForward}
          variant="contained"
          disabled={!selectedFriend}
        >
          Forward
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForwardMessageDialog;