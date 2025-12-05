// ProfileSection.jsx
// dashboard/ProfileSection.jsx
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  Typography,
  useMediaQuery,
  useTheme,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useFormik } from 'formik';
import { useRef, useState } from 'react';
import * as Yup from 'yup';
import { useAvatar } from '../../hooks/useAvatar';
import { updateMe, uploadAvatar, deleteAvatar } from '../../services/api'; // Import deleteAvatar
import { useTranslation } from 'react-i18next';

const ProfileSection = ({ profile, setProfile, error, success, setError, setSuccess }) => {
  const { t } = useTranslation();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const fileInputRef = useRef(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const getAvatarSize = () => (isMobile ? 80 : isTablet ? 100 : 120);
  const getAvatarFontSize = () => (isMobile ? '2rem' : isTablet ? '2.5rem' : '3rem');
  const getTitleFontSize = () =>
    isMobile ? '1.5rem' : isTablet ? '1.75rem' : '2.125rem';

  const { getAvatarUrl, getUserInitials } = useAvatar();

  const formik = useFormik({
    initialValues: {
      username: profile?.username || '',
      bio: profile?.bio || '',
    },
    validationSchema: Yup.object({
      username: Yup.string()
        .min(3, t('username_min'))
        .required(t('required')),
      bio: Yup.string()
        .max(500, t('bio_max')),
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
            setError(uploadError.message || t('upload_failed'));
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

        setSuccess(
          selectedFile
            ? t('profile_avatar_updated')
            : t('profile_updated')
        );

        setSelectedFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (err) {
        setError(err.response?.data?.detail || err.message || t('update_failed'));
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
      setError(t('invalid_image_type'));
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setError(t('image_too_large'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);

    setSelectedFile(file);
    setError(null);
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleDeleteAvatar = async () => {
    if (!profile?.avatar_url) {
      setError(t('no_avatar_to_delete'));
      return;
    }

    setDeleteDialogOpen(true);
  };

  const confirmDeleteAvatar = async () => {
    setDeleting(true);
    setError(null);
    setSuccess(null);
    
    try {
      await deleteAvatar();
      
      // Update profile locally
      setProfile({
        ...profile,
        avatar_url: null
      });
      
      setSuccess(t('avatar_deleted_success'));
      setImagePreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (err) {
      setError(err.response?.data?.detail || err.message || t('delete_failed'));
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

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
        height: '80vh'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          width: '100%',
          maxWidth: 500,
        }}
      >
        {/* Avatar Section */}
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Avatar with Camera Icon */}
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
              <CameraswitchIcon sx={{ fontSize: 20 }} />
            </Box>
          </Box>

          {/* Delete Button - Only show if avatar exists */}
          {profile?.avatar_url && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteAvatar}
              disabled={deleting}
              sx={{
                borderRadius: '20px',
                textTransform: 'none',
                fontSize: '0.875rem',
                '&:hover': {
                  bgcolor: 'error.light',
                  color: 'white',
                }
              }}
            >
              {deleting ? t('deleting') : t('delete_avatar')}
            </Button>
          )}
        </Box>

        {/* Profile Info */}
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
            {profile?.bio || t('no_bio')}
          </Typography>

          <Chip
            label={
              profile?.is_verified
                ? t('verified')
                : t('not_verified')
            }
            color={profile?.is_verified ? 'success' : 'default'}
            size="small"
            sx={{ borderRadius: '8px', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
          />

          <Box sx={{ mt: 3, width: '100%' }}>
            <Button
              variant="contained"
              onClick={formik.handleSubmit}
              disabled={loading || uploading}
              sx={{ borderRadius: '8px' }}
            >
              {loading || uploading ? t('saving') : t('save_changes')}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* File Input */}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          {t('confirm_delete_avatar')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {t('delete_avatar_warning')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
            {t('cancel')}
          </Button>
          <Button 
            onClick={confirmDeleteAvatar} 
            color="error" 
            variant="contained"
            disabled={deleting}
          >
            {deleting ? t('deleting') : t('delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default ProfileSection;