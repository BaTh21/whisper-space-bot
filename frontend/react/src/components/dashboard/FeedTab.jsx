import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  Chip,
  Collapse,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  CircularProgress
} from '@mui/material';
import { Article as ArticleIcon, Favorite, FavoriteBorder, Comment as CommentIcon, Send as SendIcon } from '@mui/icons-material';
import { likeDiary, commentOnDiary, getDiaryComments, getDiaryLikes } from '../../services/api';
import { formatCambodiaDate, formatCambodiaTime } from '../../utils/dateUtils';

const FeedTab = ({ diaries, profile, onNewDiary, setError, setSuccess }) => {
  const [expandedDiary, setExpandedDiary] = useState(null);
  const [diaryComments, setDiaryComments] = useState({});
  const [diaryLikes, setDiaryLikes] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
  const [likedDiaries, setLikedDiaries] = useState(new Set());
  const [commentLoading, setCommentLoading] = useState({});

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
        const [comments, likes] = await Promise.all([
          getDiaryComments(diaryId).catch(() => []),
          getDiaryLikes(diaryId).catch(() => []),
        ]);

        setDiaryComments(prev => ({
          ...prev,
          [diaryId]: comments
        }));

        setDiaryLikes(prev => ({
          ...prev,
          [diaryId]: Array.isArray(likes) ? likes.length : (likes || 0)
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="600">Your Feed</Typography>
        <Button
          variant="contained"
          onClick={onNewDiary}
          startIcon={<ArticleIcon />}
          sx={{ borderRadius: '8px' }}
        >
          New Diary
        </Button>
      </Box>

      {diaries.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          No diaries in your feed yet. Create one or follow more friends!
        </Typography>
      ) : (
        diaries.map((diary) => (
          <Card key={diary.id} sx={{ p: 3, mb: 2, borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="h6" gutterBottom fontWeight="600">
                  {diary.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ color: 'green', fontWeight: '600' }}>
                    By {diary.author?.username || ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • {formatCambodiaDate(diary.created_at)}
                  </Typography>
                </Box>
              </Box>
              <Chip
                label={diary.share_type}
                size="small"
                color={
                  diary.share_type === 'public' ? 'primary' :
                  diary.share_type === 'friends' ? 'secondary' : 'default'
                }
                sx={{ borderRadius: '8px' }}
              />
            </Box>

            <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
              {diary.content}
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: expandedDiary === diary.id ? 0 : 2 }}>
              <Button
                startIcon={likedDiaries.has(diary.id) ? <Favorite color="error" /> : <FavoriteBorder />}
                onClick={() => handleLikeDiary(diary.id)}
                color={likedDiaries.has(diary.id) ? 'error' : 'inherit'}
                size="small"
                sx={{
                  minWidth: 'auto',
                  color: likedDiaries.has(diary.id) ? 'error.main' : 'text.secondary',
                  borderRadius: '8px'
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
                sx={{ minWidth: 'auto', borderRadius: '8px' }}
              >
                Comment
                {diaryComments[diary.id]?.length > 0 && ` (${diaryComments[diary.id].length})`}
              </Button>
            </Box>

            <Collapse in={expandedDiary === diary.id}>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: '12px' }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
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
                    sx={{ minWidth: '60px', borderRadius: '8px' }}
                  >
                    {commentLoading[diary.id] ? <CircularProgress size={20} /> : <SendIcon />}
                  </Button>
                </Box>

                {diaryComments[diary.id]?.length > 0 ? (
                  <List sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {diaryComments[diary.id].map((comment) => (
                      <ListItem key={comment.id} sx={{ px: 0, py: 1 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                            {comment.user?.username?.charAt(0)?.toUpperCase() || 'U'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" component="span" fontWeight="600" color='green'>
                                {comment.user?.username || `User ${comment.user_id}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatCambodiaTime(comment.created_at)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.5 }}>
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
          </Card>
        ))
      )}
    </Box>
  );
};

export default FeedTab;