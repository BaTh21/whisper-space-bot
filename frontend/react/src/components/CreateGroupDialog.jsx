// components/CreateGroupDialog.jsx
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createGroup } from '../services/api';

const CreateGroupDialog = ({ 
  open, 
  onClose, 
  onSuccess, 
  setError, 
  friends = [] // Make sure friends prop is passed
}) => {
  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
      invited_friends: [], // This should store friend IDs
    },
    validationSchema: Yup.object({
      name: Yup.string().required('Group name is required'),
      description: Yup.string().max(500, 'Description too long'),
      invited_friends: Yup.array(),
    }),
    onSubmit: async (values, { resetForm }) => {
      try {
        console.log('Creating group with:', values);
        
        const groupData = {
          name: values.name,
          description: values.description,
          invited_user_ids: values.invited_friends, // Send friend IDs to backend
        };

        const newGroup = await createGroup(groupData);
        console.log('Group created:', newGroup);
        
        onSuccess(newGroup);
        resetForm();
        setError(null);
      } catch (err) {
        console.error('Create group error:', err);
        setError(err.message || 'Failed to create group');
      }
    },
  });

  const handleClose = () => {
    formik.resetForm();
    onClose();
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
      <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
        Create New Group
      </DialogTitle>
      
      <DialogContent>
        <Box component="form" sx={{ mt: 1 }}>
          {/* Group Name */}
          <TextField
            label="Group Name *"
            name="name"
            fullWidth
            margin="normal"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && !!formik.errors.name}
            helperText={formik.touched.name && formik.errors.name}
            InputProps={{
              sx: { borderRadius: '8px' }
            }}
          />

          {/* Group Description */}
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
            InputProps={{
              sx: { borderRadius: '8px' }
            }}
          />

          {/* Friend Invitation Section */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Invite Friends to Group</InputLabel>
            <Select
              multiple
              name="invited_friends"
              value={formik.values.invited_friends}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((friendId) => {
                    const friend = friends.find(f => f.id === friendId);
                    return (
                      <Chip 
                        key={friendId}
                        label={friend?.username || 'Unknown'} 
                        size="small"
                        sx={{ borderRadius: '6px' }}
                      />
                    );
                  })}
                </Box>
              )}
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 300,
                  }
                }
              }}
            >
              {friends.length === 0 ? (
                <MenuItem disabled>
                  <Typography color="text.secondary">
                    No friends available to invite
                  </Typography>
                </MenuItem>
              ) : (
                friends.map((friend) => (
                  <MenuItem key={friend.id} value={friend.id}>
                    <Checkbox 
                      checked={formik.values.invited_friends.includes(friend.id)} 
                    />
                    <ListItemAvatar>
                      <Avatar 
                        src={friend.avatar_url}
                        sx={{ width: 32, height: 32, mr: 2 }}
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
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {/* Selected Friends Count */}
          {formik.values.invited_friends.length > 0 && (
            <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
              {formik.values.invited_friends.length} friend(s) selected for invitation
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button 
          onClick={handleClose}
          sx={{ borderRadius: '8px' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={formik.handleSubmit}
          disabled={!formik.isValid || formik.isSubmitting}
          sx={{ borderRadius: '8px' }}
        >
          Create Group
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateGroupDialog;