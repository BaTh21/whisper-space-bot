import React, { useEffect, useState } from 'react';
import {
  Article as ArticleIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  Comment as CommentIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Favorite,
  FavoriteBorder,
  Image as ImageIcon,
  MoreVert as MoreVertIcon,
  Reply as ReplyIcon,
  Save as SaveIcon,
  Send as SendIcon
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  Snackbar,
  Alert,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { commentOnDiary, deleteCommentById, deleteDiaryById, getDiaryById, getDiaryComments, getDiaryLikes, likeDiary, updateComment, updateDiaryById } from '../../services/api';
import { formatCambodiaDate } from '../../utils/dateUtils';

// Helper function to convert files to base64
const convertFilesToBase64 = (files) => {
  return Promise.all(
    Array.from(files).map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            data: e.target.result,
            name: file.name,
            type: file.type,
            size: file.size
          });
        };
        reader.onerror = (error) => {
          reject(new Error(`Failed to read file: ${file.name}`));
        };
        reader.readAsDataURL(file);
      });
    })
  );
};

// Enhanced CommentItemWithActions component
const CommentItemWithActions = ({
  comment,
  diaryId,
  profile,
  onAddReply,
  level = 0,
  replyingTo,
  setReplyingTo,
  handleImageUpload,
  selectedCommentImages,
  setSelectedCommentImages,
  onEditComment,
  onDeleteComment
}) => {
  const [localReplying, setLocalReplying] = useState(false);
  const [localEditing, setLocalEditing] = useState(false);
  const [localEditText, setLocalEditText] = useState(comment.content);
  const [localEditImages, setLocalEditImages] = useState(comment.images || []);
  const [localReplyText, setLocalReplyText] = useState('');
  const [commentMenuAnchorEl, setCommentMenuAnchorEl] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const commentMenuOpen = Boolean(commentMenuAnchorEl);

  const isCommentOwner = profile && comment.user?.id === profile.id;
  const maxDepth = 5;
  const isTooDeep = level >= maxDepth;

  const handleCommentMenuOpen = (event) => {
    event.stopPropagation();
    setCommentMenuAnchorEl(event.currentTarget);
  };

  const handleCommentMenuClose = () => {
    setCommentMenuAnchorEl(null);
  };

  const handleCommentEdit = () => {
    setLocalEditing(true);
    setLocalEditText(comment.content);
    setLocalEditImages(comment.images || []);
    handleCommentMenuClose();
  };

  const handleCommentDelete = () => {
    onDeleteComment(comment.id);
    handleCommentMenuClose();
  };

  const handleReply = () => {
    setReplyingTo(comment.id);
    setLocalReplying(true);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setLocalReplying(false);
    setLocalReplyText('');
  };

  const handleSubmitReply = async () => {
    if (onAddReply && localReplyText?.trim()) {
      const images = selectedCommentImages[`reply-${comment.id}`] || [];
      await onAddReply(diaryId, comment.id, localReplyText, images);
      setLocalReplying(false);
      setLocalReplyText('');
    }
  };

  const handleCancelEdit = () => {
    setLocalEditing(false);
    setLocalEditText(comment.content);
    setLocalEditImages(comment.images || []);
  };

  const handleSaveEdit = async () => {
    if (!localEditText.trim()) return;
    
    setEditLoading(true);
    try {
      await onEditComment(comment.id, localEditText, localEditImages);
      setLocalEditing(false);
    } catch (err) {
      console.error('Failed to edit comment:', err);
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditImageUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    try {
      const base64Images = await convertFilesToBase64(files);
      const imageUrls = base64Images.map(img => img.data);
      setLocalEditImages(prev => [...prev, ...imageUrls]);
    } catch (err) {
      console.error('Failed to upload images:', err);
    }
  };

  const removeEditImage = (index) => {
    setLocalEditImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{
      mb: 2,
      ml: level > 0 ? 2 : 0,
      borderLeft: level > 0 ? '2px solid #e0e0e0' : 'none',
      pl: level > 0 ? 2 : 0,
      position: 'relative'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Avatar sx={{
          width: level > 0 ? 24 : 28,
          height: level > 0 ? 24 : 28,
          fontSize: level > 0 ? '0.7rem' : '0.8rem',
          flexShrink: 0
        }}>
          {comment.user?.username?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            mb: 0.5
          }}>
            <Typography variant="body2" fontWeight="600" color="green" component="span">
              {comment.user?.username}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="span">
              {formatCambodiaDate(comment.created_at)}
            </Typography>

            {isCommentOwner && !localEditing && (
              <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                <IconButton
                  size="small"
                  onClick={handleCommentMenuOpen}
                  sx={{ minWidth: 'auto', p: 0.5 }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
                <Menu
                  anchorEl={commentMenuAnchorEl}
                  open={commentMenuOpen}
                  onClose={handleCommentMenuClose}
                >
                  <MenuItem onClick={handleCommentEdit}>
                    <EditIcon fontSize="small" sx={{ mr: 1 }} />
                    Edit
                  </MenuItem>
                  <MenuItem onClick={handleCommentDelete}>
                    <DeleteIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
                    <Typography color="error">Delete</Typography>
                  </MenuItem>
                </Menu>
              </Box>
            )}

            {profile && !isTooDeep && !isCommentOwner && !localEditing && (
              <Button
                size="small"
                startIcon={<ReplyIcon fontSize="small" />}
                onClick={handleReply}
                sx={{ minWidth: 'auto', ml: isCommentOwner ? 0 : 'auto' }}
              >
                Reply
              </Button>
            )}
          </Box>

          {localEditing && isCommentOwner ? (
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                value={localEditText}
                onChange={(e) => setLocalEditText(e.target.value)}
                sx={{ mb: 1 }}
                multiline
                rows={2}
                autoFocus
              />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                <Button
                  variant="outlined"
                  component="label"
                  size="small"
                  startIcon={<ImageIcon />}
                >
                  Add Images
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*"
                    onChange={handleEditImageUpload}
                  />
                </Button>
                {localEditImages.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                    {localEditImages.map((img, idx) => (
                      <Box key={idx} sx={{ position: 'relative', width: 40, height: 40 }}>
                        <img
                          src={img}
                          alt={`Edit ${idx}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => removeEditImage(idx)}
                          sx={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            bgcolor: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            width: 16,
                            height: 16,
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveEdit}
                  disabled={editLoading || !localEditText.trim()}
                  startIcon={editLoading ? <CircularProgress size={16} /> : null}
                >
                  {editLoading ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCancelEdit}
                  disabled={editLoading}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                {comment.content}
              </Typography>
              {comment.images && comment.images.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  {comment.images.map((img, idx) => (
                    <Box key={idx} sx={{ position: 'relative' }}>
                      <img
                        src={img}
                        alt={`Comment ${idx + 1}`}
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 4
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}

          {(replyingTo === comment.id || localReplying) && !isTooDeep && !localEditing && (
            <Box sx={{ mb: 2, mt: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={`Reply to ${comment.user?.username}...`}
                value={localReplyText}
                onChange={(e) => setLocalReplyText(e.target.value)}
                sx={{ mb: 1 }}
                multiline
                rows={2}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitReply();
                  }
                }}
              />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  component="label"
                  size="small"
                  startIcon={<ImageIcon />}
                >
                  Add Image
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, null, `reply-${comment.id}`)}
                  />
                </Button>
                {selectedCommentImages[`reply-${comment.id}`]?.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                    {selectedCommentImages[`reply-${comment.id}`].map((img, idx) => (
                      <Box key={idx} sx={{ position: 'relative', width: 40, height: 40 }}>
                        <img
                          src={img}
                          alt={`Reply preview ${idx}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => {
                            const newImages = selectedCommentImages[`reply-${comment.id}`].filter((_, i) => i !== idx);
                            setSelectedCommentImages(prev => ({
                              ...prev,
                              [`reply-${comment.id}`]: newImages
                            }));
                          }}
                          sx={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            bgcolor: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            width: 16,
                            height: 16
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSubmitReply}
                  disabled={!localReplyText?.trim()}
                >
                  Send
                </Button>
                <Button
                  variant="text"
                  size="small"
                  onClick={handleCancelReply}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          )}

          {comment.replies && comment.replies.length > 0 && !isTooDeep && (
            <Box sx={{ mt: 2 }}>
              {comment.replies.map((reply) => (
                <CommentItemWithActions
                  key={reply.id}
                  comment={reply}
                  diaryId={diaryId}
                  profile={profile}
                  onAddReply={onAddReply}
                  level={level + 1}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  handleImageUpload={handleImageUpload}
                  selectedCommentImages={selectedCommentImages}
                  setSelectedCommentImages={setSelectedCommentImages}
                  onEditComment={onEditComment}
                  onDeleteComment={onDeleteComment}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// Main FeedTab component
const FeedTab = ({ diaries, onNewDiary, onDataUpdate, profile, groups }) => {
  const [expandedDiary, setExpandedDiary] = useState(null);
  const [diaryComments, setDiaryComments] = useState({});
  const [diaryLikes, setDiaryLikes] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
  const [likedDiaries, setLikedDiaries] = useState(new Set());
  const [commentLoading, setCommentLoading] = useState({});

  // State for delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [diaryToDelete, setDiaryToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // State for diary edit
  const [editingDiary, setEditingDiary] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editShareType, setEditShareType] = useState('');
  const [editGroupIds, setEditGroupIds] = useState([]);
  const [editImages, setEditImages] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  // State for comment operations
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedCommentImages, setSelectedCommentImages] = useState({});
  const [commentDeleteDialogOpen, setCommentDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [commentDeleteLoading, setCommentDeleteLoading] = useState(false);

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedDiaryForMenu, setSelectedDiaryForMenu] = useState(null);
  const menuOpen = Boolean(menuAnchorEl);

  // Notification state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  // State to force re-render of images
  const [imageUpdateTrigger, setImageUpdateTrigger] = useState(0);

  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Normalize data
  const normalizedDiaries = diaries.map(diary => ({
    ...diary,
    groups: Array.isArray(diary.groups) ? diary.groups : [],
    images: Array.isArray(diary.images) ? diary.images : []
  }));

  const normalizedGroups = Array.isArray(groups) ? groups : [];

  // Show notification message
  const showMessage = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  // Image upload handler
  const handleImageUpload = async (event, diaryId = null, commentId = null) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate files
    const validFiles = Array.from(files).filter(file => {
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      return isValidType && isValidSize;
    });

    if (validFiles.length === 0) {
      showMessage('Please select valid image files (JPG, PNG, GIF, max 5MB each)', 'error');
      return;
    }

    if (validFiles.length > 10) {
      showMessage('Maximum 10 images allowed', 'error');
      return;
    }

    try {
      const base64Images = await convertFilesToBase64(validFiles);
      const imageUrls = base64Images.map(img => img.data);

      if (diaryId && editingDiary === diaryId) {
        // For diary editing
        setEditImages(prev => {
          const newImages = [...prev, ...imageUrls];
          // Trigger re-render
          setImageUpdateTrigger(prev => prev + 1);
          return newImages;
        });
      } else if (commentId) {
        // For comment replies
        setSelectedCommentImages(prev => ({
          ...prev,
          [commentId]: [...(prev[commentId] || []), ...imageUrls]
        }));
      } else if (diaryId) {
        // For new comments
        setSelectedCommentImages(prev => ({
          ...prev,
          [diaryId]: [...(prev[diaryId] || []), ...imageUrls]
        }));
      }

      // Clear file input
      event.target.value = '';
    } catch (err) {
      showMessage('Failed to process images', 'error');
      console.error('Image upload error:', err);
    }
  };

  // Remove image - FIXED VERSION
  const removeImage = (indexToRemove, diaryId = null, commentId = null) => {
    console.log('Removing image at index:', indexToRemove);
    
    if (diaryId && editingDiary === diaryId) {
      // For diary edit images - Create a NEW array reference
      setEditImages(current => {
        const newImages = current.filter((_, index) => index !== indexToRemove);
        console.log('Images after removal:', {
          before: current.length,
          after: newImages.length
        });
        return newImages;
      });
      
      // Force re-render by updating the trigger
      setImageUpdateTrigger(prev => prev + 1);
    } else if (commentId) {
      // For comment images
      setSelectedCommentImages(prev => {
        const currentImages = prev[commentId] || [];
        const newImages = currentImages.filter((_, index) => index !== indexToRemove);
        return {
          ...prev,
          [commentId]: newImages
        };
      });
    } else if (diaryId) {
      // For new comment images
      setSelectedCommentImages(prev => {
        const currentImages = prev[diaryId] || [];
        const newImages = currentImages.filter((_, index) => index !== indexToRemove);
        return {
          ...prev,
          [diaryId]: newImages
        };
      });
    }
  };

  // Menu handlers
  const handleMenuOpen = (event, diary) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedDiaryForMenu(diary);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedDiaryForMenu(null);
  };

  const handleEditDiaryClick = () => {
    if (selectedDiaryForMenu) {
      handleEditClick(selectedDiaryForMenu);
    }
    handleMenuClose();
  };

  const handleDeleteDiaryClick = () => {
    if (selectedDiaryForMenu) {
      handleDeleteClick(selectedDiaryForMenu.id, selectedDiaryForMenu.title);
    }
    handleMenuClose();
  };

  // Diary operations
  const handleDeleteClick = (diaryId, diaryTitle) => {
    setDiaryToDelete({ id: diaryId, title: diaryTitle });
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDiaryToDelete(null);
    setDeleteLoading(false);
  };

  const handleDeleteDiary = async () => {
    if (!diaryToDelete) return;
    
    setDeleteLoading(true);
    try {
      await deleteDiaryById(diaryToDelete.id);
      showMessage('Diary deleted successfully');
      handleDeleteCancel();
      if (onDataUpdate) onDataUpdate();
    } catch (err) {
      showMessage(err.message || 'Failed to delete diary', 'error');
      setDeleteLoading(false);
    }
  };

  const handleEditClick = async (diary) => {
    try {
      const fullDiary = await getDiaryById(diary.id);
      
      // Reset and set with fresh data
      setEditTitle(fullDiary.title || '');
      setEditContent(fullDiary.content || '');
      setEditShareType(fullDiary.share_type || '');
      setEditGroupIds(fullDiary.groups?.map(g => g.id) || []);
      
      // Set images with fresh array
      setEditImages([...(fullDiary.images || [])]);
      
      // Set editing diary last
      setEditingDiary(diary.id);
      
      // Reset image update trigger
      setImageUpdateTrigger(0);
      
      console.log('Edit mode started with:', {
        images: fullDiary.images?.length || 0,
        diaryId: diary.id
      });
    } catch (err) {
      console.error('Failed to fetch diary:', err);
      // Fallback to provided data
      setEditingDiary(diary.id);
      setEditTitle(diary.title || '');
      setEditContent(diary.content || '');
      setEditShareType(diary.share_type || '');
      setEditGroupIds(diary.groups?.map(g => g.id) || []);
      setEditImages([...(diary.images || [])]);
    }
  };

  const handleEditCancel = () => {
    setEditingDiary(null);
    setEditTitle('');
    setEditContent('');
    setEditShareType('');
    setEditGroupIds([]);
    setEditImages([]);
    setEditLoading(false);
    setImageUpdateTrigger(0);
  };

  const handleEditSave = async (diaryId) => {
    if (!editTitle.trim() || !editContent.trim()) {
      showMessage('Title and content are required', 'error');
      return;
    }

    setEditLoading(true);

    try {
      const updateData = {
        title: editTitle.trim(),
        content: editContent.trim(),
        share_type: editShareType.toLowerCase().trim(),
      };

      if (editShareType === 'group') {
        updateData.group_ids = editGroupIds;
      }

      // Always send images array - empty array means remove all images
      updateData.images = editImages;

      console.log('Sending update with:', {
        imagesCount: editImages.length,
        images: editImages
      });

      await updateDiaryById(diaryId, updateData);
      showMessage('Diary updated successfully');
      handleEditCancel();
      if (onDataUpdate) onDataUpdate();
    } catch (err) {
      showMessage(err.message || 'Failed to update diary', 'error');
      setEditLoading(false);
    }
  };

  // Like diary
  const handleLikeDiary = async (diaryId) => {
    try {
      await likeDiary(diaryId);
      const newLikedDiaries = new Set(likedDiaries);
      if (newLikedDiaries.has(diaryId)) {
        newLikedDiaries.delete(diaryId);
        setDiaryLikes(prev => ({
          ...prev,
          [diaryId]: Math.max(0, (prev[diaryId] || 0) - 1)
        }));
      } else {
        newLikedDiaries.add(diaryId);
        setDiaryLikes(prev => ({
          ...prev,
          [diaryId]: (prev[diaryId] || 0) + 1
        }));
      }
      setLikedDiaries(newLikedDiaries);
    } catch (err) {
      showMessage(err.message || 'Failed to like diary', 'error');
    }
  };

  // Add comment
  const handleAddComment = async (diaryId) => {
    const commentText = commentTexts[diaryId] || '';
    if (!commentText.trim()) return;

    setCommentLoading(prev => ({ ...prev, [diaryId]: true }));

    try {
      const images = selectedCommentImages[diaryId] || [];
      const newComment = await commentOnDiary(diaryId, commentText, null, images);

      setDiaryComments(prev => {
        const existingComments = prev[diaryId] || [];
        return {
          ...prev,
          [diaryId]: [...existingComments, newComment]
        };
      });

      setCommentTexts(prev => ({ ...prev, [diaryId]: '' }));
      setSelectedCommentImages(prev => ({ ...prev, [diaryId]: [] }));
      showMessage('Comment added successfully');
    } catch (err) {
      showMessage(err.message || 'Failed to add comment', 'error');
    } finally {
      setCommentLoading(prev => ({ ...prev, [diaryId]: false }));
    }
  };

  // Add reply
  const handleAddReply = async (diaryId, parentCommentId, replyText, images = []) => {
    if (!replyText?.trim()) return;

    try {
      const reply = await commentOnDiary(diaryId, replyText, parentCommentId, images);

      // Update comments state
      setDiaryComments(prev => {
        const updateWithReply = (comments) => {
          return comments.map(comment => {
            if (comment.id === parentCommentId) {
              return {
                ...comment,
                replies: [...(comment.replies || []), reply]
              };
            }
            if (comment.replies) {
              return {
                ...comment,
                replies: updateWithReply(comment.replies)
              };
            }
            return comment;
          });
        };

        return {
          ...prev,
          [diaryId]: updateWithReply(prev[diaryId] || [])
        };
      });

      // Clear reply form
      setSelectedCommentImages(prev => ({ ...prev, [`reply-${parentCommentId}`]: [] }));
      setReplyingTo(null);
      showMessage('Reply added successfully');
    } catch (err) {
      showMessage(err.message || 'Failed to add reply', 'error');
    }
  };

  // Expand diary
  const handleExpandDiary = async (diaryId) => {
    if (expandedDiary === diaryId) {
      setExpandedDiary(null);
      return;
    }

    setExpandedDiary(diaryId);

    try {
      const [comments, likesCount] = await Promise.all([
        getDiaryComments(diaryId).catch(() => []),
        getDiaryLikes(diaryId).catch(() => 0),
      ]);

      setDiaryComments(prev => ({ ...prev, [diaryId]: comments }));
      setDiaryLikes(prev => ({ ...prev, [diaryId]: likesCount }));
    } catch (err) {
      console.error('Failed to fetch diary details:', err);
    }
  };

  // Edit comment
  const handleEditComment = async (commentId, content, images = []) => {
    try {
      const updatedComment = await updateComment(commentId, content, images);
      
      // Update state
      setDiaryComments(prev => {
        const updateCommentRecursive = (comments) => {
          return comments.map(comment => {
            if (comment.id === commentId) {
              return {
                ...updatedComment,
                replies: comment.replies
              };
            }
            if (comment.replies) {
              return {
                ...comment,
                replies: updateCommentRecursive(comment.replies)
              };
            }
            return comment;
          });
        };

        const updatedState = { ...prev };
        Object.keys(updatedState).forEach(diaryId => {
          updatedState[diaryId] = updateCommentRecursive(updatedState[diaryId]);
        });

        return updatedState;
      });

      showMessage('Comment updated successfully');
    } catch (err) {
      showMessage(err.message || 'Failed to update comment', 'error');
      throw err;
    }
  };

  // Comment delete handlers
  const handleCommentDeleteClick = (commentId) => {
    setCommentToDelete(commentId);
    setCommentDeleteDialogOpen(true);
  };

  const handleCommentDeleteCancel = () => {
    setCommentDeleteDialogOpen(false);
    setCommentToDelete(null);
    setCommentDeleteLoading(false);
  };

  const handleDeleteComment = async (commentId) => {
    if (!commentId) return;

    setCommentDeleteLoading(true);

    try {
      await deleteCommentById(commentId);
      
      // Remove from state
      setDiaryComments(prev => {
        const removeCommentRecursive = (comments) => {
          return comments.filter(comment => {
            if (comment.id === commentId) return false;
            if (comment.replies) {
              comment.replies = removeCommentRecursive(comment.replies);
            }
            return true;
          });
        };

        const updatedState = { ...prev };
        Object.keys(updatedState).forEach(diaryId => {
          updatedState[diaryId] = removeCommentRecursive(updatedState[diaryId]);
        });

        return updatedState;
      });

      showMessage('Comment deleted successfully');
    } catch (err) {
      showMessage(err.message || 'Failed to delete comment', 'error');
    } finally {
      handleCommentDeleteCancel();
    }
  };

  // Count all comments
  const countAllComments = (comments) => {
    if (!Array.isArray(comments)) return 0;
    
    let total = 0;
    const countRecursive = (commentList) => {
      commentList.forEach(comment => {
        total += 1;
        if (comment.replies) {
          countRecursive(comment.replies);
        }
      });
    };
    
    countRecursive(comments);
    return total;
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%', overflow: 'hidden' }}>
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Delete Diary Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Diary</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{diaryToDelete?.title}"? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>Cancel</Button>
          <Button
            onClick={handleDeleteDiary}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Comment Dialog */}
      <Dialog open={commentDeleteDialogOpen} onClose={handleCommentDeleteCancel}>
        <DialogTitle>Delete Comment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this comment? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCommentDeleteCancel} disabled={commentDeleteLoading}>Cancel</Button>
          <Button
            onClick={() => handleDeleteComment(commentToDelete)}
            color="error"
            variant="contained"
            disabled={commentDeleteLoading}
            startIcon={commentDeleteLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {commentDeleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diary Options Menu */}
      <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={handleMenuClose}>
        <MenuItem onClick={handleEditDiaryClick}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteDiaryClick}>
          <DeleteIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
          <Typography color="error">Delete</Typography>
        </MenuItem>
      </Menu>

      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' }, 
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' }, 
        gap: 2, 
        mb: 3 
      }}>
        <Typography variant="h5" fontWeight="600">{t('your_feed')}</Typography>
        <Button 
          variant="contained" 
          onClick={onNewDiary} 
          startIcon={<ArticleIcon />} 
          sx={{ borderRadius: '8px' }}
        >
          {isMobile ? t('new') : t('new_diary')}
        </Button>
      </Box>

      {/* Diaries List */}
      {normalizedDiaries.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          {t('no_diaries_yet')}
        </Typography>
      ) : (
        <Box sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {normalizedDiaries.map((diary) => (
            <Card key={diary.id} sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: '12px' }}>
              {/* Diary Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  {editingDiary === diary.id ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        fullWidth
                        label="Title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={editLoading}
                        size="medium"
                      />
                      <TextField
                        fullWidth
                        label="Content"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        disabled={editLoading}
                        multiline
                        rows={4}
                        size="medium"
                      />
                      <FormControl size="medium" fullWidth>
                        <InputLabel>Share Type</InputLabel>
                        <Select
                          value={editShareType}
                          label="Share Type"
                          onChange={(e) => setEditShareType(e.target.value)}
                          disabled={editLoading}
                        >
                          <MenuItem value="public">Public</MenuItem>
                          <MenuItem value="friends">Friends</MenuItem>
                          <MenuItem value="personal">Personal</MenuItem>
                          <MenuItem value="group">Group</MenuItem>
                        </Select>
                      </FormControl>
                      {editShareType === 'group' && (
                        <FormControl size="medium" fullWidth>
                          <InputLabel>Groups</InputLabel>
                          <Select
                            multiple
                            value={editGroupIds}
                            label="Groups"
                            onChange={(e) => setEditGroupIds(e.target.value)}
                            disabled={editLoading}
                          >
                            {normalizedGroups.map((group) => (
                              <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      
                      {/* Image Upload Section for Edit */}
                      <Box>
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={<ImageIcon />}
                          size="medium"
                          disabled={editLoading}
                        >
                          Add Images (Max 10)
                          <input
                            type="file"
                            hidden
                            multiple
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, diary.id)}
                          />
                        </Button>
                      </Box>
                      
                      {/* Image Preview for Edit - FIXED with re-render trigger */}
                      {editImages.length > 0 && (
                        <Box 
                          key={`image-preview-${editImages.length}-${imageUpdateTrigger}`}
                          sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: '8px' }}
                        >
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Images ({editImages.length} / 10)
                          </Typography>
                          <Box sx={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: 1.5,
                            mt: 1 
                          }}>
                            {editImages.map((img, index) => (
                              <Box 
                                key={`edit-img-${diary.id}-${index}-${img.substring(0, 20)}`}
                                sx={{ 
                                  position: 'relative',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: '8px',
                                  overflow: 'hidden'
                                }}
                              >
                                <img
                                  src={img}
                                  alt={`Image ${index + 1}`}
                                  style={{
                                    width: 100,
                                    height: 100,
                                    objectFit: 'cover',
                                    display: 'block'
                                  }}
                                />
                                
                                {/* Remove Button */}
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeImage(index, diary.id);
                                  }}
                                  sx={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    bgcolor: 'error.main',
                                    color: 'white',
                                    width: 28,
                                    height: 28,
                                    '&:hover': {
                                      bgcolor: 'error.dark'
                                    }
                                  }}
                                  size="small"
                                >
                                  <CloseIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                                
                                {/* Image Number */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 4,
                                    left: 4,
                                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: 24,
                                    height: 24,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  {index + 1}
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                      
                      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={handleEditCancel}
                          disabled={editLoading}
                          startIcon={<CancelIcon />}
                          size="medium"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => handleEditSave(diary.id)}
                          disabled={editLoading || !editTitle.trim() || !editContent.trim()}
                          startIcon={editLoading ? <CircularProgress size={24} /> : <SaveIcon />}
                          size="medium"
                        >
                          {editLoading ? 'Saving...' : 'Save'}
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="h6" gutterBottom fontWeight="600">
                        {diary.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" color="green" fontWeight="600">
                          By {diary.author?.username}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatCambodiaDate(diary.created_at)}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>

                {editingDiary !== diary.id && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={diary.share_type}
                      size="small"
                      color={
                        diary.share_type === 'public' ? 'primary' :
                        diary.share_type === 'friends' ? 'secondary' : 'default'
                      }
                    />
                    {profile && diary.author?.id === profile.id && (
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, diary)}
                        sx={{ color: 'text.secondary' }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    )}
                  </Box>
                )}
              </Box>

              {/* Diary Content */}
              {editingDiary !== diary.id && (
                <>
                  <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {diary.content}
                  </Typography>

                  {/* Diary Images */}
                  {diary.images && diary.images.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                      {diary.images.map((img, index) => (
                        <img
                          key={index}
                          src={img}
                          alt={`Diary ${index + 1}`}
                          style={{
                            maxWidth: '100%',
                            maxHeight: 300,
                            borderRadius: 8,
                            objectFit: 'cover'
                          }}
                        />
                      ))}
                    </Box>
                  )}

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 2, mb: expandedDiary === diary.id ? 0 : 2 }}>
                    <Button
                      startIcon={likedDiaries.has(diary.id) ? <Favorite color="error" /> : <FavoriteBorder />}
                      onClick={() => handleLikeDiary(diary.id)}
                      size="medium"
                      sx={{ 
                        color: likedDiaries.has(diary.id) ? 'error.main' : 'inherit',
                        minWidth: '100px'
                      }}
                    >
                      Like {diaryLikes[diary.id] > 0 && `(${diaryLikes[diary.id]})`}
                    </Button>
                    <Button
                      startIcon={<CommentIcon />}
                      onClick={() => handleExpandDiary(diary.id)}
                      size="medium"
                      color={expandedDiary === diary.id ? 'primary' : 'inherit'}
                      sx={{ minWidth: '120px' }}
                    >
                      Comment {diaryComments[diary.id] && `(${countAllComments(diaryComments[diary.id])})`}
                    </Button>
                  </Box>

                  {/* Comments Section */}
                  <Collapse in={expandedDiary === diary.id}>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: '12px' }}>
                      {/* Comment Input */}
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: { xs: 'column', sm: 'row' }, 
                        gap: 1.5, 
                        mb: 2,
                        alignItems: { xs: 'stretch', sm: 'flex-start' }
                      }}>
                        <TextField
                          fullWidth
                          placeholder="Write a comment..."
                          value={commentTexts[diary.id] || ''}
                          onChange={(e) => setCommentTexts(prev => ({ ...prev, [diary.id]: e.target.value }))}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddComment(diary.id);
                            }
                          }}
                          disabled={commentLoading[diary.id]}
                          multiline
                          rows={2}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              fontSize: '0.95rem',
                              borderRadius: '8px',
                            }
                          }}
                        />
                        <Box sx={{ 
                          display: 'flex', 
                          gap: 1, 
                          flexDirection: { xs: 'row', sm: 'column' },
                          width: { xs: '100%', sm: 'auto' }
                        }}>
                          <Button
                            variant="outlined"
                            component="label"
                            disabled={commentLoading[diary.id]}
                            startIcon={<ImageIcon />}
                            sx={{
                              minWidth: { xs: 'auto', sm: '120px' },
                              px: 2,
                              borderRadius: '8px',
                              '& .MuiButton-startIcon': {
                                mr: 1
                              }
                            }}
                            size="medium"
                          >
                            Image
                            <input
                              type="file"
                              hidden
                              multiple
                              accept="image/*"
                              onChange={(e) => handleImageUpload(e, diary.id)}
                            />
                          </Button>
                          <Button
                            variant="contained"
                            onClick={() => handleAddComment(diary.id)}
                            disabled={!commentTexts[diary.id]?.trim() || commentLoading[diary.id]}
                            sx={{
                              minWidth: { xs: 'auto', sm: '120px' },
                              px: 3,
                              borderRadius: '8px',
                              fontWeight: 500
                            }}
                            size="medium"
                          >
                            {commentLoading[diary.id] ? (
                              <CircularProgress size={24} color="inherit" />
                            ) : (
                              'Send'
                            )}
                          </Button>
                        </Box>
                      </Box>

                      {/* Selected Images Preview for Comments */}
                      {selectedCommentImages[diary.id]?.length > 0 && (
                        <Box sx={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: 1, 
                          mb: 2,
                          p: 1,
                          bgcolor: 'background.paper',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: 'divider'
                        }}>
                          {selectedCommentImages[diary.id].map((img, index) => (
                            <Box key={index} sx={{ position: 'relative' }}>
                              <img
                                src={img}
                                alt={`Preview ${index}`}
                                style={{ 
                                  width: 80, 
                                  height: 80, 
                                  objectFit: 'cover', 
                                  borderRadius: 6 
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => removeImage(index, null, diary.id)}
                                sx={{
                                  position: 'absolute',
                                  top: -8,
                                  right: -8,
                                  bgcolor: 'error.main',
                                  color: 'white',
                                  width: 24,
                                  height: 24,
                                  '&:hover': { 
                                    bgcolor: 'error.dark' 
                                  }
                                }}
                              >
                                <CloseIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                          ))}
                        </Box>
                      )}

                      {/* Comments List */}
                      {diaryComments[diary.id]?.length > 0 ? (
                        <Box sx={{ 
                          maxHeight: 300, 
                          overflowY: 'auto',
                          '&::-webkit-scrollbar': {
                            width: '8px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: '#f1f1f1',
                            borderRadius: '4px',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: '#888',
                            borderRadius: '4px',
                          },
                          '&::-webkit-scrollbar-thumb:hover': {
                            background: '#555',
                          }
                        }}>
                          {diaryComments[diary.id].map((comment) => (
                            <CommentItemWithActions
                              key={comment.id}
                              comment={comment}
                              diaryId={diary.id}
                              profile={profile}
                              onAddReply={handleAddReply}
                              handleImageUpload={handleImageUpload}
                              selectedCommentImages={selectedCommentImages}
                              setSelectedCommentImages={setSelectedCommentImages}
                              onEditComment={handleEditComment}
                              onDeleteComment={handleCommentDeleteClick}
                              replyingTo={replyingTo}
                              setReplyingTo={setReplyingTo}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          align="center" 
                          sx={{ 
                            py: 2,
                            fontStyle: 'italic'
                          }}
                        >
                          No comments yet. Be the first to comment!
                        </Typography>
                      )}
                    </Box>
                  </Collapse>
                </>
              )}
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default FeedTab;