import { useState } from 'react';
import {
  Card,
  Box,
  Avatar,
  Typography,
  Chip,
  IconButton,
  Collapse,
  TextField,
  Button,
  Alert
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { updateMe } from '../../services/api';

const ProfileSection = ({ profile, setProfile, error, success, setError, setSuccess }) => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      username: profile?.username || '',
      bio: profile?.bio || '',
      avatar_url: profile?.avatar_url || '',
    },
    validationSchema: Yup.object({
      username: Yup.string().min(3, 'Username must be at least 3 characters').required('Required'),
      bio: Yup.string().max(500, 'Bio must be less than 500 characters'),
      avatar_url: Yup.string().url('Must be a valid URL'),
    }),
    enableReinitialize: true,
    onSubmit: async (values) => {
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        const updateData = Object.fromEntries(
          Object.entries(values).filter(([, value]) => value !== '')
        );
        const response = await updateMe(updateData);
        setProfile(response);
        setEditing(false);
        setSuccess('Profile updated successfully');
      } catch (err) {
        setError(err.message || 'Failed to update profile');
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <Card sx={{ mb: 3, p: 3, borderRadius: '16px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Avatar
          src={profile?.avatar_url}
          alt={profile?.username}
          sx={{ width: 80, height: 80, mr: 3 }}
          imgProps={{ 
            onError: (e) => { 
              e.target.style.display = 'none';
            } 
          }}
        />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" gutterBottom fontWeight="600">
            Welcome back, {profile?.username}!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {profile?.bio || 'No bio yet.'}
          </Typography>
          <Chip
            label={profile?.is_verified ? 'Verified' : 'Not Verified'}
            color={profile?.is_verified ? 'success' : 'default'}
            size="small"
            sx={{ mt: 1, borderRadius: '8px' }}
          />
        </Box>
        <IconButton onClick={() => setEditing(!editing)}>
          <EditIcon />
        </IconButton>
      </Box>

      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      </Collapse>
      <Collapse in={!!success}>
        <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Collapse>

      <Collapse in={editing}>
        <Card sx={{ p: 3, mt: 2, borderRadius: '12px' }}>
          <Typography variant="h6" gutterBottom fontWeight="600">
            Edit Profile
          </Typography>
          <Box component="form" onSubmit={formik.handleSubmit}>
            <TextField
              label="Username"
              name="username"
              value={formik.values.username}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.username && !!formik.errors.username}
              helperText={formik.touched.username && formik.errors.username}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Bio"
              name="bio"
              multiline
              rows={3}
              value={formik.values.bio}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.bio && !!formik.errors.bio}
              helperText={formik.touched.bio && formik.errors.bio}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Avatar URL"
              name="avatar_url"
              value={formik.values.avatar_url}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.avatar_url && !!formik.errors.avatar_url}
              helperText={formik.touched.avatar_url && formik.errors.avatar_url}
              fullWidth
              margin="normal"
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={loading}
                sx={{ borderRadius: '8px' }}
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setEditing(false);
                  formik.resetForm();
                }}
                sx={{ borderRadius: '8px' }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        </Card>
      </Collapse>
    </Card>
  );
};

export default ProfileSection;