import { Close, Group, Link, Lock, Public } from '@mui/icons-material';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Radio,
    RadioGroup,
    Switch,
    TextField,
    Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import { getFriends } from '../services/api';

const ShareDialog = ({ open, note, onClose, onShare }) => {
  const [shareType, setShareType] = useState('private');
  const [friendIds, setFriendIds] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [expires, setExpires] = useState(false);
  const [expireHours, setExpireHours] = useState(24);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadFriends = async () => {
      if (open) {
        setLoading(true);
        try {
          // Fetch real friends from your API
          const friendsData = await getFriends();
          console.log('Loaded friends:', friendsData);
          setFriends(friendsData);
        } catch (error) {
          console.error('Error loading friends:', error);
          // Fallback to empty array if API fails
          setFriends([]);
        } finally {
          setLoading(false);
        }
        
        // Initialize with note's current sharing settings
        if (note) {
          setShareType(note.share_type || 'private');
          setFriendIds(note.shared_with || []);
          setCanEdit(note.can_edit || false);
        } else {
          // Reset for new note
          setShareType('private');
          setFriendIds([]);
          setCanEdit(false);
        }
      }
    };

    loadFriends();
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
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : friends.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                No friends found. Add friends to share notes with them.
              </Typography>
            ) : (
              <>
                <List sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  {friends.map(friend => (
                    <ListItem 
                      key={friend.id}
                      onClick={() => handleFriendToggle(friend.id)}
                      selected={friendIds.includes(friend.id)}
                      sx={{
                        '&.Mui-selected': {
                          backgroundColor: 'primary.light',
                          '&:hover': {
                            backgroundColor: 'primary.light',
                          }
                        }
                      }}
                    >
                      <ListItemIcon>
                        <Group />
                      </ListItemIcon>
                      <ListItemText 
                        primary={friend.username || friend.name || friend.email}
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
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      {friendIds.map(friendId => {
                        const friend = friends.find(f => f.id === friendId);
                        return friend ? (
                          <Chip
                            key={friend.id}
                            label={friend.username || friend.name || friend.email}
                            size="small"
                            onDelete={() => handleFriendToggle(friend.id)}
                          />
                        ) : null;
                      })}
                    </Box>
                  </Box>
                )}
              </>
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