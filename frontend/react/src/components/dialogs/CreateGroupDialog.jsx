// components/dialogs/CreateGroupDialog.jsx
import {
    Alert,
    Avatar,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    TextField,
    Typography
} from '@mui/material';
import { useFormik } from 'formik';
import { useState } from 'react';
import * as Yup from 'yup';
import { createGroup, inviteToGroup } from '../../services/api';

const CreateGroupDialog = ({ open, onClose, onSuccess, friends }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
      inviteeIds: []
    },
    validationSchema: Yup.object({
      name: Yup.string().required('Group name is required'),
      description: Yup.string().max(500, 'Description must be less than 500 characters'),
      inviteeIds: Yup.array()
    }),
    onSubmit: async (values) => {
      setLoading(true);
      setError('');

      try {
        // First, create the group
        console.log('Creating group with data:', values);
        const newGroup = await createGroup({
          name: values.name,
          description: values.description
        });

        console.log('Group created successfully:', newGroup);

        // Then, send invitations to selected friends
        if (values.inviteeIds.length > 0) {
          console.log('Sending invitations to friends:', values.inviteeIds);
          const invitePromises = values.inviteeIds.map(friendId =>
            inviteToGroup(newGroup.id, friendId).catch(err => {
              console.warn(`Failed to invite friend ${friendId}:`, err);
              // Continue even if some invites fail
              return null;
            })
          );

          await Promise.all(invitePromises);
          console.log('All invitations sent');
        }

        formik.resetForm();
        onSuccess(newGroup);
        
      } catch (err) {
        console.error('Failed to create group:', err);
        setError(err.message || 'Failed to create group. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  const handleClose = () => {
    formik.resetForm();
    setError('');
    setLoading(false);
    onClose();
  };

  const handleToggleFriend = (friendId) => {
    const currentInvitees = formik.values.inviteeIds;
    const newInvitees = currentInvitees.includes(friendId)
      ? currentInvitees.filter(id => id !== friendId)
      : [...currentInvitees, friendId];
    
    formik.setFieldValue('inviteeIds', newInvitees);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: '16px' }
      }}
    >
      <DialogTitle sx={{ fontWeight: 600 }}>Create New Group</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" sx={{ mt: 1 }}>
          <TextField
            label="Group Name"
            name="name"
            required
            fullWidth
            margin="normal"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && !!formik.errors.name}
            helperText={formik.touched.name && formik.errors.name}
            disabled={loading}
          />
          <TextField
            label="Description"
            name="description"
            multiline
            rows={3}
            fullWidth
            margin="normal"
            value={formik.values.description}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.description && !!formik.errors.description}
            helperText={formik.touched.description && formik.errors.description}
            disabled={loading}
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Invite Friends to Group
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select friends to invite to your new group (optional)
          </Typography>

          {friends.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
              No friends available to invite.
            </Typography>
          ) : (
            <>
              <Box sx={{ mb: 2 }}>
                <Chip 
                  label={`${formik.values.inviteeIds.length} friends selected`}
                  color="primary" 
                  variant="outlined"
                />
              </Box>
              
              <List sx={{ 
                maxHeight: 300, 
                overflow: 'auto', 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: 1 
              }}>
                {friends.map((friend) => (
                  <ListItem
                    key={friend.id}
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' }
                    }}
                    secondaryAction={
                      <Checkbox
                        checked={formik.values.inviteeIds.includes(friend.id)}
                        onChange={() => handleToggleFriend(friend.id)}
                        color="primary"
                        disabled={loading}
                      />
                    }
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
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={formik.handleSubmit}
          disabled={!formik.values.name || loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Creating...' : 'Create Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateGroupDialog;