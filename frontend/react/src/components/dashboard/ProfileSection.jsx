//dashboard/ProfileSection.jsx
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
  Typography,
  useMediaQuery,
  useTheme
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

  const theme = useTheme();
  
  // Media query breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));      // 0-599px
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600-899px
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));       // 900px+
  
  // Helper functions for responsive logic
  const getAvatarSize = () => {
    if (isMobile) return 80;
    if (isTablet) return 100;
    return 120; // desktop
  };

  const getAvatarFontSize = () => {
    if (isMobile) return '2rem';
    if (isTablet) return '2.5rem';
    return '3rem'; // desktop
  };

  const getTitleFontSize = () => {
    if (isMobile) return '1.5rem';
    if (isTablet) return '1.75rem';
    return '2.125rem'; // desktop
  };

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
        
        // Upload new avatar if selected
        if (selectedFile) {
          setUploading(true);
          try {
            const uploadResponse = await uploadAvatar(selectedFile);
            avatarUrl = uploadResponse.avatar_url;
            console.log('Avatar uploaded to:', avatarUrl);
          } catch (uploadError) {
            setError(uploadError.message || 'Failed to upload avatar');
            setLoading(false);
            setUploading(false);
            return;
          }
          setUploading(false);
        }

        // Prepare update data
        const updateData = {
          username: values.username,
          bio: values.bio,
          ...(avatarUrl && { avatar_url: avatarUrl })
        };

        // Remove empty values
        const cleanData = Object.fromEntries(
          Object.entries(updateData).filter(([, value]) => value !== '' && value !== null)
        );

        // Update profile
        const response = await updateMe(cleanData);
        setProfile(response);
        setEditing(false);
        setSuccess(selectedFile ? 'Profile and avatar updated successfully!' : 'Profile updated successfully');
        
        // Reset file state
        setSelectedFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Failed to update profile');
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

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setError('Image size must be less than 2MB');
      return;
    }

    // Create preview
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

  // Current avatar display: preview > current profile avatar
  const currentAvatarUrl = imagePreview || getAvatarUrl(profile?.avatar_url);

  return (
    <Card sx={{ 
      mb: 3, 
      p: { xs: 2, sm: 3 }, 
      borderRadius: { xs: '12px', sm: '16px' },
      border: 1,
      borderColor: 'divider',
      bgcolor: 'background.paper',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      {/* Profile Header */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'center', sm: 'flex-start' },
        textAlign: { xs: 'center', sm: 'left' },
        mb: 3,
        position: 'relative',
        gap: { xs: 2, sm: 3 }
      }}>
        {/* Avatar */}
        <Box sx={{ position: 'relative' }}>
          <Avatar
            src={currentAvatarUrl}
            alt={profile?.username}
            sx={{ 
              width: getAvatarSize(), 
              height: getAvatarSize(), 
              border: imagePreview ? '3px solid' : 'none',
              borderColor: imagePreview ? 'primary.main' : 'transparent',
              fontSize: getAvatarFontSize(),
              bgcolor: 'primary.light',
            }}
          >
            {getUserInitials(profile?.username)}
          </Avatar>
        </Box>

        {/* Profile Info */}
        <Box sx={{ 
          flexGrow: 1,
          minWidth: 0 // Prevent text overflow
        }}>
          <Typography 
            variant="h4" 
            gutterBottom 
            fontWeight="600" 
            sx={{ 
              fontSize: getTitleFontSize(),
              lineHeight: 1.2
            }}
          >
            {profile?.username}
          </Typography>
          <Typography 
            variant="body1" 
            color="text.secondary" 
            sx={{ 
              lineHeight: 1.6, 
              mb: 2,
              fontSize: { xs: '0.9rem', sm: '1rem' }
            }}
          >
            {profile?.bio || 'No bio yet.'}
          </Typography>
          <Chip
            label={profile?.is_verified ? 'Verified' : 'Not Verified'}
            color={profile?.is_verified ? 'success' : 'default'}
            size="small"
            sx={{ 
              borderRadius: '8px',
              fontSize: { xs: '0.75rem', sm: '0.875rem' }
            }}
          />
        </Box>
        
        {/* Edit Button */}
        <IconButton 
          onClick={() => setEditing(!editing)}
          sx={{ 
            position: { xs: 'absolute', sm: 'static' },
            top: { xs: 8, sm: 'auto' },
            right: { xs: 8, sm: 'auto' },
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
            width: { xs: 40, sm: 48 },
            height: { xs: 40, sm: 48 },
            flexShrink: 0
          }}
          size={isMobile ? 'small' : 'medium'}
        >
          <EditIcon fontSize={isMobile ? 'small' : 'medium'} />
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

      {/* Alerts */}
      <Collapse in={!!error}>
        <Alert 
          severity="error" 
          sx={{ 
            mb: 2, 
            borderRadius: '12px',
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }} 
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      </Collapse>
      
      <Collapse in={!!success}>
        <Alert 
          severity="success" 
          sx={{ 
            mb: 2, 
            borderRadius: '12px',
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }} 
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      </Collapse>

      {/* Edit Form */}
      <Collapse in={editing}>
        <Card sx={{ 
          p: { xs: 2, sm: 3 }, 
          mt: 2, 
          borderRadius: '12px',
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.default'
        }}>
          <Typography 
            variant="h6" 
            gutterBottom 
            fontWeight="600"
            sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
          >
            Edit Profile
          </Typography>
          
          <Box component="form" onSubmit={formik.handleSubmit}>
            {/* Username Field */}
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
              size={isMobile ? 'small' : 'medium'}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                }
              }}
            />
            
            {/* Bio Field */}
            <TextField
              label="Bio"
              name="bio"
              multiline
              rows={3}
              value={formik.values.bio}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.bio && !!formik.errors.bio}
              helperText={`${formik.values.bio?.length || 0}/500 characters`}
              fullWidth
              margin="normal"
              placeholder="Tell us a bit about yourself..."
              size={isMobile ? 'small' : 'medium'}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                }
              }}
            />

            {/* Avatar Upload Section */}
            <Box sx={{ mb: 2, mt: 3 }}>
              <Typography 
                variant="subtitle2" 
                gutterBottom 
                fontWeight="600"
                sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
              >
                Profile Picture
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'center', sm: 'flex-start' },
                gap: 3, 
                mb: 2 
              }}>
                {/* Avatar Preview */}
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  gap: 1
                }}>
                  <Avatar
                    src={currentAvatarUrl}
                    sx={{
                      width: { xs: 80, sm: 100 },
                      height: { xs: 80, sm: 100 },
                      border: imagePreview ? '3px solid' : 'none',
                      borderColor: imagePreview ? 'primary.main' : 'transparent',
                      fontSize: { xs: '1.5rem', sm: '2rem' },
                    }}
                  >
                    {getUserInitials(profile?.username)}
                  </Avatar>
                  {selectedFile && (
                    <Typography 
                      variant="caption" 
                      color="text.secondary"
                      sx={{ textAlign: 'center' }}
                    >
                      {selectedFile.name}
                    </Typography>
                  )}
                </Box>

                {/* Upload Controls */}
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 2,
                  alignItems: { xs: 'center', sm: 'flex-start' },
                  textAlign: { xs: 'center', sm: 'left' },
                  flexGrow: 1
                }}>
                  <Button
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    onClick={handleAvatarClick}
                    disabled={uploading}
                    sx={{ 
                      borderRadius: '8px',
                      minWidth: { xs: '100%', sm: 160 }
                    }}
                    size={isMobile ? 'small' : 'medium'}
                  >
                    {uploading ? 'Uploading...' : 'Choose Image'}
                  </Button>
                  
                  {(selectedFile || imagePreview) && (
                    <Button
                      variant="text"
                      color="error"
                      size="small"
                      onClick={removeSelectedImage}
                      sx={{ borderRadius: '8px' }}
                    >
                      Remove Image
                    </Button>
                  )}
                </Box>
              </Box>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                Supported formats: PNG, JPG. Max size: 2MB
              </Typography>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2, 
              mt: 4 
            }}>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={loading || uploading}
                sx={{ 
                  borderRadius: '8px', 
                  minWidth: { xs: '100%', sm: 140 },
                  py: { xs: 1, sm: 1.5 },
                  order: { xs: 2, sm: 1 }
                }}
                size={isMobile ? 'small' : 'medium'}
              >
                {uploading ? 'Uploading...' : loading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleCancel}
                disabled={loading || uploading}
                sx={{ 
                  borderRadius: '8px',
                  minWidth: { xs: '100%', sm: 120 },
                  py: { xs: 1, sm: 1.5 },
                  order: { xs: 1, sm: 2 }
                }}
                size={isMobile ? 'small' : 'medium'}
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