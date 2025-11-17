//dashboard/FeedTab.jsx
import { Article as ArticleIcon, Comment as CommentIcon, Favorite, FavoriteBorder, Send as SendIcon } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Collapse,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useState } from 'react';
import { commentOnDiary, getDiaryComments, getDiaryLikes, likeDiary } from '../../services/api';
import { formatCambodiaDate, formatCambodiaTime } from '../../utils/dateUtils';

const FeedTab = ({ diaries, onNewDiary, setError, setSuccess }) => {
  const [expandedDiary, setExpandedDiary] = useState(null);
  const [diaryComments, setDiaryComments] = useState({});
  const [diaryLikes, setDiaryLikes] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
  const [likedDiaries, setLikedDiaries] = useState(new Set());
  const [commentLoading, setCommentLoading] = useState({});

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
    <Box
      sx={{
        p: { xs: 2, sm: 3 },
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
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
          Your Feed
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
          {isMobile ? 'New' : 'New Diary'}
        </Button>
      </Box>

      {diaries.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          No diaries in your feed yet. Create one or follow more friends!
        </Typography>
      ) : (
        // Scrollable container
        <Box
          sx={{
            maxHeight: '70vh', // adjust as needed
            overflowY: 'auto',
            /* Hide scrollbar for WebKit browsers */
            '&::-webkit-scrollbar': { display: 'none' },
            /* Hide scrollbar for Firefox */
            scrollbarWidth: 'none',
            /* Hide scrollbar for IE, Edge */
            msOverflowStyle: 'none',
          }}
        >
        {diaries.map((diary) => (
          <Card key={diary.id} sx={{
            p: { xs: 2, sm: 3 },
            mb: 2,
            borderRadius: '12px',
            mx: { xs: 0, sm: 0 }
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
              </Box>
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
            </Box>

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
          </Card>
        ))}
        </Box>
      )}
    </Box>
  );
};

export default FeedTab;