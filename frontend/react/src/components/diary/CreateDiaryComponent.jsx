import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Tooltip
} from '@mui/material';
import { useFormik } from 'formik';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';
import { createDiary } from '../../services/api';

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
        .min(1, t('content_required')),
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
        setError(err.message || t('failed_create_diary'));
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
    const files = Array.from(e.target.files).slice(0, 10 - selectedImages.length);
    setSelectedImages((prev) => [...prev, ...files]);
  };

  const handleVideoUpload = (e) => {
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

  const hasContent = formik.values.title || formik.values.content;

  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, border: 1, borderColor: 'divider', p: 2, mb: 2, position: 'relative' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Avatar src={user?.avatar_url} alt={user?.username}>
          {user?.username?.charAt(0).toUpperCase()}
        </Avatar>

        {editingStep === 0 ? (
          <TextField
            placeholder={t('whats_on_your_mind')}
            name="title"
            value={formik.values.title}
            onChange={formik.handleChange}
            variant="standard"
            fullWidth
            InputProps={{ disableUnderline: true, sx: { fontSize: '1.1rem', fontWeight: 'bold' } }}
          />
        ) : (
          <TextField
            placeholder={t('enter_content')}
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

      {/* Top Right Controls */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center' }}>
        {hasContent && (
          <Tooltip title={t('clear_all')}>
            <IconButton onClick={handleCancel}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        )}

        {editingStep === 0 && hasContent && (
          <Tooltip title={t('next_to_content')}>
            <IconButton onClick={handleNext}>
              <ArrowForwardIosIcon />
            </IconButton>
          </Tooltip>
        )}

        {editingStep === 1 && (
          <Tooltip title={t('back_to_title')}>
            <IconButton onClick={handlePrev}>
              <ArrowBackIosIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Group Selection (only when share_type is 'group') */}
      {formik.values.share_type === 'group' && groups?.length > 0 && (
        <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
          <InputLabel>{t('select_groups')}</InputLabel>
          <Select
            multiple
            name="group_ids"
            value={formik.values.group_ids}
            onChange={formik.handleChange}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {groups
                  .filter((g) => selected.includes(g.id))
                  .map((g) => (
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

      {/* Media Upload & Privacy + Post Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title={t('please_enter_title_content_first')}>
            <span>
              <Button
                component="label"
                disabled={!formik.values.title || !formik.values.content}
                startIcon={<ImageIcon color="success" />}
              >
                {t('photo')}
                {selectedImages.length > 0 && ` (${selectedImages.length})`}
                <input
                  hidden
                  multiple
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title={t('please_enter_title_content_first')}>
            <span>
              <Button
                component="label"
                disabled={!formik.values.title || !formik.values.content}
                startIcon={<VideocamIcon color="error" />}
              >
                {t('video')}
                {selectedVideos.length > 0 && ` (${selectedVideos.length})`}
                <input
                  hidden
                  multiple
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                />
              </Button>
            </span>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControl size="small">
            <Select
              name="share_type"
              value={formik.values.share_type}
              onChange={formik.handleChange}
              displayEmpty
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
          >
            {uploading ? t('posting') : t('post')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default CreateDiaryComposer;