// dashboard/FeedTab.jsx
import {
  Article as ArticleIcon,
  Cancel as CancelIcon,
  Comment as CommentIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Favorite,
  FavoriteBorder,
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
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { commentOnDiary, deleteDiaryById, getDiaryById, getDiaryComments, getDiaryLikes, likeDiary, updateDiaryById } from '../../services/api';
import { formatCambodiaDate, formatCambodiaTime } from '../../utils/dateUtils';

const FeedTab = ({ diaries, onNewDiary, setError, setSuccess, onDataUpdate, profile, groups }) => {
  const [expandedDiary, setExpandedDiary] = useState(null);
  const [diaryComments, setDiaryComments] = useState({});
  const [diaryLikes, setDiaryLikes] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
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

  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Normalize diaries to ensure groups is always an array
  const normalizedDiaries = diaries.map(diary => ({
    ...diary,
    groups: Array.isArray(diary.groups) ? diary.groups : []
  }));

  // Normalize groups prop
  const normalizedGroups = Array.isArray(groups) ? groups : [];

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
      // Close dialog
      handleDeleteCancel();

      // Refresh data
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
      // Try to fetch full diary data if needed
      const fullDiary = await getDiaryById(diary.id);

      if (fullDiary) {
        // Use fetched data
        setEditingDiary(diary.id);
        setEditTitle(fullDiary.title || '');
        setEditContent(fullDiary.content || '');
        setEditShareType(fullDiary.share_type || '');
        setEditGroupIds(Array.isArray(fullDiary.groups) ? fullDiary.groups.map(g => g.id) : []);
      } else {
        // Fall back to existing feed data
        console.log('Using existing feed data for editing');
        setEditingDiary(diary.id);
        setEditTitle(diary.title || '');
        setEditContent(diary.content || '');
        setEditShareType(diary.share_type || '');
        setEditGroupIds(Array.isArray(diary.groups) ? diary.groups.map(g => g.id) : []);
      }
    } catch (err) {
      console.error('Failed to fetch diary details:', err);
      // Use existing data if fetch fails
      setEditingDiary(diary.id);
      setEditTitle(diary.title || '');
      setEditContent(diary.content || '');
      setEditShareType(diary.share_type || '');
      setEditGroupIds(Array.isArray(diary.groups) ? diary.groups.map(g => g.id) : []);
    }
  };

  const handleEditCancel = () => {
    setEditingDiary(null);
    setEditTitle('');
    setEditContent('');
    setEditShareType('');
    setEditGroupIds([]);
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

      // Only add share_type if it's changed or different from current
      if (editShareType) {
        updateData.share_type = editShareType;
      }

      // Debug log
      console.log('📤 Sending update request:', {
        diaryId,
        updateData,
        share_type_value: editShareType,
        share_type_type: typeof editShareType
      });

      // Only include group_ids if share_type is group
      if (editShareType === 'group') {
        updateData.group_ids = editGroupIds;
      }

      const response = await updateDiaryById(diaryId, updateData);
      console.log('✅ Update successful:', response);

      setSuccess('Diary updated successfully');
      setTimeout(() => {
        setSuccess('');
      }, 2000);

      handleEditCancel();

      // Refresh data
      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (err) {
      console.error('❌ Update error:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
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
      const newComment = await commentOnDiary(diaryId, commentText);
      setDiaryComments(prev => ({
        ...prev,
        [diaryId]: [...(prev[diaryId] || []), newComment]
      }));
      setCommentTexts(prev => ({ ...prev, [diaryId]: '' }));
      setSuccess('Comment added successfully');
    } catch (err) {
      setError(err.message || 'Failed to add comment');
    } finally {
      setCommentLoading(prev => ({ ...prev, [diaryId]: false }));
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
        // Scrollable container
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
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  }}>
                    {diary.content}
                  </Typography>

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
                      {diaryComments[diary.id]?.length > 0 && ` (${diaryComments[diary.id].length})`}
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

                      {diaryComments[diary.id]?.length > 0 ? (
                        <List sx={{
                          maxHeight: 200,
                          overflow: 'auto',
                          py: 0
                        }}>
                          {diaryComments[diary.id].map((comment) => (
                            <ListItem key={comment.id} sx={{
                              px: { xs: 0, sm: 0 },
                              py: 1
                            }}>
                              <ListItemAvatar>
                                <Avatar sx={{
                                  width: { xs: 28, sm: 32 },
                                  height: { xs: 28, sm: 32 },
                                  fontSize: { xs: '0.7rem', sm: '0.8rem' }
                                }}>
                                  {comment.user?.username?.charAt(0)?.toUpperCase() || 'U'}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Box sx={{
                                    display: 'flex',
                                    flexDirection: { xs: 'column', sm: 'row' },
                                    alignItems: { xs: 'flex-start', sm: 'center' },
                                    gap: { xs: 0.5, sm: 1 }
                                  }}>
                                    <Typography variant="body2" component="span" fontWeight="600" color='green'>
                                      {comment.user?.username || `User ${comment.user_id}`}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatCambodiaTime(comment.created_at)}
                                    </Typography>
                                  </Box>
                                }
                                secondary={
                                  <Typography variant="body2" sx={{
                                    mt: 0.5,
                                    lineHeight: 1.5,
                                    fontSize: { xs: '0.8rem', sm: '0.875rem' }
                                  }}>
                                    {comment.content}
                                  </Typography>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
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