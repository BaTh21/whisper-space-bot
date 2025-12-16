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
  MenuItem,
  Select,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { commentOnDiary, deleteCommentById, deleteDiaryById, getDiaryById, getDiaryComments, getDiaryLikes, likeDiary, updateComment, updateDiaryById } from '../../services/api';
import { formatCambodiaDate } from '../../utils/dateUtils';

// Simple CommentItem component without edit/delete
const CommentItem = ({
  comment,
  diaryId,
  profile,
  onAddReply,
  level = 0,
  replyingTo,
  setReplyingTo,
  replyTexts,
  setReplyTexts,
  handleImageUpload,
  selectedCommentImages
}) => {
  const [localReplying, setLocalReplying] = useState(false);

  const handleReply = () => {
    setReplyingTo(comment.id);
    setLocalReplying(true);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setLocalReplying(false);
    setReplyTexts(prev => ({ ...prev, [comment.id]: '' }));
  };

  const handleSubmitReply = () => {
    if (onAddReply && replyTexts[comment.id]?.trim()) {
      onAddReply(diaryId, comment.id);
      setLocalReplying(false);
    }
  };

  // Limit nesting depth for visual clarity
  const maxDepth = 5;
  const isTooDeep = level >= maxDepth;

  return (
    <Box sx={{
      mb: 2,
      ml: level > 0 ? 2 : 0,
      borderLeft: level > 0 ? '2px solid #e0e0e0' : 'none',
      pl: level > 0 ? 2 : 0,
      position: 'relative'
    }}>
      {/* Comment header */}
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

            {/* Reply button (only show if not too deep) */}
            {profile && !isTooDeep && (
              <Button
                size="small"
                startIcon={<ReplyIcon fontSize="small" />}
                onClick={handleReply}
                sx={{ minWidth: 'auto', ml: 'auto' }}
              >
                Reply
              </Button>
            )}
          </Box>

          {/* Comment content */}
          <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
            {comment.content}
          </Typography>

          {/* Comment images */}
          {comment.images && comment.images.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              {comment.images.map((img, idx) => (
                <Box key={idx} sx={{ position: 'relative' }}>
                  <img
                    src={img}
                    alt={`Comment image ${idx + 1}`}
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

          {/* Reply form */}
          {(replyingTo === comment.id || localReplying) && !isTooDeep && (
            <Box sx={{ mb: 2, mt: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={`Reply to ${comment.user?.username}...`}
                value={replyTexts[comment.id] || ''}
                onChange={(e) => setReplyTexts(prev => ({
                  ...prev,
                  [comment.id]: e.target.value
                }))}
                sx={{ mb: 1 }}
                multiline
                rows={2}
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

                {/* Show selected images for reply */}
                {selectedCommentImages[`reply-${comment.id}`]?.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                    {selectedCommentImages[`reply-${comment.id}`].map((img, idx) => (
                      <Box key={idx} sx={{ position: 'relative', width: 40, height: 40 }}>
                        <img
                          src={img}
                          alt={`Preview ${idx}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => {
                            const newImages = [...selectedCommentImages[`reply-${comment.id}`]];
                            newImages.splice(idx, 1);
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

                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSubmitReply}
                  disabled={!replyTexts[comment.id]?.trim()}
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

          {/* Nested replies */}
          {comment.replies && comment.replies.length > 0 && !isTooDeep && (
            <Box sx={{ mt: 2 }}>
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  diaryId={diaryId}
                  profile={profile}
                  onAddReply={onAddReply}
                  level={level + 1}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  replyTexts={replyTexts}
                  setReplyTexts={setReplyTexts}
                  handleImageUpload={handleImageUpload}
                  selectedCommentImages={selectedCommentImages}
                />
              ))}
            </Box>
          )}

          {/* If too deep, show a message */}
          {isTooDeep && comment.replies && comment.replies.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {comment.replies.length} more repl{comment.replies.length === 1 ? 'y' : 'ies'} (depth limited)
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// Main FeedTab component
const FeedTab = ({ diaries, onNewDiary, setError, setSuccess, onDataUpdate, profile, groups }) => {
  const [expandedDiary, setExpandedDiary] = useState(null);
  const [diaryComments, setDiaryComments] = useState({});
  const [diaryLikes, setDiaryLikes] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
  const [replyTexts, setReplyTexts] = useState({});
  const [likedDiaries, setLikedDiaries] = useState(new Set());
  const [commentLoading, setCommentLoading] = useState({});

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [diaryToDelete, setDiaryToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // State for edit functionality
  const [editingDiary, setEditingDiary] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editShareType, setEditShareType] = useState('');
  const [editGroupIds, setEditGroupIds] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  // Comment edit state
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [editCommentImages, setEditCommentImages] = useState([]);
  const [editCommentLoading, setEditCommentLoading] = useState(false);

  // State for images and replies
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedCommentImages, setSelectedCommentImages] = useState({});

  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Handle unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Normalize diaries to ensure groups is always an array
  const normalizedDiaries = diaries.map(diary => ({
    ...diary,
    groups: Array.isArray(diary.groups) ? diary.groups : [],
    images: Array.isArray(diary.images) ? diary.images : []
  }));

  // Normalize groups prop
  const normalizedGroups = Array.isArray(groups) ? groups : [];

  // Handler functions
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
      setSuccess('Diary deleted successfully');
      setTimeout(() => {
        setSuccess('');
      }, 2000);
      handleDeleteCancel();

      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete diary');
      setDeleteLoading(false);
    }
  };

  const handleEditClick = async (diary) => {
    try {
      const fullDiary = await getDiaryById(diary.id);

      if (fullDiary) {
        setEditingDiary(diary.id);
        setEditTitle(fullDiary.title || '');
        setEditContent(fullDiary.content || '');
        setEditShareType(fullDiary.share_type || '');
        setEditGroupIds(Array.isArray(fullDiary.groups) ? fullDiary.groups.map(g => g.id) : []);
        setSelectedImages(fullDiary.images || []);
      } else {
        setEditingDiary(diary.id);
        setEditTitle(diary.title || '');
        setEditContent(diary.content || '');
        setEditShareType(diary.share_type || '');
        setEditGroupIds(Array.isArray(diary.groups) ? diary.groups.map(g => g.id) : []);
        setSelectedImages(diary.images || []);
      }
    } catch (err) {
      console.error('Failed to fetch diary details:', err);
      setEditingDiary(diary.id);
      setEditTitle(diary.title || '');
      setEditContent(diary.content || '');
      setEditShareType(diary.share_type || '');
      setEditGroupIds(Array.isArray(diary.groups) ? diary.groups.map(g => g.id) : []);
      setSelectedImages(diary.images || []);
    }
  };

  const handleEditCancel = () => {
    setEditingDiary(null);
    setEditTitle('');
    setEditContent('');
    setEditShareType('');
    setEditGroupIds([]);
    setSelectedImages([]);
    setEditLoading(false);
  };

  const handleEditSave = async (diaryId) => {
    if (!editTitle.trim() || !editContent.trim()) {
      setError('Title and content are required');
      return;
    }

    setEditLoading(true);

    try {
      const updateData = {
        title: editTitle.trim(),
        content: editContent.trim(),
      };

      if (editShareType) {
        updateData.share_type = editShareType;
      }

      if (editShareType === 'group') {
        updateData.group_ids = editGroupIds;
      }

      if (selectedImages.length > 0) {
        updateData.images = selectedImages;
      }

      await updateDiaryById(diaryId, updateData);

      setSuccess('Diary updated successfully');
      setTimeout(() => {
        setSuccess('');
      }, 2000);

      handleEditCancel();

      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (err) {
      console.error('Update error:', err);
      setError(err.message || 'Failed to update diary');
      setEditLoading(false);
    }
  };

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
      setError(err.message || 'Failed to like diary');
    }
  };

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

      setSuccess('Comment added successfully');
      setTimeout(() => {
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to add comment');
    } finally {
      setCommentLoading(prev => ({ ...prev, [diaryId]: false }));
    }
  };

  const handleAddReply = async (diaryId, parentCommentId, replyText) => {
    if (!replyText?.trim()) return;

    try {
      const images = selectedCommentImages[`reply-${parentCommentId}`] || [];
      const reply = await commentOnDiary(diaryId, replyText, parentCommentId, images);

      // Update comments with the new reply
      setDiaryComments(prev => {
        const updatedComments = [...(prev[diaryId] || [])];

        // Helper function to find and update comment recursively
        const updateCommentWithReply = (comments, targetId, newReply) => {
          return comments.map(comment => {
            if (comment.id === targetId) {
              return {
                ...comment,
                replies: [...(comment.replies || []), newReply]
              };
            }
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: updateCommentWithReply(comment.replies, targetId, newReply)
              };
            }
            return comment;
          });
        };

        return {
          ...prev,
          [diaryId]: updateCommentWithReply(updatedComments, parentCommentId, reply)
        };
      });

      // Clear reply form
      setSelectedCommentImages(prev => ({ ...prev, [`reply-${parentCommentId}`]: [] }));
      setReplyingTo(null);

      setSuccess('Reply added successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || 'Failed to add reply');
    }
  };

  const handleExpandDiary = async (diaryId) => {
    if (!diaryId) return;

    setExpandedDiary(expandedDiary === diaryId ? null : diaryId);

    if (expandedDiary !== diaryId) {
      try {
        const [comments, likesCount] = await Promise.all([
          getDiaryComments(diaryId).catch(() => []),
          getDiaryLikes(diaryId).catch(() => 0),
        ]);

        setDiaryComments(prev => ({
          ...prev,
          [diaryId]: comments
        }));

        setDiaryLikes(prev => ({
          ...prev,
          [diaryId]: likesCount
        }));
      } catch (err) {
        console.error('Failed to fetch diary details:', err);
      }
    }
  };

  const handleCommentTextChange = (diaryId, text) => {
    setCommentTexts(prev => ({
      ...prev,
      [diaryId]: text
    }));
  };

  const handleImageUpload = (event, diaryId = null, commentId = null) => {
    const files = Array.from(event.target.files);
    const validImages = files.filter(file =>
      file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024
    );

    if (validImages.length === 0) {
      setError('Please select valid image files (max 5MB each)');
      return;
    }

    const imagePromises = validImages.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target.result);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(imagePromises).then(base64Images => {
      if (diaryId && editingDiary === diaryId) {
        setSelectedImages(prev => [...prev, ...base64Images]);
      } else if (commentId) {
        setSelectedCommentImages(prev => ({
          ...prev,
          [commentId]: [...(prev[commentId] || []), ...base64Images]
        }));
      }
    });
  };

  const removeImage = (index, diaryId = null, commentId = null) => {
    if (diaryId && editingDiary === diaryId) {
      setSelectedImages(prev => prev.filter((_, i) => i !== index));
    } else if (commentId) {
      setSelectedCommentImages(prev => ({
        ...prev,
        [commentId]: prev[commentId].filter((_, i) => i !== index)
      }));
    }
  };

  const countAllComments = (comments) => {
    if (!comments || !Array.isArray(comments)) return 0;

    let total = 0;

    const countRecursive = (commentList) => {
      commentList.forEach(comment => {
        total += 1; // Count this comment
        if (comment.replies && comment.replies.length > 0) {
          countRecursive(comment.replies); // Recursively count replies
        }
      });
    };

    countRecursive(comments);
    return total;
  };

  // Handle edit comment
  const handleEditComment = async (commentId, content, images = []) => {
    try {
      setEditCommentLoading(true);

      // Find which diary this comment belongs to
      let targetDiaryId = null;
      for (const [diaryId, comments] of Object.entries(diaryComments)) {
        const findComment = (commentList, id) => {
          for (const comment of commentList) {
            if (comment.id === id) return true;
            if (comment.replies && comment.replies.length > 0) {
              if (findComment(comment.replies, id)) return true;
            }
          }
          return false;
        };

        if (findComment(comments, commentId)) {
          targetDiaryId = diaryId;
          break;
        }
      }

      if (!targetDiaryId) {
        setError('Comment not found');
        return;
      }

      // Call the API to update comment
      const updatedComment = await updateComment(commentId, content, images);

      // Update the comments state
      setDiaryComments(prev => {
        const updatedComments = [...(prev[targetDiaryId] || [])];

        // Helper function to update comment recursively
        const updateCommentRecursive = (comments, targetId, updatedData) => {
          return comments.map(comment => {
            if (comment.id === targetId) {
              return {
                ...comment,
                content: updatedData.content,
                images: updatedData.images || [],
                updated_at: updatedData.updated_at
              };
            }
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: updateCommentRecursive(comment.replies, targetId, updatedData)
              };
            }
            return comment;
          });
        };

        return {
          ...prev,
          [targetDiaryId]: updateCommentRecursive(updatedComments, commentId, updatedComment)
        };
      });

      setEditingCommentId(null);
      setEditCommentText('');
      setEditCommentImages([]);

      setSuccess('Comment updated successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || 'Failed to update comment');
    } finally {
      setEditCommentLoading(false);
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId) => {
    try {
      // Find which diary this comment belongs to
      let targetDiaryId = null;
      for (const [diaryId, comments] of Object.entries(diaryComments)) {
        const findComment = (commentList, id) => {
          for (const comment of commentList) {
            if (comment.id === id) return true;
            if (comment.replies && comment.replies.length > 0) {
              if (findComment(comment.replies, id)) return true;
            }
          }
          return false;
        };

        if (findComment(comments, commentId)) {
          targetDiaryId = diaryId;
          break;
        }
      }

      if (!targetDiaryId) {
        setError('Comment not found');
        return;
      }

      // Call the API to delete comment
      await deleteCommentById(commentId);

      // Update the comments state
      setDiaryComments(prev => {
        const updatedComments = [...(prev[targetDiaryId] || [])];

        // Helper function to remove comment recursively
        const removeCommentRecursive = (comments, targetId) => {
          return comments.filter(comment => {
            if (comment.id === targetId) return false;
            if (comment.replies && comment.replies.length > 0) {
              comment.replies = removeCommentRecursive(comment.replies, targetId);
            }
            return true;
          });
        };

        return {
          ...prev,
          [targetDiaryId]: removeCommentRecursive(updatedComments, commentId)
        };
      });

      setSuccess('Comment deleted successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || 'Failed to delete comment');
    }
  };

  // Enhanced CommentItemWithActions component with edit/delete
  const CommentItemWithActions = ({
    comment,
    diaryId,
    profile,
    onAddReply,
    level = 0,
    replyingTo,
    setReplyingTo,
    replyTexts,
    setReplyTexts,
    handleImageUpload,
    selectedCommentImages
  }) => {
    const [localReplying, setLocalReplying] = useState(false);
    const [localEditing, setLocalEditing] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [localEditText, setLocalEditText] = useState(comment.content);
    const [localEditImages, setLocalEditImages] = useState(comment.images || []);
    const [localReplyText, setLocalReplyText] = useState('');

    // Check if current user is the comment owner
    const isCommentOwner = profile && comment.user?.id === profile.id;

    const handleReply = () => {
      setReplyingTo(comment.id);
      setLocalReplying(true);
    };

    const handleCancelReply = () => {
      setReplyingTo(null);
      setLocalReplying(false);
      setLocalReplyText('');
    };

    const handleSubmitReply = () => {
      if (onAddReply && localReplyText?.trim()) {
        onAddReply(diaryId, comment.id, localReplyText);
        setLocalReplying(false);
        setLocalReplyText('');
      }
    };

    const handleEdit = () => {
      setEditingCommentId(comment.id);
      setLocalEditText(comment.content);
      setLocalEditImages(comment.images || []);
      setLocalEditing(true);
    };

    const handleCancelEdit = () => {
      setEditingCommentId(null);
      setLocalEditText(comment.content);
      setLocalEditImages(comment.images || []);
      setLocalEditing(false);
    };

    const handleSaveEdit = async () => {
      if (!localEditText.trim()) {
        setError('Comment cannot be empty');
        return;
      }

      setEditLoading(true);
      try {
        await handleEditComment(comment.id, localEditText, localEditImages);
        setEditingCommentId(null);
        setLocalEditing(false);
      } catch (err) {
        setError(err.message || 'Failed to update comment');
      } finally {
        setEditLoading(false);
      }
    };

    const handleDelete = () => {
      if (window.confirm('Are you sure you want to delete this comment?')) {
        handleDeleteComment(comment.id);
      }
    };

    // Handle image upload for edit
    const handleEditImageUpload = (event) => {
      const files = Array.from(event.target.files);
      const validImages = files.filter(file =>
        file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024
      );

      if (validImages.length === 0) {
        setError('Please select valid image files (max 5MB each)');
        return;
      }

      const imagePromises = validImages.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve(e.target.result);
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(imagePromises).then(base64Images => {
        setLocalEditImages(prev => [...prev, ...base64Images]);
      });
    };

    const removeEditImage = (index) => {
      setLocalEditImages(prev => prev.filter((_, i) => i !== index));
    };

    // Limit nesting depth for visual clarity
    const maxDepth = 5;
    const isTooDeep = level >= maxDepth;

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

              {/* Action buttons - Only show for comment owner */}
              {isCommentOwner && editingCommentId !== comment.id && !localEditing && (
                <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                  <IconButton
                    size="small"
                    onClick={handleEdit}
                    sx={{
                      minWidth: 'auto',
                      p: 0.5,
                      color: 'primary.main'
                    }}
                    title="Edit"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleDelete}
                    sx={{
                      minWidth: 'auto',
                      p: 0.5,
                      color: 'error.main'
                    }}
                    title="Delete"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}

              {/* Reply button (only show if not too deep) */}
              {profile && !isTooDeep && !isCommentOwner && editingCommentId !== comment.id && !localEditing && (
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

            {/* Edit mode */}
            {(editingCommentId === comment.id || localEditing) && isCommentOwner ? (
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

                {/* Edit image upload */}
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

                  {/* Show selected edit images */}
                  {localEditImages.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                      {localEditImages.map((img, idx) => (
                        <Box key={idx} sx={{ position: 'relative', width: 40, height: 40 }}>
                          <img
                            src={img}
                            alt={`Edit preview ${idx}`}
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
                {/* Comment content */}
                <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                  {comment.content}
                </Typography>

                {/* Comment images */}
                {comment.images && comment.images.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    {comment.images.map((img, idx) => (
                      <Box key={idx} sx={{ position: 'relative' }}>
                        <img
                          src={img}
                          alt={`Comment image ${idx + 1}`}
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

            {/* Reply form */}
            {(replyingTo === comment.id || localReplying) && !isTooDeep && editingCommentId !== comment.id && !localEditing && (
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

                  {/* Show selected images for reply */}
                  {selectedCommentImages[`reply-${comment.id}`]?.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                      {selectedCommentImages[`reply-${comment.id}`].map((img, idx) => (
                        <Box key={idx} sx={{ position: 'relative', width: 40, height: 40 }}>
                          <img
                            src={img}
                            alt={`Preview ${idx}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => {
                              const newImages = [...selectedCommentImages[`reply-${comment.id}`]];
                              newImages.splice(idx, 1);
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

            {/* Nested replies */}
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
                    replyTexts={replyTexts}
                    setReplyTexts={setReplyTexts}
                    handleImageUpload={handleImageUpload}
                    selectedCommentImages={selectedCommentImages}
                  />
                ))}
              </Box>
            )}

            {/* If too deep, show a message */}
            {isTooDeep && comment.replies && comment.replies.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {comment.replies.length} more repl{comment.replies.length === 1 ? 'y' : 'ies'} (depth limited)
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3 },
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Diary
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the diary "{diaryToDelete?.title}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDeleteCancel}
            color="primary"
            disabled={deleteLoading}
          >
            Cancel
          </Button>
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

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 2, sm: 0 },
          mb: 3,
        }}
      >
        <Typography
          variant="h5"
          fontWeight="600"
          sx={{ textAlign: { xs: 'center', sm: 'left' } }}
        >
          {t('your_feed')}
        </Typography>
        <Button
          variant="contained"
          onClick={onNewDiary}
          startIcon={<ArticleIcon />}
          sx={{
            borderRadius: '8px',
            minWidth: { xs: '100%', sm: 'auto' },
          }}
          size={isMobile ? 'small' : 'medium'}
        >
          {isMobile ? t('new') : t('new_diary')}
        </Button>
      </Box>

      {normalizedDiaries.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          {t('no_diaries_yet')}
        </Typography>
      ) : (
        <Box
          sx={{
            maxHeight: '70vh',
            overflowY: 'auto',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {normalizedDiaries.map((diary) => (
            <Card key={diary.id} sx={{
              p: { xs: 2, sm: 3 },
              mb: 2,
              borderRadius: '12px',
              mx: { xs: 0, sm: 0 },
              position: 'relative'
            }}>
              <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'flex-start' },
                gap: { xs: 1, sm: 0 },
                mb: 2
              }}>
                <Box sx={{ flex: 1 }}>
                  {editingDiary === diary.id ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        fullWidth
                        label="Title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={editLoading}
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Content"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        disabled={editLoading}
                        multiline
                        rows={3}
                        size="small"
                      />
                      <FormControl size="small" fullWidth>
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
                        <FormControl size="small" fullWidth>
                          <InputLabel>Groups</InputLabel>
                          <Select
                            multiple
                            value={editGroupIds}
                            label="Groups"
                            onChange={(e) => setEditGroupIds(e.target.value)}
                            disabled={editLoading}
                          >
                            {normalizedGroups.map((group) => (
                              <MenuItem key={group.id} value={group.id}>
                                {group.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      <Box>
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={<ImageIcon />}
                          size="small"
                          disabled={editLoading}
                        >
                          Add Images
                          <input
                            type="file"
                            hidden
                            multiple
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, diary.id)}
                          />
                        </Button>
                      </Box>
                      {selectedImages.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                          {selectedImages.map((img, index) => (
                            <Box key={index} sx={{ position: 'relative' }}>
                              <img
                                src={img}
                                alt={`Preview ${index}`}
                                style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4 }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => removeImage(index, diary.id)}
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  right: 0,
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  color: 'white',
                                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                                }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ))}
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                          variant="outlined"
                          onClick={handleEditCancel}
                          disabled={editLoading}
                          startIcon={<CancelIcon />}
                          size="small"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => handleEditSave(diary.id)}
                          disabled={editLoading || !editTitle.trim() || !editContent.trim()}
                          startIcon={editLoading ? <CircularProgress size={20} /> : <SaveIcon />}
                          size="small"
                        >
                          {editLoading ? 'Saving...' : 'Save'}
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="h6" gutterBottom fontWeight="600" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                        {diary.title}
                      </Typography>
                      <Box sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: { xs: 0.5, sm: 1 }
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ color: 'green', fontWeight: '600' }}>
                          By {diary.author?.username || ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                          •
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatCambodiaDate(diary.created_at)}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  {editingDiary !== diary.id && (
                    <>
                      <Chip
                        label={diary.share_type}
                        size="small"
                        color={
                          diary.share_type === 'public' ? 'primary' :
                            diary.share_type === 'friends' ? 'secondary' : 'default'
                        }
                        sx={{
                          borderRadius: '8px',
                          mt: { xs: 1, sm: 0 },
                          alignSelf: { xs: 'flex-start', sm: 'auto' }
                        }}
                      />

                      {profile && diary.author?.id === profile.id && (
                        <>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditClick(diary)}
                            sx={{
                              backgroundColor: 'rgba(33, 150, 243, 0.1)',
                              '&:hover': {
                                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                              }
                            }}
                            title="Edit diary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(diary.id, diary.title)}
                            sx={{
                              backgroundColor: 'rgba(244, 67, 54, 0.1)',
                              '&:hover': {
                                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                              }
                            }}
                            title="Delete diary"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </>
                  )}
                </Box>
              </Box>

              {editingDiary !== diary.id && (
                <>
                  <Typography variant="body1" sx={{
                    mb: 3,
                    lineHeight: 1.6,
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                    whiteSpace: 'pre-wrap'
                  }}>
                    {diary.content}
                  </Typography>

                  {diary.images && diary.images.length > 0 && (
                    <Box sx={{ mt: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {diary.images.map((img, index) => (
                        <img
                          key={index}
                          src={img}
                          alt={`Diary image ${index + 1}`}
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

                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1, sm: 2 },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    mb: expandedDiary === diary.id ? 0 : 2
                  }}>
                    <Button
                      startIcon={likedDiaries.has(diary.id) ? <Favorite color="error" /> : <FavoriteBorder />}
                      onClick={() => handleLikeDiary(diary.id)}
                      color={likedDiaries.has(diary.id) ? 'error' : 'inherit'}
                      size="small"
                      sx={{
                        minWidth: 'auto',
                        color: likedDiaries.has(diary.id) ? 'error.main' : 'text.secondary',
                        borderRadius: '8px',
                        justifyContent: { xs: 'flex-start', sm: 'center' }
                      }}
                    >
                      {likedDiaries.has(diary.id) ? 'Liked' : 'Like'}
                      {(diaryLikes[diary.id] > 0) && ` (${diaryLikes[diary.id]})`}
                    </Button>

                    <Button
                      startIcon={<CommentIcon />}
                      onClick={() => handleExpandDiary(diary.id)}
                      size="small"
                      color={expandedDiary === diary.id ? 'primary' : 'inherit'}
                      sx={{
                        minWidth: 'auto',
                        borderRadius: '8px',
                        justifyContent: { xs: 'flex-start', sm: 'center' }
                      }}
                    >
                      Comment
                      {diaryComments[diary.id] && ` (${countAllComments(diaryComments[diary.id])})`}
                    </Button>
                  </Box>

                  <Collapse in={expandedDiary === diary.id}>
                    <Box sx={{
                      mt: 2,
                      p: { xs: 1.5, sm: 2 },
                      bgcolor: 'grey.50',
                      borderRadius: '12px'
                    }}>
                      <Box sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: 1,
                        mb: 2
                      }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Write a comment..."
                          value={commentTexts[diary.id] || ''}
                          onChange={(e) => handleCommentTextChange(diary.id, e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddComment(diary.id);
                            }
                          }}
                          disabled={commentLoading[diary.id]}
                          sx={{ borderRadius: '8px' }}
                        />

                        <Button
                          variant="outlined"
                          component="label"
                          disabled={commentLoading[diary.id]}
                          sx={{ minWidth: 'auto' }}
                        >
                          <ImageIcon />
                          <input
                            type="file"
                            hidden
                            multiple
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, null, diary.id)}
                          />
                        </Button>

                        <Button
                          variant="contained"
                          onClick={() => handleAddComment(diary.id)}
                          disabled={!commentTexts[diary.id]?.trim() || commentLoading[diary.id]}
                          sx={{
                            minWidth: { xs: '100%', sm: '60px' },
                            borderRadius: '8px'
                          }}
                        >
                          {commentLoading[diary.id] ? <CircularProgress size={20} /> : <SendIcon />}
                        </Button>
                      </Box>

                      {selectedCommentImages[diary.id]?.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                          {selectedCommentImages[diary.id].map((img, index) => (
                            <Box key={index} sx={{ position: 'relative' }}>
                              <img
                                src={img}
                                alt={`Preview ${index}`}
                                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => removeImage(index, null, diary.id)}
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  right: 0,
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  color: 'white',
                                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                                }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ))}
                        </Box>
                      )}

                      {diaryComments[diary.id]?.length > 0 ? (
                        <Box sx={{ maxHeight: 200, overflowY: 'auto', py: 0 }}>
                          {diaryComments[diary.id].map((comment) => (
                            <CommentItemWithActions
                              key={comment.id}
                              comment={comment}
                              diaryId={diary.id}
                              profile={profile}
                              onAddReply={handleAddReply}
                              level={0}
                              replyingTo={replyingTo}
                              setReplyingTo={setReplyingTo}
                              replyTexts={replyTexts}
                              setReplyTexts={setReplyTexts}
                              handleImageUpload={handleImageUpload}
                              selectedCommentImages={selectedCommentImages}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
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