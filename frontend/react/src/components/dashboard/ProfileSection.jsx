import { CloudUpload as CloudUploadIcon, Edit as EditIcon } from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  IconButton,
  TextField,
  Typography
} from '@mui/material';
import { useFormik } from 'formik';
import { useRef, useState } from 'react';
import * as Yup from 'yup';
import { useAvatar } from '../../hooks/useAvatar';
import { updateMe, uploadAvatar } from '../../services/api';

const ProfileSection = ({ profile, setProfile, error, success, setError, setSuccess }) => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Use the avatar hook
  const { getAvatarUrl, getUserInitials } = useAvatar();

  const formik = useFormik({
    initialValues: {
      username: profile?.username || '',
      bio: profile?.bio || '',
    },
    validationSchema: Yup.object({
      username: Yup.string().min(3, 'Username must be at least 3 characters').required('Required'),
      bio: Yup.string().max(500, 'Bio must be less than 500 characters'),
    }),
    enableReinitialize: true,
    onSubmit: async (values) => {
      setError(null);
      setSuccess(null);
      setLoading(true);

      try {
        let avatarUrl = profile?.avatar_url;
        
        if (selectedFile) {
          setUploading(true);
          try {
            const uploadResponse = await uploadAvatar(selectedFile);
            avatarUrl = uploadResponse.avatar_url;
          } catch (uploadError) {
            setError(uploadError.message || 'Failed to upload avatar');
            setLoading(false);
            setUploading(false);
            return;
          }
          setUploading(false);
        }

        const updateData = {
          username: values.username,
          bio: values.bio,
          ...(avatarUrl && { avatar_url: avatarUrl })
        };

        const cleanData = Object.fromEntries(
          Object.entries(updateData).filter(([, value]) => value !== '' && value !== null)
        );

        const response = await updateMe(cleanData);
        setProfile(response);
        setEditing(false);
        setSuccess(selectedFile ? 'Profile and avatar updated successfully!' : 'Profile updated successfully');
        
        setSelectedFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

      } catch (err) {
        setError(err.message || 'Failed to update profile');
      } finally {
        setLoading(false);
      }
    },
  });

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (PNG or JPG only)');
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    setSelectedFile(file);
    setError(null);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const removeSelectedImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setSelectedFile(null);
    setImagePreview(null);
    setError(null);
    formik.resetForm();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Current avatar: preview > formik > profile
  const currentAvatarUrl = imagePreview || getAvatarUrl(profile?.avatar_url);

  return (
    <Card sx={{ mb: 3, p: 3, borderRadius: '16px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Avatar
          src={currentAvatarUrl}
          alt={profile?.username}
          sx={{ 
            width: 80, 
            height: 80, 
            mr: 3,
            border: imagePreview ? '2px solid' : 'none',
            borderColor: imagePreview ? 'primary.main' : 'transparent',
          }}
        >
          {getUserInitials(profile?.username)}
        </Avatar>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" gutterBottom fontWeight="600">
            {profile?.username}
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

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/jpeg,image/jpg,image/png"
        style={{ display: 'none' }}
      />

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
              placeholder="Tell us a bit about yourself..."
            />

            {/* Avatar Upload Section */}
            <Box sx={{ mb: 2, mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom fontWeight="600">
                Profile Picture
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Avatar
                  src={currentAvatarUrl}
                  sx={{
                    width: 60,
                    height: 60,
                    border: imagePreview ? '2px solid' : 'none',
                    borderColor: imagePreview ? 'primary.main' : 'transparent',
                  }}
                >
                  {getUserInitials(profile?.username)}
                </Avatar>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    onClick={handleAvatarClick}
                    disabled={uploading}
                    sx={{ borderRadius: '8px' }}
                  >
                    {uploading ? 'Uploading...' : 'Choose Image'}
                  </Button>
                  {selectedFile && (
                    <Typography variant="caption" color="text.secondary">
                      Selected: {selectedFile.name}
                    </Typography>
                  )}
                  {(selectedFile || imagePreview) && (
                    <Button
                      variant="text"
                      color="error"
                      size="small"
                      onClick={removeSelectedImage}
                      sx={{ borderRadius: '8px' }}
                    >
                      Remove
                    </Button>
                  )}
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Supported formats: PNG, JPG. Max size: 2MB
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={loading || uploading}
                sx={{ borderRadius: '8px', minWidth: 120 }}
              >
                {uploading ? 'Uploading...' : loading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleCancel}
                disabled={loading || uploading}
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