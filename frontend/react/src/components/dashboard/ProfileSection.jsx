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
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';

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
    <Card
      sx={{
        mb: 3,
        p: { xs: 2, sm: 3 },
        borderRadius: { xs: '12px', sm: '16px' },
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        // textAlign: 'center',
      }}
    >
      {/* Profile Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' }, // stack avatar and info vertically
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          width: '100%',
          maxWidth: 500,
        }}
      >
        {/* Clickable Avatar */}
        <Box
          sx={{
            position: 'relative',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={handleAvatarClick}
        >
          <Avatar
            src={currentAvatarUrl}
            alt={profile?.username}
            sx={{
              width: 200,
              height: 200,
              border: imagePreview ? '3px solid' : 'none',
              borderColor: imagePreview ? 'primary.main' : 'transparent',
              fontSize: getAvatarFontSize(),
              bgcolor: 'primary.light',
              borderRadius: 3,
            }}
          >
            {getUserInitials(profile?.username)}
          </Avatar>
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              bgcolor: 'primary.main',
              borderRadius: '50%',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 14,
              p: 2
            }}
          >
            <CameraswitchIcon sx={{fontSize: 20}}/>
          </Box>
        </Box>

        {/* Editable Profile Info */}
        <Box sx={{ width: '100%' }}>
          <Typography
            variant="h4"
            gutterBottom
            fontWeight="600"
            sx={{
              fontSize: getTitleFontSize(),
              lineHeight: 1.2,
              '&:hover': { bgcolor: 'action.hover', borderRadius: 1 },
            }}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setProfile({ ...profile, username: e.target.innerText })}
          >
            {profile?.username}
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              lineHeight: 1.6,
              mb: 1,
              fontSize: { xs: '0.9rem', sm: '1rem' },
              '&:hover': { bgcolor: 'action.hover', borderRadius: 1 },
            }}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setProfile({ ...profile, bio: e.target.innerText })}
          >
            {profile?.bio || 'No bio yet.'}
          </Typography>

          <Chip
            label={profile?.is_verified ? 'Verified' : 'Not Verified'}
            color={profile?.is_verified ? 'success' : 'default'}
            size="small"
            sx={{ borderRadius: '8px', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
          />

          {/* Save Button */}
          <Box sx={{mt: 3, width: '100%' }}>
            <Button
              variant="contained"
              onClick={formik.handleSubmit}
              disabled={loading || uploading}
              sx={{ borderRadius: '8px' }}
            >
              {loading || uploading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>

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
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      </Collapse>

      <Collapse in={!!success}>
        <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Collapse>

    </Card>



  );
};

export default ProfileSection;