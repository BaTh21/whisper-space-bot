// ProfileSection.jsx - COMPLETE VERSION WITH CLICKABLE MEDIA & SCROLLING
import {
  AccountCircle,
  ArrowBackIos,
  ArrowForwardIos,
  CameraAlt,
  Close,
  Comment,
  Delete,
  Edit,
  Favorite,
  Fullscreen,
  Lock,
  MoreVert,
  People,
  PhotoCamera,
  PlayArrow,
  Settings,
  Verified,
  VideoLibrary,
  ZoomIn
} from '@mui/icons-material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useFormik } from 'formik';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { useAvatar } from '../../hooks/useAvatar';
import { deleteAvatar, getFeed, updateMe, uploadAvatar } from '../../services/api';

const ProfileSection = ({ profile, setProfile, setError, setSuccess }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0: My Diaries, 1: Private
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState(null);
  const avatarMenuOpen = Boolean(avatarMenuAnchor);
  const [diaries, setDiaries] = useState([]);
  const [diariesLoading, setDiariesLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMenuAnchor, setEditMenuAnchor] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  
  // Media Modal States
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const fileInputRef = useRef(null);
  const { getAvatarUrl, getUserInitials } = useAvatar();

  // Fetch user's diaries
  const fetchUserDiaries = async () => {
    try {
      setDiariesLoading(true);
      const feedData = await getFeed();
      
      // Filter diaries based on active tab
      const filteredDiaries = feedData.filter((diary) => {
        // Only show diaries that belong to the current user
        if (diary.author.id !== profile?.id) return false;
        
        // If on "Private" tab, only show personal/private diaries
        if (activeTab === 1) {
          return diary.share_type === 'personal' || diary.share_type === 'private';
        }
        
        // On "My Diaries" tab, show all user's diaries
        return true;
      });
      
      setDiaries(filteredDiaries);
      setDiariesLoading(false);
    } catch (err) {
      console.error('Fetch diaries error:', err);
      setError(err.message || t('failed_to_load_diaries'));
      setDiariesLoading(false);
    }
  };

  // Load diaries when profile is available or tab changes
  useEffect(() => {
    if (profile?.id) {
      fetchUserDiaries();
    }
  }, [profile?.id, activeTab]);

  // Profile update form
  const formik = useFormik({
    initialValues: {
      username: profile?.username || '',
      bio: profile?.bio || '',
    },
    validationSchema: Yup.object({
      username: Yup.string().min(3, t('username_min')).required(t('required')),
      bio: Yup.string().max(500, t('bio_max')),
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
          const uploadResponse = await uploadAvatar(selectedFile);
          avatarUrl = uploadResponse.avatar_url;
          setUploading(false);
        }

        const updateData = {
          username: values.username,
          bio: values.bio,
          ...(avatarUrl && { avatar_url: avatarUrl }),
        };

        const cleanData = Object.fromEntries(
          Object.entries(updateData).filter(([, value]) => value !== '' && value !== null)
        );

        const response = await updateMe(cleanData);
        setProfile(response);
        setSuccess(selectedFile ? t('profile_avatar_updated') : t('profile_updated'));
        setTimeout(() => setSuccess(null), 2000);

        setSelectedFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsEditing(false);
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

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError(t('invalid_image_type'));
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
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
    try {
      await deleteAvatar();
      setProfile({ ...profile, avatar_url: null });
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

  const handleEditMenuOpen = (event) => {
    setEditMenuAnchor(event.currentTarget);
  };

  const handleEditMenuClose = () => {
    setEditMenuAnchor(null);
  };

  const handleEditClick = () => {
    setIsEditing(true);
    handleEditMenuClose();
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    formik.resetForm();
    setImagePreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const currentAvatarUrl = imagePreview || getAvatarUrl(profile?.avatar_url);

  // Media Modal Functions
  const handleMediaClick = (diary, mediaType, mediaIndex = 0) => {
    const mediaUrls = mediaType === 'video' ? diary.videos : diary.images;
    const thumbnails = mediaType === 'video' ? diary.video_thumbnails : null;
    
    setSelectedMedia({
      diary,
      mediaType,
      urls: mediaUrls,
      thumbnails,
      mediaIndex
    });
    setCurrentMediaIndex(mediaIndex);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedMedia(null);
    setCurrentMediaIndex(0);
    setFullscreen(false);
  };

  const nextMedia = () => {
    if (!selectedMedia) return;
    const mediaCount = selectedMedia.urls?.length || 0;
    if (mediaCount > 1) {
      setCurrentMediaIndex((prev) => (prev + 1) % mediaCount);
    }
  };

  const prevMedia = () => {
    if (!selectedMedia) return;
    const mediaCount = selectedMedia.urls?.length || 0;
    if (mediaCount > 1) {
      setCurrentMediaIndex((prev) => (prev - 1 + mediaCount) % mediaCount);
    }
  };

  const handleCardClick = (diary) => {
    // If diary has media, open the first one
    if (diary.videos?.[0]) {
      handleMediaClick(diary, 'video', 0);
    } else if (diary.images?.[0]) {
      handleMediaClick(diary, 'image', 0);
    } else {
      // If no media, navigate to diary detail page
      navigate(`/diary/${diary.id}`);
    }
  };

  const handlePlayButtonClick = (e, diary) => {
    e.stopPropagation();
    handleMediaClick(diary, 'video', 0);
  };

  // Calculate statistics
  const getStatistics = () => {
    if (!diaries.length) return [];
    
    const totalDiaries = diaries.length;
    const publicDiaries = diaries.filter(d => d.share_type === 'public').length;
    const privateDiaries = diaries.filter(d => d.share_type === 'personal' || d.share_type === 'private').length;
    const friendsDiaries = diaries.filter(d => d.share_type === 'friends').length;
    
    return [
      { label: t('total_diaries'), value: totalDiaries, icon: <MenuBookIcon />, color: 'primary' },
      { label: t('public'), value: publicDiaries, icon: <People />, color: 'success' },
      { label: t('private'), value: privateDiaries, icon: <Lock />, color: 'warning' },
      { label: t('friends'), value: friendsDiaries, icon: <People />, color: 'secondary' },
    ];
  };

  const stats = getStatistics();

  // Render Diaries Grid
  const renderDiariesGrid = () => {
    if (diariesLoading) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 3 }}>
            {t('loading_diaries')}...
          </Typography>
        </Box>
      );
    }

    if (diaries.length === 0) {
      return (
        <Card
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: 'background.paper',
            boxShadow: 2,
            borderRadius: 3,
          }}
        >
          <Box
            sx={{
              width: 120,
              height: 120,
              mx: 'auto',
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
            }}
          >
            {activeTab === 0 ? (
              <MenuBookIcon sx={{ fontSize: 60, color: alpha(theme.palette.primary.main, 0.5) }} />
            ) : (
              <Lock sx={{ fontSize: 60, color: alpha(theme.palette.warning.main, 0.5) }} />
            )}
          </Box>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            {activeTab === 0 ? t('no_diaries_yet') : t('no_private_diaries')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
            {activeTab === 0 
              ? t('start_writing_your_first_diary') 
              : t('private_diaries_only_visible_to_you')}
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Edit />}
            sx={{
              borderRadius: 3,
              px: 6,
              py: 1.5,
              fontWeight: 600,
              fontSize: '1.1rem',
              '&:hover': {
                transform: 'translateY(-3px)',
                boxShadow: 4,
              },
              transition: 'all 0.3s ease',
            }}
          >
            {t('create_new_diary')}
          </Button>
        </Card>
      );
    }

    return (
      <Box>
        <Grid container spacing={2}>
          {diaries.map((diary) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={diary.id}>
              <Card
                onClick={() => handleCardClick(diary)}
                onMouseEnter={() => setHoveredCard(diary.id)}
                onMouseLeave={() => setHoveredCard(null)}
                sx={{
                  height: '100%',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  transform: hoveredCard === diary.id ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                  boxShadow: hoveredCard === diary.id ? 6 : 2,
                  borderRadius: 2,
                  position: 'relative',
                  bgcolor: 'background.paper',
                  '&:hover': {
                    '& .media-overlay': {
                      opacity: 1,
                    }
                  }
                }}
              >
                {/* Media Preview */}
                <Box
                  sx={{
                    position: 'relative',
                    aspectRatio: '9/16',
                    overflow: 'hidden',
                    bgcolor: 'grey.100',
                  }}
                >
                  {/* Video Thumbnail */}
                  {diary.videos?.[0] && (
                    <>
                      <Box
                        component="img"
                        src={diary.video_thumbnails?.[0]}
                        alt={diary.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMediaClick(diary, 'video', 0);
                        }}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: hoveredCard === diary.id ? 'brightness(1.1)' : 'brightness(0.9)',
                          transition: 'filter 0.3s ease',
                          cursor: 'pointer',
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      
                      {/* Play Button Overlay */}
                      <Box
                        onClick={(e) => handlePlayButtonClick(e, diary)}
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 60,
                          height: 60,
                          borderRadius: '50%',
                          bgcolor: alpha('#000', 0.7),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `2px solid ${alpha('#fff', 0.3)}`,
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                          '&:hover': {
                            transform: 'translate(-50%, -50%) scale(1.1)',
                            bgcolor: alpha(theme.palette.primary.main, 0.8),
                          }
                        }}
                      >
                        <PlayArrow sx={{ fontSize: 30, color: 'white' }} />
                      </Box>
                      
                      {/* Video Indicator */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: alpha('#000', 0.7),
                          color: 'white',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <PlayArrow sx={{ fontSize: 12 }} />
                        <span>VIDEO</span>
                      </Box>
                    </>
                  )}

                  {/* Image Preview */}
                  {!diary.videos?.[0] && diary.images?.[0] && (
                    <Box
                      component="img"
                      src={diary.images[0]}
                      alt={diary.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMediaClick(diary, 'image', 0);
                      }}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        transition: 'transform 0.5s ease',
                        transform: hoveredCard === diary.id ? 'scale(1.1)' : 'scale(1)',
                        '&:hover': {
                          opacity: 0.9,
                        }
                      }}
                    />
                  )}

                  {/* No Media Placeholder */}
                  {!diary.videos?.[0] && !diary.images?.[0] && (
                    <Box
                      onClick={() => navigate(`/diary/${diary.id}`)}
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.2),
                        }
                      }}
                    >
                      <VideoLibrary sx={{ fontSize: 60, color: alpha(theme.palette.primary.main, 0.3) }} />
                    </Box>
                  )}

                  {/* Hover Overlay */}
                  <Box
                    className="media-overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      bgcolor: alpha('#000', 0.3),
                      opacity: 0,
                      transition: 'opacity 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {diary.videos?.[0] ? (
                      <PlayArrow sx={{ fontSize: 48, color: 'white' }} />
                    ) : diary.images?.[0] ? (
                      <ZoomIn sx={{ fontSize: 48, color: 'white' }} />
                    ) : (
                      <MenuBookIcon sx={{ fontSize: 48, color: 'white' }} />
                    )}
                  </Box>

                  {/* Gradient Overlay */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '50%',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
                    }}
                  />

                  {/* Like Count */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 12,
                      left: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      color: 'white',
                    }}
                  >
                    <Favorite sx={{ fontSize: 16 }} />
                    <Typography variant="caption" fontWeight="600">
                      {diary.likes?.length || 0}
                    </Typography>
                  </Box>

                  {/* Comment Count */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 12,
                      right: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      color: 'white',
                    }}
                  >
                    <Comment sx={{ fontSize: 16 }} />
                    <Typography variant="caption" fontWeight="600">
                      {diary.comments?.length || 0}
                    </Typography>
                  </Box>

                  {/* Media Count Badge */}
                  {(diary.videos?.length > 1 || diary.images?.length > 1) && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        bgcolor: alpha(theme.palette.primary.main, 0.9),
                        color: 'white',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      +{(diary.videos?.length || diary.images?.length) - 1}
                    </Box>
                  )}
                </Box>

                {/* Diary Info */}
                <CardContent sx={{ p: 2 }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight="600"
                    sx={{
                      mb: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.4,
                      color: 'text.primary',
                    }}
                  >
                    {diary.title}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.5,
                    }}
                  >
                    {diary.content}
                  </Typography>

                  {/* Footer */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {new Date(diary.created_at).toLocaleDateString()}
                    </Typography>
                    <Chip
                      label={diary.share_type}
                      size="small"
                      sx={{
                        borderRadius: 1,
                        fontWeight: 500,
                        bgcolor:
                          diary.share_type === 'public'
                            ? alpha(theme.palette.primary.main, 0.1)
                            : diary.share_type === 'friends'
                              ? alpha(theme.palette.secondary.main, 0.1)
                              : diary.share_type === 'personal' || diary.share_type === 'private'
                                ? alpha(theme.palette.warning.main, 0.1)
                                : alpha(theme.palette.grey[500], 0.1),
                        color:
                          diary.share_type === 'public'
                            ? theme.palette.primary.main
                            : diary.share_type === 'friends'
                              ? theme.palette.secondary.main
                              : diary.share_type === 'personal' || diary.share_type === 'private'
                                ? theme.palette.warning.main
                                : theme.palette.grey[600],
                      }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Load More Button */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={fetchUserDiaries}
            disabled={diariesLoading}
            startIcon={<RefreshIcon />}
            sx={{
              borderRadius: 3,
              px: 6,
              py: 1.5,
              fontWeight: 600,
              '&:hover': {
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            {diariesLoading ? t('loading') : t('refresh')}
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      {/* Profile Header */}
      <Box
        sx={{
          pt: { xs: 8, sm: 12 },
          pb: { xs: 4, sm: 6 },
          px: { xs: 2, sm: 4 },
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '100%',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            zIndex: -1,
          }
        }}
      >
        <Box
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            position: 'relative',
          }}
        >
          <Grid container spacing={4} alignItems="center">
            {/* Avatar Column */}
            <Grid item xs={12} md="auto">
              <Box
                sx={{
                  position: 'relative',
                  width: { xs: 140, sm: 160, md: 180 },
                  height: { xs: 140, sm: 160, md: 180 },
                  mx: { xs: 'auto', md: 0 },
                }}
              >
                <Box
                  onClick={() => setAvatarMenuAnchor(document.getElementById('avatar-container'))}
                  id="avatar-container"
                  sx={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar
                    src={currentAvatarUrl}
                    alt={profile?.username}
                    sx={{
                      width: '100%',
                      height: '100%',
                      fontSize: { xs: '3rem', sm: '3.5rem' },
                      bgcolor: 'primary.light',
                      border: `4px solid ${theme.palette.background.paper}`,
                      boxShadow: 4,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        boxShadow: 8,
                      }
                    }}
                  >
                    {getUserInitials(profile?.username)}
                  </Avatar>

                  {/* Camera Icon Overlay */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      bgcolor: 'background.paper',
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `2px solid ${theme.palette.primary.main}`,
                      color: 'primary.main',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        bgcolor: 'primary.main',
                        color: 'white',
                      }
                    }}
                  >
                    <PhotoCamera sx={{ fontSize: 18 }} />
                  </Box>

                  {/* Verified Badge */}
                  {profile?.is_verified && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'success.main',
                        color: 'white',
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `2px solid ${theme.palette.background.paper}`,
                        boxShadow: 2,
                      }}
                    >
                      <Verified sx={{ fontSize: 14 }} />
                    </Box>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* Profile Details Column */}
            <Grid item xs={12} md={true}>
              <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                {/* Username Section */}
                <Stack direction="row" alignItems="center" justifyContent={{ xs: 'center', md: 'flex-start' }} spacing={1} sx={{ mb: 2 }}>
                  {isEditing ? (
                    <TextField
                      variant="outlined"
                      size="small"
                      name="username"
                      value={formik.values.username}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.username && Boolean(formik.errors.username)}
                      helperText={formik.touched.username && formik.errors.username}
                      sx={{
                        maxWidth: 300,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                        }
                      }}
                    />
                  ) : (
                    <>
                      <Typography
                        variant="h3"
                        fontWeight={800}
                        sx={{
                          background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          color: 'text.primary',
                        }}
                      >
                        {profile?.username}
                      </Typography>
                      
                      <IconButton
                        onClick={handleEditMenuOpen}
                        size="small"
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            color: 'primary.main',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                          }
                        }}
                      >
                        <MoreVert />
                      </IconButton>
                      
                      <Menu
                        anchorEl={editMenuAnchor}
                        open={Boolean(editMenuAnchor)}
                        onClose={handleEditMenuClose}
                        PaperProps={{
                          sx: {
                            borderRadius: 2,
                            minWidth: 150,
                            mt: 1,
                          }
                        }}
                      >
                        <MenuItem onClick={handleEditClick}>
                          <Edit sx={{ mr: 1, fontSize: 20 }} />
                          {t('edit_profile')}
                        </MenuItem>
                        <MenuItem onClick={() => fileInputRef.current?.click()}>
                          <CameraAlt sx={{ mr: 1, fontSize: 20 }} />
                          {t('change_photo')}
                        </MenuItem>
                        <MenuItem onClick={() => setDeleteDialogOpen(true)} sx={{ color: 'error.main' }}>
                          <Delete sx={{ mr: 1, fontSize: 20 }} />
                          {t('delete_photo')}
                        </MenuItem>
                      </Menu>
                    </>
                  )}
                </Stack>

                {/* Bio Section */}
                {isEditing ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    variant="outlined"
                    size="small"
                    name="bio"
                    value={formik.values.bio}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.bio && Boolean(formik.errors.bio)}
                    helperText={formik.touched.bio && formik.errors.bio}
                    placeholder={t('write_your_bio')}
                    sx={{
                      maxWidth: 400,
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                  />
                ) : (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{
                      mb: 3,
                      maxWidth: 400,
                      mx: { xs: 'auto', md: 0 },
                      lineHeight: 1.6,
                      fontStyle: profile?.bio ? 'normal' : 'italic',
                    }}
                  >
                    {profile?.bio || t('no_bio_yet')}
                  </Typography>
                )}

                {/* Stats Section */}
                {stats.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={{ xs: 2, sm: 3 }}
                    justifyContent={{ xs: 'center', md: 'flex-start' }}
                    sx={{ mb: 3, flexWrap: 'wrap' }}
                  >
                    {stats.map((stat, index) => (
                      <Box
                        key={index}
                        sx={{
                          textAlign: 'center',
                          mb: 1,
                          px: { xs: 1, sm: 0 },
                          minWidth: { xs: '45%', sm: 'auto' },
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 0.5,
                          }}
                        >
                          {stat.icon}
                        </Box>
                        <Typography
                          variant="h5"
                          fontWeight={700}
                          color={`${stat.color}.main`}
                        >
                          {stat.value}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                        >
                          {stat.label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}

                {/* Action Buttons */}
                {isEditing ? (
                  <Stack direction="row" spacing={2} justifyContent={{ xs: 'center', md: 'flex-start' }}>
                    <Button
                      variant="contained"
                      onClick={formik.handleSubmit}
                      disabled={loading || uploading}
                      startIcon={loading || uploading ? null : <AccountCircle />}
                      sx={{
                        borderRadius: 3,
                        px: 4,
                        py: 1,
                        fontWeight: 600,
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 4,
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {loading || uploading ? (
                        <>
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                          {uploading ? t('uploading') : t('saving')}
                        </>
                      ) : (
                        t('save_changes')
                      )}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleCancelEdit}
                      disabled={loading}
                      sx={{
                        borderRadius: 3,
                        px: 4,
                        py: 1,
                        fontWeight: 600,
                        '&:hover': {
                          transform: 'translateY(-2px)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {t('cancel')}
                    </Button>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={2} justifyContent={{ xs: 'center', md: 'flex-start' }}>
                    <Button
                      variant="contained"
                      onClick={handleEditClick}
                      startIcon={<Edit />}
                      sx={{
                        borderRadius: 3,
                        px: 4,
                        py: 1,
                        fontWeight: 600,
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 4,
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {t('edit_profile')}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Settings />}
                      sx={{
                        borderRadius: 3,
                        px: 4,
                        py: 1,
                        fontWeight: 600,
                        '&:hover': {
                          transform: 'translateY(-2px)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {t('settings')}
                    </Button>
                  </Stack>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Scrollable Content Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 2, sm: 4 },
          py: 2,
          width: '100%',
        }}
      >
        {/* Tabs Navigation */}
        <Paper
          elevation={0}
          sx={{
            mb: 4,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            sx={{
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
              }
            }}
          >
            <Tab
              icon={<MenuBookIcon />}
              label={t('my_diaries')}
              iconPosition="start"
              sx={{
                py: 2,
                fontWeight: 600,
                fontSize: '1rem',
                textTransform: 'none',
                minHeight: 64,
              }}
            />
            <Tab
              icon={<Lock />}
              label={t('private')}
              iconPosition="start"
              sx={{
                py: 2,
                fontWeight: 600,
                fontSize: '1rem',
                textTransform: 'none',
                minHeight: 64,
              }}
            />
          </Tabs>
        </Paper>

        {/* Diaries Grid Content */}
        <Box sx={{ pb: 4 }}>
          {renderDiariesGrid()}
        </Box>
      </Box>

      {/* Avatar Context Menu */}
      <Menu
        anchorEl={avatarMenuAnchor}
        open={avatarMenuOpen}
        onClose={() => setAvatarMenuAnchor(null)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 180,
            mt: 1,
            py: 0.5,
          }
        }}
      >
        <MenuItem onClick={() => { setAvatarMenuAnchor(null); fileInputRef.current?.click(); }}>
          <ListItemIcon>
            <PhotoCamera fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('upload_new_photo')} />
        </MenuItem>
        {profile?.avatar_url && (
          <MenuItem
            onClick={() => { setAvatarMenuAnchor(null); setDeleteDialogOpen(true); }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'error.main' }}>
              <Delete fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={t('delete_photo')} />
          </MenuItem>
        )}
      </Menu>

      {/* Delete Avatar Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxWidth: 400,
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
          {t('delete_profile_photo')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('delete_photo_confirmation')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{
              borderRadius: 2,
              px: 3,
              fontWeight: 500,
            }}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={confirmDeleteAvatar}
            color="error"
            variant="contained"
            disabled={deleting}
            sx={{
              borderRadius: 2,
              px: 3,
              fontWeight: 500,
            }}
          >
            {deleting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              t('delete')
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Media Viewer Modal */}
      <Dialog
        open={modalOpen}
        onClose={closeModal}
        maxWidth={fullscreen ? false : 'lg'}
        fullWidth
        fullScreen={fullscreen}
        PaperProps={{
          sx: {
            borderRadius: fullscreen ? 0 : 3,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            maxHeight: fullscreen ? '100vh' : '90vh',
          }
        }}
      >
        {selectedMedia && (
          <>
            <DialogTitle sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              pb: 1,
              pr: 1,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6" fontWeight={600} noWrap>
                  {selectedMedia.diary.title}
                </Typography>
                <Chip
                  label={selectedMedia.diary.share_type}
                  size="small"
                  sx={{
                    bgcolor: selectedMedia.diary.share_type === 'public'
                      ? alpha(theme.palette.primary.main, 0.8)
                      : selectedMedia.diary.share_type === 'private'
                        ? alpha(theme.palette.warning.main, 0.8)
                        : alpha(theme.palette.secondary.main, 0.8),
                    color: 'white',
                  }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton 
                  onClick={() => setFullscreen(!fullscreen)}
                  size="small"
                >
                  <Fullscreen />
                </IconButton>
                <IconButton onClick={closeModal} size="small">
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            
            <DialogContent sx={{ 
              p: 0, 
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: fullscreen ? '#000' : 'transparent',
            }}>
              {/* Navigation Arrows for multiple media */}
              {(selectedMedia.urls?.length > 1) && (
                <>
                  <IconButton
                    onClick={prevMedia}
                    sx={{
                      position: 'absolute',
                      left: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: alpha('#000', 0.5),
                      color: 'white',
                      '&:hover': {
                        bgcolor: alpha('#000', 0.7),
                      },
                      zIndex: 10,
                    }}
                  >
                    <ArrowBackIos />
                  </IconButton>
                  
                  <IconButton
                    onClick={nextMedia}
                    sx={{
                      position: 'absolute',
                      right: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: alpha('#000', 0.5),
                      color: 'white',
                      '&:hover': {
                        bgcolor: alpha('#000', 0.7),
                      },
                      zIndex: 10,
                    }}
                  >
                    <ArrowForwardIos />
                  </IconButton>
                </>
              )}
              
              {/* Media Counter */}
              {(selectedMedia.urls?.length > 1) && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    bgcolor: alpha('#000', 0.7),
                    color: 'white',
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    zIndex: 10,
                  }}
                >
                  <Typography variant="caption">
                    {currentMediaIndex + 1} / {selectedMedia.urls.length}
                  </Typography>
                </Box>
              )}
              
              {/* Media Display */}
              {selectedMedia.mediaType === 'video' ? (
                <Box
                  component="video"
                  controls
                  autoPlay
                  src={selectedMedia.urls[currentMediaIndex]}
                  sx={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: fullscreen ? 'calc(100vh - 140px)' : '70vh',
                    display: 'block',
                    outline: 'none',
                  }}
                />
              ) : (
                <Box
                  component="img"
                  src={selectedMedia.urls[currentMediaIndex]}
                  alt={`${selectedMedia.diary.title} - ${currentMediaIndex + 1}`}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: fullscreen ? 'calc(100vh - 140px)' : '70vh',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              )}
              
              {/* Media Thumbnails (for multiple media) */}
              {(selectedMedia.urls?.length > 1) && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 1,
                    px: 2,
                    zIndex: 10,
                  }}
                >
                  {selectedMedia.urls.map((url, index) => (
                    <Box
                      key={index}
                      onClick={() => setCurrentMediaIndex(index)}
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: 1,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: currentMediaIndex === index 
                          ? `2px solid ${theme.palette.primary.main}` 
                          : '2px solid transparent',
                        opacity: currentMediaIndex === index ? 1 : 0.7,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          opacity: 1,
                          transform: 'scale(1.05)',
                        }
                      }}
                    >
                      <Box
                        component="img"
                        src={selectedMedia.thumbnails?.[index] || url}
                        alt={`Thumbnail ${index + 1}`}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </DialogContent>
            
            <DialogActions sx={{ 
              p: 2, 
              justifyContent: 'space-between',
              borderTop: `1px solid ${theme.palette.divider}`,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  startIcon={<Favorite />}
                  color="primary"
                  variant="outlined"
                  size="small"
                >
                  {selectedMedia.diary.likes?.length || 0} {t('like')}
                </Button>
                <Button
                  startIcon={<Comment />}
                  color="primary"
                  variant="outlined"
                  size="small"
                >
                  {selectedMedia.diary.comments?.length || 0} {t('comment')}
                </Button>
              </Box>
              
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  closeModal();
                  navigate(`/diary/${selectedMedia.diary.id}`);
                }}
              >
                {t('view_full_diary')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: 'none' }}
      />
    </Box>
  );
};

export default ProfileSection;