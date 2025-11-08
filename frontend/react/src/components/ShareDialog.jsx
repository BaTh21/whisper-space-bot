import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Chip,
  Box,
  Typography,
  IconButton,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import { Close, Link, Email, Group, Public, Lock } from '@mui/icons-material';
import { useState, useEffect } from 'react';

const ShareDialog = ({ open, note, onClose, onShare }) => {
  const [shareType, setShareType] = useState('private');
  const [friendIds, setFriendIds] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [expires, setExpires] = useState(false);
  const [expireHours, setExpireHours] = useState(24);
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    // Mock friends data - replace with actual API call
    const mockFriends = [
      { id: 2, name: "John Doe", email: "john@example.com" },
      { id: 3, name: "Jane Smith", email: "jane@example.com" },
      { id: 4, name: "Mike Johnson", email: "mike@example.com" },
    ];
    setFriends(mockFriends);
    
    // Initialize with note's current sharing settings
    if (note) {
      setShareType(note.share_type || 'private');
      setFriendIds(note.shared_with || []);
      setCanEdit(note.can_edit || false);
    }
  }, [note, open]);

  const handleFriendToggle = (friendId) => {
    setFriendIds(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleShare = () => {
    const shareData = {
      share_type: shareType,
      friend_ids: shareType === 'shared' ? friendIds : [],
      can_edit: canEdit,
      expires_in_hours: shareType === 'public' && expires ? expireHours : null
    };
    onShare(shareData);
  };

  const shareLink = shareType === 'public' && note?.share_token 
    ? `${window.location.origin}/notes/public/${note.share_token}`
    : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          Share Note
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <FormControl component="fieldset" sx={{ width: '100%', mb: 3 }}>
          <FormLabel component="legend">Sharing Options</FormLabel>
          <RadioGroup value={shareType} onChange={(e) => setShareType(e.target.value)}>
            <FormControlLabel 
              value="private" 
              control={<Radio />} 
              label={
                <Box display="flex" alignItems="center">
                  <Lock sx={{ mr: 1, fontSize: 20 }} />
                  <Box>
                    <Typography>Private</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Only you can access this note
                    </Typography>
                  </Box>
                </Box>
              } 
            />
            <FormControlLabel 
              value="shared" 
              control={<Radio />} 
              label={
                <Box display="flex" alignItems="center">
                  <Group sx={{ mr: 1, fontSize: 20 }} />
                  <Box>
                    <Typography>Shared with Friends</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Share with specific friends
                    </Typography>
                  </Box>
                </Box>
              } 
            />
            <FormControlLabel 
              value="public" 
              control={<Radio />} 
              label={
                <Box display="flex" alignItems="center">
                  <Public sx={{ mr: 1, fontSize: 20 }} />
                  <Box>
                    <Typography>Public</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Anyone with the link can view
                    </Typography>
                  </Box>
                </Box>
              } 
            />
          </RadioGroup>
        </FormControl>

        {shareType === 'shared' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Select Friends:
            </Typography>
            <List sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {friends.map(friend => (
                <ListItem 
                  key={friend.id}
                  onClick={() => handleFriendToggle(friend.id)}
                  selected={friendIds.includes(friend.id)}
                >
                  <ListItemIcon>
                    <Group />
                  </ListItemIcon>
                  <ListItemText 
                    primary={friend.name}
                    secondary={friend.email}
                  />
                </ListItem>
              ))}
            </List>
            
            {friendIds.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Sharing with: {friendIds.length} friend{friendIds.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {shareType === 'public' && (
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={expires}
                  onChange={(e) => setExpires(e.target.checked)}
                />
              }
              label="Set link expiration"
            />
            {expires && (
              <TextField
                fullWidth
                type="number"
                label="Expires after (hours)"
                value={expireHours}
                onChange={(e) => setExpireHours(parseInt(e.target.value))}
                sx={{ mt: 1 }}
              />
            )}
            
            {shareLink && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Shareable Link:
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Link color="primary" />
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {shareLink}
                  </Typography>
                  <Button 
                    size="small" 
                    onClick={() => navigator.clipboard.writeText(shareLink)}
                  >
                    Copy
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {(shareType === 'shared' || shareType === 'public') && (
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={canEdit}
                  onChange={(e) => setCanEdit(e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography>Allow editing</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {shareType === 'shared' ? 'Friends can modify this note' : 'Public users can modify this note'}
                  </Typography>
                </Box>
              }
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleShare}
          disabled={shareType === 'shared' && friendIds.length === 0}
        >
          Apply Sharing
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareDialog;