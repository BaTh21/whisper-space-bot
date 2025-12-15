import { Close as CloseIcon, Image as ImageIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import { useFormik } from 'formik';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';
import { createDiary } from '../../services/api';

const CreateDiaryDialog = ({ open, onClose, groups, onSuccess, setError }) => {
  const { t, i18n } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const formik = useFormik({
    initialValues: {
      title: '',
      content: '',
      share_type: 'public',
      group_ids: [],
      images: [], // Base64 encoded images
    },
    validationSchema: Yup.object({
      title: Yup.string().required('Title is required'),
      content: Yup.string().required('Content is required'),
      share_type: Yup.string().oneOf(['public', 'friends', 'group', 'personal']),
      group_ids: Yup.array().when('share_type', {
        is: 'group',
        then: (schema) => schema.min(1, 'Please select at least one group'),
        otherwise: (schema) => schema.notRequired(),
      }),
      images: Yup.array().max(10, 'Maximum 10 images allowed'),
    }),
    onSubmit: async (values, { resetForm, setSubmitting }) => {
      try {
        setUploading(true);
        
        // Convert selected files to base64
        const imagePromises = selectedImages.map(file => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve(e.target.result);
            };
            reader.readAsDataURL(file);
          });
        });
        
        const base64Images = await Promise.all(imagePromises);
        
        const payload = {
          title: values.title,
          content: values.content,
          share_type: values.share_type,
          group_ids: values.share_type === 'group' ? values.group_ids : [],
          images: base64Images, // Include images
        };

        if (values.share_type !== 'group') delete payload.group_ids;
        if (base64Images.length === 0) delete payload.images; // Don't send empty array

        await createDiary(payload);
        resetForm();
        setSelectedImages([]);
        setImagePreviews([]);
        onSuccess();
      } catch (err) {
        setError(err.message || 'Failed to create diary');
      } finally {
        setUploading(false);
        setSubmitting(false);
      }
    },
  });

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    
    // Filter valid images
    const validImages = files.filter(file => {
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      const isValidCount = selectedImages.length + files.length <= 10;
      
      if (!isValidType) {
        setError('Only image files are allowed (jpg, png, gif, etc.)');
        return false;
      }
      
      if (!isValidSize) {
        setError('Each image must be less than 5MB');
        return false;
      }
      
      if (!isValidCount) {
        setError('Maximum 10 images allowed');
        return false;
      }
      
      return true;
    });
    
    if (validImages.length === 0) return;
    
    // Add to selected images
    setSelectedImages(prev => [...prev, ...validImages]);
    
    // Create previews
    validImages.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, { 
          url: e.target.result, 
          name: file.name,
          size: file.size 
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    formik.resetForm();
    setSelectedImages([]);
    setImagePreviews([]);
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: '16px',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, borderBottom: '1px solid #e0e0e0' }}>
        {t('create_new_diary')}
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2 }}>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label={t('title')}
            name="title"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.title && !!formik.errors.title}
            helperText={formik.touched.title && formik.errors.title}
            fullWidth
            required
            size="medium"
          />

          <TextField
            label={t('content')}
            name="content"
            multiline
            rows={4}
            value={formik.values.content}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.content && !!formik.errors.content}
            helperText={formik.touched.content && formik.errors.content}
            fullWidth
            required
            size="medium"
          />

          <FormControl fullWidth>
            <InputLabel>{t('share_type')}</InputLabel>
            <Select
              name="share_type"
              value={formik.values.share_type}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              label="Share Type"
            >
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="friends">Friends Only</MenuItem>
              <MenuItem value="group">Group</MenuItem>
              <MenuItem value="personal">Personal</MenuItem>
            </Select>
          </FormControl>

          {formik.values.share_type === 'group' && (
            <FormControl fullWidth>
              <InputLabel>Select Groups</InputLabel>
              <Select
                multiple
                name="group_ids"
                value={formik.values.group_ids}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {groups
                      .filter((group) => selected.includes(group.id))
                      .map((group) => (
                        <Chip key={group.id} label={group.name} size="small" />
                      ))}
                  </Box>
                )}
                error={formik.touched.group_ids && !!formik.errors.group_ids}
              >
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    <Checkbox checked={formik.values.group_ids.includes(group.id)} />
                    <ListItemText primary={group.name} />
                  </MenuItem>
                ))}
              </Select>
              {formik.touched.group_ids && formik.errors.group_ids && (
                <Typography color="error" variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                  {formik.errors.group_ids}
                </Typography>
              )}
            </FormControl>
          )}

          {/* Image Upload Section */}
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Add Images (Optional)
            </Typography>
            
            <Button
              variant="outlined"
              component="label"
              startIcon={<ImageIcon />}
              disabled={uploading || selectedImages.length >= 10}
              fullWidth
              sx={{ mb: 1 }}
            >
              Select Images
              <input
                type="file"
                hidden
                multiple
                accept="image/*"
                onChange={handleImageUpload}
              />
            </Button>
            
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              You can add up to 10 images. Each image should be less than 5MB.
              {selectedImages.length > 0 && ` (${selectedImages.length}/10 selected)`}
            </Typography>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Selected Images:
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: 2,
                  maxHeight: 200,
                  overflowY: 'auto',
                  p: 1,
                  border: '1px solid #e0e0e0',
                  borderRadius: 1
                }}>
                  {imagePreviews.map((preview, index) => (
                    <Box 
                      key={index} 
                      sx={{ 
                        position: 'relative',
                        width: 100,
                        height: 100
                      }}
                    >
                      <img
                        src={preview.url}
                        alt={`Preview ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: 4,
                          border: '1px solid #e0e0e0'
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => removeImage(index)}
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          bgcolor: 'white',
                          border: '1px solid #e0e0e0',
                          width: 24,
                          height: 24,
                          '&:hover': { 
                            bgcolor: '#f5f5f5',
                            color: 'error.main'
                          }
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          bgcolor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          px: 0.5,
                          py: 0.25,
                          fontSize: '0.6rem',
                          borderBottomLeftRadius: 4,
                          borderBottomRightRadius: 4
                        }}
                      >
                        {formatFileSize(preview.size)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button 
          onClick={handleClose}
          disabled={uploading}
        >
          {t('cancel')}
        </Button>
        <Button
          onClick={formik.handleSubmit}
          variant="contained"
          disabled={!formik.isValid || formik.isSubmitting || uploading}
          startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {uploading ? 'Uploading...' : t('create_diary')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateDiaryDialog;