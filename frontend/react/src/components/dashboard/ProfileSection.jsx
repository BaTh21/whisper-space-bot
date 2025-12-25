import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import DeleteIcon from '@mui/icons-material/Delete';
import HttpsIcon from '@mui/icons-material/Https';
import { IconButton, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Typography,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItem
} from '@mui/material';
import { useFormik } from 'formik';
import { useRef, useState } from 'react';
import * as Yup from 'yup';
import { useAvatar } from '../../hooks/useAvatar';
import { updateMe, uploadAvatar, deleteAvatar } from '../../services/api'; // Import deleteAvatar
import { useTranslation } from 'react-i18next';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SettingsIcon from '@mui/icons-material/Settings';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import VisibilityIcon from '@mui/icons-material/Visibility';
import UploadIcon from '@mui/icons-material/Upload';

const ProfileSection = ({ profile, setProfile, setError, setSuccess }) => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [activeMenu, setActiveMenu] = useState(0);
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState(null);
  const avatarMenuOpen = Boolean(avatarMenuAnchor);

  const handleAvatarClick = (event) => {
    setAvatarMenuAnchor(event.currentTarget);
  };

  const handleAvatarMenuClose = () => {
    setAvatarMenuAnchor(null);
  };


  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const menus = [
    { label: 'My Diary', icon: <MenuBookIcon /> },
    { label: 'Private', icon: <HttpsIcon /> },
  ];

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

        setSuccess(
          selectedFile
            ? t('profile_avatar_updated')
            : t('profile_updated')
        );

        setTimeout(() => {
          setSuccess(null);
        }, 2000);

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
    <Box
      sx={{
        mb: 3,
        borderRadius: { xs: '12px', sm: '16px' },
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '89vh',
        position: 'relative'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: {xs: 1, md: 3},
          width: '100%',
          maxWidth: 500,
          mt: 5,
          px: 2
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
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
                width: { xs: 150, md: 200 },
                height: { xs: 150, md: 200 },
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
                top: 5,
                left: 5,
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
        </Box>

        <Box
          sx={{
            width: { xs: '80%', md: '100%' },
          }}>
          <Typography
            fontWeight="600"
            sx={{
              fontSize: getTitleFontSize(),
              lineHeight: 1.2,
              '&:hover': { bgcolor: 'action.hover', borderRadius: 1 },
              fontSize: {xs: 18, md: 26},
              mb: {xs: 0, md: 1}
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

          <Box sx={{ mt: {xs: 1, md: 3}, width: '100%' }}>
            <Button
              variant="contained"
              onClick={formik.handleSubmit}
              disabled={loading || uploading}
              sx={{ borderRadius: '8px' }}
            >
              {loading || uploading ? t('saving') : t('save_changes')}
            </Button>
            <Tooltip title='setting'>
              <IconButton
                sx={{
                  minWidth: 10,
                  color: 'primary.main'
                }}
              >
                <SettingsIcon sx={{ fontSize: 32 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/jpeg,image/jpg,image/png"
        style={{ display: 'none' }}
      />

      <Box
        sx={{
          mt: 4,
          width: '100%',
          borderColor: 'divider',
        }}
      >
        <ToggleButtonGroup
          value={activeMenu}
          exclusive
          onChange={(event, newValue) => {
            if (newValue !== null) setActiveMenu(newValue);
          }}
          sx={{
            display: 'flex',
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {menus.map((item, index) => (
            <ToggleButton
              key={item.label}
              value={index}
              sx={{
                px: 1.5,
                py: 0.75,
                minHeight: 36,
                border: 'none',
                color: activeMenu === index ? 'primary.main' : 'text.secondary',
                '&:hover': {
                  bgcolor: 'action.hover',
                  color: 'primary.main',
                },
                '&.Mui-selected': {
                  bgcolor: 'transparent',
                  color: 'primary.main',
                },
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  height: 3,
                  bgcolor: 'primary.main',
                  transform: activeMenu === index ? 'scaleX(1)' : 'scaleX(0)',
                  transition: 'transform 0.25s ease',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 26, color: activeMenu === index ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: 12,
                  fontWeight: activeMenu === index ? 600 : 500,
                  lineHeight: 1.2,
                  mt: 0.25,
                  mr: 1,
                }}
              />
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      {activeMenu === 0 && (
        <>
          My Dairies
        </>
      )}

      <Menu
        anchorEl={avatarMenuAnchor}
        open={avatarMenuOpen}
        onClose={handleAvatarMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 160,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleAvatarMenuClose();
          }}
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          {t('view')}
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleAvatarMenuClose();
            fileInputRef.current?.click();
          }}
        >
          <ListItemIcon>
            <UploadIcon fontSize="small" />
          </ListItemIcon>
          {t('upload')}
        </MenuItem>

        {profile?.avatar_url && (
          <MenuItem
            onClick={() => {
              handleAvatarMenuClose();
              setDeleteDialogOpen(true);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'error.main' }}>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            {t('delete')}
          </MenuItem>
        )}
      </Menu>

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
    </Box>
  );
};

export default ProfileSection;