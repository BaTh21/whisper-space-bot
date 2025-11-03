import { Forward as ForwardIcon } from '@mui/icons-material';
import {
    Avatar,
    Box,
    Button,
    Card,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    ListItem,
    ListItemAvatar,
    ListItemText,
    TextField,
    Typography
} from '@mui/material';
import { useState } from 'react';

const ForwardMessageDialog = ({ open, onClose, message, friends, onForward }) => {
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleFriend = (friendId) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleForward = () => {
    if (selectedFriends.length > 0 && message) {
      onForward(message, selectedFriends);
      setSelectedFriends([]);
      setSearchTerm('');
      onClose();
    }
  };

  const handleCloseDialog = () => {
    setSelectedFriends([]);
    setSearchTerm('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleCloseDialog} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: '16px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ForwardIcon color="primary" />
          <Typography variant="h6" fontWeight="600">Forward Message</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Card 
          sx={{ 
            p: 2, 
            mb: 2, 
            bgcolor: 'grey.50',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1, opacity: 0.8 }}>
            Forwarding:
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            {message?.content}
          </Typography>
          {message?.reply_to && (
            <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
              <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 500 }}>
                Replying to: {message.reply_to.content}
              </Typography>
            </Box>
          )}
        </Card>

        <TextField
          fullWidth
          size="small"
          placeholder="Search friends..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Select friends to forward to:
        </Typography>
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {filteredFriends.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
              No friends found
            </Typography>
          ) : (
            filteredFriends.map((friend) => (
              <ListItem
                key={friend.id}
                sx={{
                  border: '1px solid',
                  borderColor: selectedFriends.includes(friend.id) ? 'primary.main' : 'divider',
                  borderRadius: '12px',
                  mb: 1,
                  bgcolor: selectedFriends.includes(friend.id) ? 'primary.light' : 'background.paper',
                  color: selectedFriends.includes(friend.id) ? 'primary.contrastText' : 'text.primary',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }
                }}
                onClick={() => handleToggleFriend(friend.id)}
                button
              >
                <ListItemAvatar>
                  <Avatar 
                    src={friend.avatar_url}
                    sx={{ width: 40, height: 40 }}
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
                <Checkbox
                  checked={selectedFriends.includes(friend.id)}
                  onChange={() => handleToggleFriend(friend.id)}
                  color="primary"
                />
              </ListItem>
            ))
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={handleCloseDialog}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleForward}
          disabled={selectedFriends.length === 0}
          startIcon={<ForwardIcon />}
        >
          Forward to {selectedFriends.length} {selectedFriends.length === 1 ? 'friend' : 'friends'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForwardMessageDialog;