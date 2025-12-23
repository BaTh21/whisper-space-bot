// FeedTab.jsx - COMPLETE FIXED VERSION
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Image as ImageIcon,
  MoreVert as MoreVertIcon,
  PlayArrow as PlayArrowIcon,
  Reply as ReplyIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCambodiaDate } from '../../utils/dateUtils';

// Helper function to convert files to base64
export const convertFilesToBase64 = (files, type = 'image') => {
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
export const CommentItemWithActions = ({
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
  onDeleteComment,
  onMediaClick
}) => {
  const [localReplying, setLocalReplying] = useState(false);
  const [localEditing, setLocalEditing] = useState(false);
  const [localEditText, setLocalEditText] = useState(comment.content);
  const [localEditImages, setLocalEditImages] = useState(comment.images || []);
  const [localReplyText, setLocalReplyText] = useState('');
  const [commentMenuAnchorEl, setCommentMenuAnchorEl] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const commentMenuOpen = Boolean(commentMenuAnchorEl);
  const { t, i18n } = useTranslation();


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
                    <EditIcon fontSize="small" sx={{ mr: 1 }} /> {t('edit')}
                  </MenuItem>
                  <MenuItem onClick={handleCommentDelete}>
                    <DeleteIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
                    <Typography color="error">{t('delete')}</Typography>
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
                  {t('add_images')}
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
                          onClick={() => onMediaClick && onMediaClick(img, 'image')}
                          className="clickable-image"
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
                  {editLoading ? t('saving...') : t('save')}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCancelEdit}
                  disabled={editLoading}
                >
                  {t('cancel')}
                </Button>
              </Box>
            </Box>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                {comment.content}
              </Typography>
              {comment.images && comment.images.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                  {comment.images.map((img, idx) => (
                    <Box key={idx} sx={{ position: 'relative' }}>
                      <img
                        src={img}
                        alt={`Comment ${idx + 1}`}
                        style={{
                          width: 50,
                          height: 50,
                          objectFit: 'cover',
                          borderRadius: 4,
                          cursor: 'pointer',
                          transition: 'transform 0.2s'
                        }}
                        onClick={() => onMediaClick && onMediaClick(img, 'image')}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        className="clickable-media"
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
                placeholder={t('reply_to', { username: comment.user?.username })}
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
                  {t('add_images_max', { max: 10 })}
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
                          onClick={() => onMediaClick && onMediaClick(img, 'image')}
                          className="clickable-media"
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
                  {t('send')}
                </Button>
                <Button
                  variant="text"
                  size="small"
                  onClick={handleCancelReply}
                >
                  {t('cancel')}
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
                  onMediaClick={onMediaClick}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// Media Player Component - FIXED: Images now show
export const MediaPlayer = ({ url, type, thumbnail, onClose }) => {
  const [playing, setPlaying] = useState(false);

  if (type === 'image') {
    return (
      <Box sx={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
        <img
          src={url}
          alt='image'
          style={{
            maxWidth: '100%',
            maxHeight: '90vh',
            objectFit: 'contain',
            borderRadius: 8
          }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
      {playing ? (
        <video
          controls
          autoPlay
          style={{
            maxWidth: '100%',
            maxHeight: '90vh',
            borderRadius: 8
          }}
          onEnded={() => setPlaying(false)}
        >
          <source src={url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: '60vh',
            cursor: 'pointer'
          }}
          onClick={() => setPlaying(true)}
        >
          {thumbnail ? (
            <>
              <img
                src={thumbnail}
                alt="Video thumbnail"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 8
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translate(-50%, -50%) scale(1.1)',
                    bgcolor: 'rgba(0,0,0,0.8)'
                  }
                }}
              >
                <PlayArrowIcon sx={{ fontSize: 40, color: 'white' }} />
              </Box>
            </>
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: '#333',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <PlayArrowIcon sx={{ fontSize: 60, color: 'white' }} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

// Helper function to get video thumbnail - FIXED VERSION
export const getVideoThumbnail = (videoUrl, diary) => {
  if (!videoUrl || !diary || !diary.video_thumbnails) return null;

  const videoIndex = diary.videos?.indexOf(videoUrl);

  if (videoIndex !== -1 && videoIndex < diary.video_thumbnails.length) {
    const thumbnail = diary.video_thumbnails[videoIndex];

    // Check if thumbnail exists and is a valid string
    if (thumbnail && typeof thumbnail === 'string' && thumbnail.trim() !== '') {
      // Debug log
      return thumbnail;
    }
  }

  return null;
};