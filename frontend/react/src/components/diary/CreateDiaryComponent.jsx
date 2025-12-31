import {
  Box,
  Avatar,
  TextField,
  Button,
  Typography,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  Checkbox,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { createDiary } from '../../services/api';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import CloseIcon from '@mui/icons-material/Close';

const CreateDiaryComposer = ({ user, groups, onSuccess, setError }) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [editingStep, setEditingStep] = useState(0);

  const formik = useFormik({
    initialValues: {
      title: '',
      content: '',
      share_type: 'public',
      group_ids: []
    },
    validationSchema: Yup.object({
      title: Yup.string().required(t('title_required')),
      content: Yup.string()
        .required(t('content_required'))
        .min(1, t('content_required')), // allow long content
      group_ids: Yup.array().when('share_type', {
        is: 'group',
        then: (schema) => schema.min(1, t('select_group')),
        otherwise: (schema) => schema.notRequired()
      })
    }),
    validateOnMount: true,
    onSubmit: async (values, { resetForm }) => {
      try {
        setUploading(true);

        await createDiary({
          title: values.title,
          content: values.content,
          share_type: values.share_type,
          group_ids: values.share_type === 'group' ? values.group_ids : [],
          images: selectedImages,
          videos: selectedVideos
        });

        resetForm();
        setSelectedImages([]);
        setSelectedVideos([]);
        setEditingStep(0);
        onSuccess();
      } catch (err) {
        setError(err.message || 'Failed to create diary');
      } finally {
        setUploading(false);
      }
    }
  });

  const handleNext = () => {
    if (editingStep < 1) setEditingStep(editingStep + 1);
  };

  const handlePrev = () => {
    if (editingStep > 0) setEditingStep(editingStep - 1);
  };

  const handleImageUpload = (e) => {
    if (!formik.values.title || !formik.values.content) return; // disable if empty
    const files = Array.from(e.target.files).slice(0, 10 - selectedImages.length);
    setSelectedImages((prev) => [...prev, ...files]);
  };

  const handleVideoUpload = (e) => {
    if (!formik.values.title || !formik.values.content) return; // disable if empty
    const files = Array.from(e.target.files).slice(0, 3 - selectedVideos.length);
    setSelectedVideos((prev) => [...prev, ...files]);
  };

  const isPostDisabled =
    !formik.values.title ||
    !formik.values.content ||
    !formik.isValid ||
    uploading;

  const handleCancel = () => {
    formik.resetForm();
    setSelectedImages([]);
    setSelectedVideos([]);
    setEditingStep(0);
  };

  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 3 , border: 1, borderColor: 'divider', p: 2, mb: 2, position: 'relative' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Avatar src={user?.avatar_url} alt={user.username}>
          {user.username.charAt(0).toUpperCase()}
        </Avatar>

        {editingStep === 0 ? (
          <TextField
            placeholder="What's on your mind?"
            name="title"
            value={formik.values.title}
            onChange={formik.handleChange}
            variant="standard"
            fullWidth
            InputProps={{ disableUnderline: true, sx: { fontSize: '1.1rem', fontWeight: 'bold' } }}
          />
        ) : (
          <TextField
            placeholder="Enter content"
            name="content"
            multiline
            minRows={3}
            value={formik.values.content}
            onChange={formik.handleChange}
            variant="standard"
            fullWidth
            InputProps={{ disableUnderline: true, sx: { fontSize: '1.1rem' } }}
          />
        )}
      </Box>

      <Box sx={{ position: 'absolute', top: 0, right: 0, display: 'flex' }}>
        {(formik.values.title || formik.values.content) && (
          <Tooltip title="Clear all">
            <IconButton onClick={handleCancel} sx={{ minWidth: 0, '&:hover': { backgroundColor: 'transparent', transform: 'scale(1.1)' } }}>
              <CloseIcon sx={{ fontSize: 28 }} />
            </IconButton>
          </Tooltip>
        )}
        {editingStep === 0 && (
          <Tooltip title="Next to content">
            <Button sx={{ minWidth: 0, '&:hover': { backgroundColor: 'transparent' } }} onClick={handleNext}>
              <ArrowForwardIosIcon />
            </Button>
          </Tooltip>
        )}
        {editingStep === 1 && (
          <Tooltip title="Back to title">
            <Button sx={{ minWidth: 0, '&:hover': { backgroundColor: 'transparent' } }} onClick={handlePrev}>
              <ArrowBackIosIcon />
            </Button>
          </Tooltip>
        )}
      </Box>

      {formik.values.share_type === 'group' && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>{t('select_groups')}</InputLabel>
          <Select
            multiple
            name="group_ids"
            value={formik.values.group_ids}
            onChange={formik.handleChange}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {groups.filter((g) => selected.includes(g.id)).map((g) => (
                  <Chip key={g.id} label={g.name} size="small" />
                ))}
              </Box>
            )}
          >
            {groups.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                <Checkbox checked={formik.values.group_ids.includes(g.id)} />
                <ListItemText primary={g.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title='Please enter title and content first'>
            <Button component="label" sx={{ minWidth: 0 }} disabled={!formik.values.title || !formik.values.content}>
              <ImageIcon color="success" />
              <Typography sx={{ ml: 1, display: { xs: 'none', md: 'block' } }}>
                Photo
              </Typography>
              {selectedImages.length ? (selectedImages.length):('')}
              <input hidden multiple type="file" accept="image/*" onChange={handleImageUpload} />
            </Button>
          </Tooltip>

          <Tooltip title='Please enter title and content first'>
            <Button component="label" sx={{ minWidth: 0 }} disabled={!formik.values.title || !formik.values.content}>
              <VideocamIcon color="error" />
              <Typography sx={{ ml: 1, display: { xs: 'none', md: 'block' } }}>
                Video
              </Typography>
              {selectedVideos.length ? (selectedVideos.length): ''}
              <input hidden multiple type="file" accept="video/*" onChange={handleVideoUpload} />
            </Button>
          </Tooltip>

        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControl size="small" sx={{ fontSize: 14 }}>
            <Select
              name="share_type"
              value={formik.values.share_type}
              onChange={formik.handleChange}
            >
              <MenuItem value="public">{t('public')}</MenuItem>
              <MenuItem value="friends">{t('friends')}</MenuItem>
              <MenuItem value="group">{t('group')}</MenuItem>
              <MenuItem value="personal">{t('personal')}</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            disabled={isPostDisabled}
            onClick={formik.handleSubmit}
            sx={{ borderRadius: 1, minWidth: 0 }}
          >
            {uploading ? 'Posting' : 'Post'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default CreateDiaryComposer;

