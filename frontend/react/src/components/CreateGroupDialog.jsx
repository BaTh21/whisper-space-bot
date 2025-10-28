import {
  Alert,
  Autocomplete,
  Avatar,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '@mui/material';
import { useState } from 'react';
import { createGroup } from '../services/api';

export default function CreateGroupDialog({ open, onClose, onSuccess, friends }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      // Prepare the data with invited friend IDs
      const groupData = {
        name: name.trim(),
        description: description.trim(),
        invite_user_ids: selectedFriends.map(friend => friend.id)
      };

      // Create group with invitations
      const newGroup = await createGroup(groupData);

      // Success - reset form and close
      onSuccess(newGroup);
      setName('');
      setDescription('');
      setSelectedFriends([]);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Group</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          label="Group Name"
          fullWidth
          margin="normal"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
        <TextField
          label="Description (optional)"
          fullWidth
          multiline
          rows={2}
          margin="normal"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <Autocomplete
          multiple
          options={friends || []}
          getOptionLabel={opt => opt.username}
          value={selectedFriends}
          onChange={(_, v) => setSelectedFriends(v)}
          renderTags={(value, getTagProps) =>
            value.map((opt, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip
                  key={key}  // Pass key directly here
                  avatar={<Avatar src={opt.avatar_url}>{opt.username[0]}</Avatar>}
                  label={opt.username}
                  {...tagProps}  // Spread the rest of the props without key
                />
              );
            })
          }
          renderInput={params => (
            <TextField
              {...params}
              label="Invite Friends"
              placeholder="Search friends..."
              margin="normal"
            />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!name.trim() || loading}
        >
          {loading ? 'Creating…' : 'Create Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}