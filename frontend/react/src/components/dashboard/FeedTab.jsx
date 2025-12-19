// FeedTab.jsx - COMPLETE FIXED VERSION
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
  PlayArrow as PlayArrowIcon,
  Reply as ReplyIcon,
  Save as SaveIcon,
  Videocam as VideocamIcon,
  ZoomIn as ZoomInIcon
} from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {
  Alert,
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
  Modal,
  Select,
  Snackbar,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { commentOnDiary, deleteCommentById, deleteDiaryById, getDiaryById, getDiaryComments, getDiaryLikes, likeDiary, updateComment, updateDiaryById } from '../../services/api';
import { formatCambodiaDate } from '../../utils/dateUtils';

// Helper function to convert files to base64
const convertFilesToBase64 = (files, type = 'image') => {
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
                    <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
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
const MediaPlayer = ({ url, type, thumbnail, onClose }) => {
  const [playing, setPlaying] = useState(false);

  if (type === 'image') {
    return (
      <Box sx={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
        <img
          src={url}
          alt="Full size view"
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
const getVideoThumbnail = (videoUrl, diary) => {
  if (!videoUrl || !diary || !diary.video_thumbnails) return null;
  
  const videoIndex = diary.videos?.indexOf(videoUrl);
  
  if (videoIndex !== -1 && videoIndex < diary.video_thumbnails.length) {
    const thumbnail = diary.video_thumbnails[videoIndex];
    
    // Check if thumbnail exists and is a valid string
    if (thumbnail && typeof thumbnail === 'string' && thumbnail.trim() !== '') {
      // Debug log
      console.log(`✅ Found thumbnail for video ${videoIndex}:`, thumbnail.substring(0, 50) + '...');
      return thumbnail;
    }
  }
  
  console.log(`❌ No thumbnail found for video:`, videoUrl?.substring(0, 50));
  return null;
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
  const [editVideos, setEditVideos] = useState([]);
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

  // State to force re-render of media
  const [mediaUpdateTrigger, setMediaUpdateTrigger] = useState(0);

  // Media viewer state
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState('');
  const [selectedThumbnail, setSelectedThumbnail] = useState('');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [selectedMediaType, setSelectedMediaType] = useState('image');
  const [currentMediaList, setCurrentMediaList] = useState([]);

  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Normalize data
  const normalizedDiaries = diaries.map(diary => ({
    ...diary,
    groups: Array.isArray(diary.groups) ? diary.groups : [],
    images: Array.isArray(diary.images) ? diary.images : [],
    videos: Array.isArray(diary.videos) ? diary.videos : [],
    video_thumbnails: Array.isArray(diary.video_thumbnails) ? diary.video_thumbnails : []
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

  // Debug: Log diary data
  console.log('=== DIARY DATA DEBUG ===');
  normalizedDiaries.forEach((diary, idx) => {
    if (diary.videos && diary.videos.length > 0) {
      console.log(`📓 Diary ${idx}: ${diary.title}`);
      console.log(`  Videos: ${diary.videos.length}`);
      console.log(`  Thumbnails: ${diary.video_thumbnails?.length || 0}`);
      
      diary.videos.forEach((video, vidIdx) => {
        const thumb = diary.video_thumbnails?.[vidIdx];
        console.log(`  Video ${vidIdx}: ${video?.substring(0, 60)}...`);
        console.log(`    Thumbnail: ${thumb ? thumb.substring(0, 60) + '...' : 'NULL/EMPTY'}`);
        console.log(`    Thumbnail type: ${typeof thumb}`);
      });
    }
  });

  // Media viewer functions
  const openMediaViewer = (mediaList, thumbnails = [], index = 0, type = 'image') => {
    console.log('📺 Opening media viewer:', {
      mediaListCount: mediaList.length,
      thumbnailsCount: thumbnails.length,
      index,
      type
    });
    
    setCurrentMediaList(mediaList);
    setSelectedMedia(mediaList[index]);
    setSelectedMediaType(type);
    setSelectedMediaIndex(index);
    
    // Set thumbnail for videos
    if (type === 'video' && thumbnails[index]) {
      setSelectedThumbnail(thumbnails[index]);
      console.log('📸 Set thumbnail for video:', thumbnails[index]?.substring(0, 50));
    } else {
      setSelectedThumbnail('');
    }
    
    setMediaViewerOpen(true);
  };

  const handleMediaViewerClose = () => {
    setMediaViewerOpen(false);
    setSelectedMedia('');
    setSelectedThumbnail('');
    setSelectedMediaIndex(0);
    setCurrentMediaList([]);
    setSelectedMediaType('image');
  };

  const handlePrevMedia = () => {
    const newIndex = selectedMediaIndex > 0 ? selectedMediaIndex - 1 : currentMediaList.length - 1;
    setSelectedMedia(currentMediaList[newIndex]);
    setSelectedMediaIndex(newIndex);
    
    // Update thumbnail for videos
    if (selectedMediaType === 'video') {
      setSelectedThumbnail('');
    }
  };

  const handleNextMedia = () => {
    const newIndex = selectedMediaIndex < currentMediaList.length - 1 ? selectedMediaIndex + 1 : 0;
    setSelectedMedia(currentMediaList[newIndex]);
    setSelectedMediaIndex(newIndex);
    
    // Update thumbnail for videos
    if (selectedMediaType === 'video') {
      setSelectedThumbnail('');
    }
  };

  // Media upload handler
  const handleMediaUpload = async (event, diaryId = null, commentId = null, mediaType = 'image') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate files based on type
    const validFiles = Array.from(files).filter(file => {
      if (mediaType === 'image') {
        const isValidType = file.type.startsWith('image/');
        const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB for images
        
        if (!isValidType) {
          showMessage('Only image files are allowed (jpg, png, gif, etc.)', 'error');
          return false;
        }
        
        if (!isValidSize) {
          showMessage('Each image must be less than 10MB', 'error');
          return false;
        }
        
        // Check count for editing
        if (diaryId && editingDiary === diaryId) {
          const currentCount = mediaType === 'image' ? editImages.length : editVideos.length;
          const maxCount = mediaType === 'image' ? 10 : 3;
          if (currentCount + files.length > maxCount) {
            showMessage(`Maximum ${maxCount} ${mediaType === 'image' ? 'images' : 'videos'} allowed`, 'error');
            return false;
          }
        }
        
        return true;
      } else if (mediaType === 'video') {
        const isValidType = file.type.startsWith('video/') || ['.mp4', '.mov', '.avi', '.webm', '.mkv'].some(ext => file.name.toLowerCase().endsWith(ext));
        const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB for videos
        
        if (!isValidType) {
          showMessage('Only video files are allowed (mp4, mov, avi, webm, mkv)', 'error');
          return false;
        }
        
        if (!isValidSize) {
          showMessage('Each video must be less than 50MB', 'error');
          return false;
        }
        
        // Check count for editing
        if (diaryId && editingDiary === diaryId) {
          if (editVideos.length + files.length > 3) {
            showMessage('Maximum 3 videos allowed', 'error');
            return false;
          }
        }
        
        return true;
      }
      
      return false;
    });

    if (validFiles.length === 0) return;

    try {
      const base64Media = await convertFilesToBase64(validFiles, mediaType);
      const mediaUrls = base64Media.map(img => img.data);

      if (diaryId && editingDiary === diaryId) {
        // For diary editing
        if (mediaType === 'image') {
          setEditImages(prev => {
            const newImages = [...prev, ...mediaUrls];
            setMediaUpdateTrigger(prev => prev + 1);
            return newImages;
          });
        } else {
          setEditVideos(prev => {
            const newVideos = [...prev, ...mediaUrls];
            setMediaUpdateTrigger(prev => prev + 1);
            return newVideos;
          });
        }
        showMessage(`${mediaType === 'image' ? 'Image' : 'Video'} added`, 'success');
      } else if (commentId) {
        // For comment replies (only images allowed)
        setSelectedCommentImages(prev => ({
          ...prev,
          [commentId]: [...(prev[commentId] || []), ...mediaUrls]
        }));
      } else if (diaryId) {
        // For new comments (only images allowed)
        setSelectedCommentImages(prev => ({
          ...prev,
          [diaryId]: [...(prev[diaryId] || []), ...mediaUrls]
        }));
      }

      // Clear file input
      event.target.value = '';
    } catch (err) {
      showMessage(`Failed to process ${mediaType}s`, 'error');
      console.error('Media upload error:', err);
    }
  };

  // Remove media
  const removeMedia = (indexToRemove, diaryId = null, commentId = null, mediaType = 'image') => {
    if (diaryId && editingDiary === diaryId) {
      if (mediaType === 'image') {
        setEditImages(current => {
          const newImages = current.filter((_, index) => index !== indexToRemove);
          setMediaUpdateTrigger(prev => prev + 1);
          return newImages;
        });
      } else {
        setEditVideos(current => {
          const newVideos = current.filter((_, index) => index !== indexToRemove);
          setMediaUpdateTrigger(prev => prev + 1);
          return newVideos;
        });
      }
      showMessage(`${mediaType === 'image' ? 'Image' : 'Video'} removed`, 'info');
    } else if (commentId) {
      setSelectedCommentImages(prev => {
        const currentImages = prev[commentId] || [];
        const newImages = currentImages.filter((_, index) => index !== indexToRemove);
        return {
          ...prev,
          [commentId]: newImages
        };
      });
    } else if (diaryId) {
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
      
      console.log('=== EDIT DIARY DATA ===');
      console.log('Full diary:', {
        id: fullDiary.id,
        videos: fullDiary.videos,
        video_thumbnails: fullDiary.video_thumbnails,
        images: fullDiary.images,
        media_type: fullDiary.media_type
      });
      
      // Reset and set with fresh data
      setEditTitle(fullDiary.title || '');
      setEditContent(fullDiary.content || '');
      setEditShareType(fullDiary.share_type || '');
      setEditGroupIds(fullDiary.groups?.map(g => g.id) || []);
      
      // Set media with fresh arrays
      setEditImages([...(fullDiary.images || [])]);
      setEditVideos([...(fullDiary.videos || [])]);
      
      // Set editing diary last
      setEditingDiary(diary.id);
      
      // Reset media update trigger
      setMediaUpdateTrigger(0);
    } catch (err) {
      console.error('Failed to fetch diary:', err);
      setEditingDiary(diary.id);
      setEditTitle(diary.title || '');
      setEditContent(diary.content || '');
      setEditShareType(diary.share_type || '');
      setEditGroupIds(diary.groups?.map(g => g.id) || []);
      setEditImages([...(diary.images || [])]);
      setEditVideos([...(diary.videos || [])]);
    }
  };

  const handleEditCancel = () => {
    setEditingDiary(null);
    setEditTitle('');
    setEditContent('');
    setEditShareType('');
    setEditGroupIds([]);
    setEditImages([]);
    setEditVideos([]);
    setEditLoading(false);
    setMediaUpdateTrigger(0);
    showMessage('Edit cancelled', 'info');
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

      // Prepare images: existing URLs + new base64 images
      const existingImageUrls = editImages.filter(img => img.startsWith('http'));
      const newBase64Images = editImages.filter(img => img.startsWith('data:image/'));
      
      // For videos: existing URLs + new base64 videos
      const existingVideoUrls = editVideos.filter(vid => vid.startsWith('http'));
      const newBase64Videos = editVideos.filter(vid => vid.startsWith('data:video/'));
      
      console.log('=== EDIT DATA ANALYSIS ===');
      console.log('Existing image URLs:', existingImageUrls.length);
      console.log('New base64 images:', newBase64Images.length);
      console.log('Existing video URLs:', existingVideoUrls.length);
      console.log('New base64 videos:', newBase64Videos.length);
      
      // Send all images (existing URLs + new base64)
      updateData.images = [...existingImageUrls, ...newBase64Images];
      
      // Send all videos (existing URLs + new base64)
      updateData.videos = [...existingVideoUrls, ...newBase64Videos];
      
      console.log('=== SENDING UPDATE ===');
      console.log('Update data structure:', {
        ...updateData,
        images: `Array of ${updateData.images.length} items`,
        videos: `Array of ${updateData.videos.length} items`
      });

      await updateDiaryById(diaryId, updateData);
      showMessage('Diary updated successfully');
      handleEditCancel();
      if (onDataUpdate) onDataUpdate();
    } catch (err) {
      console.error('Update diary error:', err);
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

  // Handle media click - FIXED: Pass thumbnails for videos
  const handleMediaClick = (url, type = 'image') => {
    console.log('🖱️ Media clicked:', { url: url?.substring(0, 50), type });
    
    if (type === 'image') {
      openMediaViewer([url], [], 0, 'image');
    } else {
      // For video, find the diary and get thumbnail
      const diary = normalizedDiaries.find(d => d.videos?.includes(url));
      if (diary) {
        const videoIndex = diary.videos.indexOf(url);
        const thumbnails = diary.video_thumbnails || [];
        const thumbnail = thumbnails[videoIndex] || '';
        
        console.log('🎬 Video clicked:', {
          videoIndex,
          thumbnail: thumbnail?.substring(0, 50),
          thumbnailsCount: thumbnails.length
        });
        
        openMediaViewer([url], thumbnails, 0, 'video');
      } else {
        openMediaViewer([url], [], 0, 'video');
      }
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
      {/* Media Viewer Modal */}
      <Modal
        open={mediaViewerOpen}
        onClose={handleMediaViewerClose}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none'
        }}
      >
        <Box sx={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          outline: 'none'
        }}>
          <MediaPlayer 
            url={selectedMedia} 
            type={selectedMediaType}
            thumbnail={selectedThumbnail}
            onClose={handleMediaViewerClose}
          />
          {currentMediaList.length > 1 && (
            <>
              <IconButton
                onClick={handlePrevMedia}
                sx={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <IconButton
                onClick={handleNextMedia}
                sx={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                }}
              >
                <ArrowForwardIcon />
              </IconButton>
              <Typography
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  px: 2,
                  py: 0.5,
                  borderRadius: 2,
                  fontSize: '0.875rem'
                }}
              >
                {selectedMediaIndex + 1} / {currentMediaList.length}
              </Typography>
            </>
          )}
          <IconButton
            onClick={handleMediaViewerClose}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'white',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Modal>

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
                      
                      {/* Media Upload Section for Edit */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Image Upload */}
                        <Box>
                          <Button
                            variant="outlined"
                            component="label"
                            startIcon={<ImageIcon />}
                            size="medium"
                            disabled={editLoading || editImages.length >= 10}
                            sx={{ mr: 2 }}
                          >
                            Add Images (Max 10)
                            <input
                              type="file"
                              hidden
                              multiple
                              accept="image/*"
                              onChange={(e) => handleMediaUpload(e, diary.id, null, 'image')}
                            />
                          </Button>
                          {editImages.length > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              {editImages.length} selected
                            </Typography>
                          )}
                        </Box>
                        
                        {/* Video Upload */}
                        <Box>
                          <Button
                            variant="outlined"
                            component="label"
                            startIcon={<VideocamIcon />}
                            size="medium"
                            disabled={editLoading || editVideos.length >= 3}
                            sx={{ mr: 2 }}
                          >
                            Add Videos (Max 3)
                            <input
                              type="file"
                              hidden
                              multiple
                              accept="video/*"
                              onChange={(e) => handleMediaUpload(e, diary.id, null, 'video')}
                            />
                          </Button>
                          {editVideos.length > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              {editVideos.length} selected
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      
                      {/* Image Preview for Edit */}
                      {editImages.length > 0 && (
                        <Box 
                          key={`image-preview-${editImages.length}-${mediaUpdateTrigger}`}
                          sx={{ mt: 2 }}
                        >
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Images ({editImages.length} / 10)
                          </Typography>
                          <Box sx={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                            gap: 1,
                            mt: 1 
                          }}>
                            {editImages.map((img, index) => (
                              <Box 
                                key={`edit-img-${diary.id}-${index}-${img.substring(0, 20)}`}
                                sx={{ 
                                  position: 'relative',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  aspectRatio: '1',
                                  '&:hover .media-overlay': {
                                    opacity: 1
                                  }
                                }}
                              >
                                <img
                                  src={img}
                                  alt={`Image ${index + 1}`}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => handleMediaClick(img, 'image')}
                                />
                                
                                {/* Media Overlay */}
                                <Box className="media-overlay" sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  opacity: 0,
                                  transition: 'opacity 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 0.5
                                }}>
                                  <IconButton
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeMedia(index, diary.id, null, 'image');
                                    }}
                                    sx={{
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
                                  <IconButton
                                    onClick={() => handleMediaClick(img, 'image')}
                                    sx={{
                                      bgcolor: 'primary.main',
                                      color: 'white',
                                      width: 28,
                                      height: 28,
                                      '&:hover': {
                                        bgcolor: 'primary.dark'
                                      }
                                    }}
                                    size="small"
                                  >
                                    <ZoomInIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Box>
                                
                                {/* Media Number Badge */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 4,
                                    left: 4,
                                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: 20,
                                    height: 20,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem',
                                    fontWeight: 600
                                  }}
                                >
                                  {index + 1}
                                </Box>
                                
                                {/* URL/New Badge */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    bgcolor: img.startsWith('http') ? 'rgba(0, 100, 0, 0.7)' : 'rgba(0, 0, 150, 0.7)',
                                    color: 'white',
                                    px: 0.5,
                                    py: 0.1,
                                    borderRadius: 1,
                                    fontSize: '0.55rem',
                                    fontWeight: 500
                                  }}
                                >
                                  {img.startsWith('http') ? 'URL' : 'NEW'}
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                      
                      {/* Video Preview for Edit */}
                      {editVideos.length > 0 && (
                        <Box 
                          key={`video-preview-${editVideos.length}-${mediaUpdateTrigger}`}
                          sx={{ mt: 2 }}
                        >
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Videos ({editVideos.length} / 3)
                          </Typography>
                          <Box sx={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                            gap: 1.5,
                            mt: 1 
                          }}>
                            {editVideos.map((vid, index) => {
                              const isExistingVideo = vid.startsWith('http');
                              const thumbnail = isExistingVideo ? getVideoThumbnail(vid, diary) : null;
                              
                              return (
                                <Box 
                                  key={`edit-vid-${diary.id}-${index}`}
                                  sx={{ 
                                    position: 'relative',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    aspectRatio: '16/9',
                                    bgcolor: '#000',
                                    cursor: 'pointer',
                                    '&:hover .media-overlay': {
                                      opacity: 1
                                    }
                                  }}
                                >
                                  {/* Video Thumbnail or Placeholder */}
                                  {thumbnail ? (
                                    <Box
                                      sx={{
                                        width: '100%',
                                        height: '100%',
                                        position: 'relative'
                                      }}
                                      onClick={() => handleMediaClick(vid, 'video')}
                                    >
                                      <img
                                        src={thumbnail}
                                        alt={`Video ${index + 1}`}
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover'
                                        }}
                                        onError={(e) => {
                                          console.error(`❌ Failed to load thumbnail:`, thumbnail);
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                      <Box
                                        sx={{
                                          position: 'absolute',
                                          top: '50%',
                                          left: '50%',
                                          transform: 'translate(-50%, -50%)',
                                          width: 40,
                                          height: 40,
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
                                        <PlayArrowIcon sx={{ fontSize: 24, color: 'white' }} />
                                      </Box>
                                    </Box>
                                  ) : (
                                    <Box
                                      sx={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative'
                                      }}
                                      onClick={() => handleMediaClick(vid, 'video')}
                                    >
                                      <PlayArrowIcon sx={{ fontSize: 40, color: 'white', zIndex: 1 }} />
                                      <Typography 
                                        variant="caption" 
                                        sx={{ 
                                          position: 'absolute', 
                                          bottom: 8, 
                                          left: 8, 
                                          color: 'white',
                                          bgcolor: 'rgba(0,0,0,0.5)',
                                          px: 1,
                                          borderRadius: 1,
                                          zIndex: 2
                                        }}
                                      >
                                        No thumbnail
                                      </Typography>
                                    </Box>
                                  )}
                                  
                                  {/* Media Overlay with Remove Button */}
                                  <Box className="media-overlay" sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 0.5
                                  }}>
                                    <IconButton
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeMedia(index, diary.id, null, 'video');
                                      }}
                                      sx={{
                                        bgcolor: 'error.main',
                                        color: 'white',
                                        width: 32,
                                        height: 32,
                                        '&:hover': {
                                          bgcolor: 'error.dark'
                                        }
                                      }}
                                      size="small"
                                    >
                                      <CloseIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Box>
                                  
                                  {/* Video Type Badge */}
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: 4,
                                      left: 4,
                                      bgcolor: isExistingVideo ? 'rgba(0, 100, 0, 0.7)' : 'rgba(0, 0, 150, 0.7)',
                                      color: 'white',
                                      px: 0.75,
                                      py: 0.25,
                                      borderRadius: 1,
                                      fontSize: '0.65rem',
                                      fontWeight: 500,
                                      zIndex: 2
                                    }}
                                  >
                                    {isExistingVideo ? 'UPLOADED' : 'NEW'}
                                  </Box>
                                  
                                  {/* Video Number Badge */}
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: 4,
                                      right: 4,
                                      bgcolor: 'rgba(0, 0, 0, 0.6)',
                                      color: 'white',
                                      borderRadius: '50%',
                                      width: 20,
                                      height: 20,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      zIndex: 2
                                    }}
                                  >
                                    {index + 1}
                                  </Box>
                                </Box>
                              );
                            })}
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
                  <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {diary.content}
                  </Typography>

                  {/* Diary Images - Compact Grid View */}
                  {diary.images && diary.images.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {diary.images.length} {diary.images.length === 1 ? 'image' : 'images'}
                      </Typography>
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: {
                          xs: 'repeat(2, 1fr)',
                          sm: 'repeat(3, 1fr)',
                          md: 'repeat(4, 1fr)'
                        },
                        gap: 1
                      }}>
                        {diary.images.map((img, index) => (
                          <Box
                            key={index}
                            sx={{
                              position: 'relative',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              aspectRatio: '1',
                              cursor: 'pointer',
                              transition: 'transform 0.2s',
                              '&:hover': {
                                transform: 'scale(1.02)',
                                '& .media-overlay': {
                                  opacity: 1
                                }
                              }
                            }}
                            onClick={() => handleMediaClick(img, 'image')}
                          >
                            <img
                              src={img}
                              alt={`Diary ${index + 1}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                            <Box className="media-overlay" sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              bgcolor: 'rgba(0,0,0,0.3)',
                              opacity: 0,
                              transition: 'opacity 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <ZoomInIcon sx={{ color: 'white', fontSize: 32 }} />
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Diary Videos - Grid View - FIXED: Shows thumbnails */}
                  {diary.videos && diary.videos.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {diary.videos.length} {diary.videos.length === 1 ? 'video' : 'videos'}
                      </Typography>
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'repeat(2, 1fr)',
                          md: 'repeat(3, 1fr)'
                        },
                        gap: 2
                      }}>
                        {diary.videos.map((video, index) => {
                          // Get thumbnail for this specific video
                          const thumbnail = getVideoThumbnail(video, diary);
                          
                          console.log(`🎬 Rendering video ${index}:`, {
                            video: video?.substring(0, 50),
                            thumbnail: thumbnail?.substring(0, 50),
                            hasThumbnail: !!thumbnail
                          });
                          
                          return (
                            <Box
                              key={index}
                              sx={{
                                position: 'relative',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                aspectRatio: '16/9',
                                bgcolor: '#000',
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                                '&:hover': {
                                  transform: 'scale(1.02)',
                                  '& .media-overlay': {
                                    opacity: 1
                                  }
                                }
                              }}
                              onClick={() => handleMediaClick(video, 'video')}
                            >
                              {/* Video Thumbnail or Placeholder */}
                              {thumbnail ? (
                                <Box>
                                  <img
                                    src={thumbnail}
                                    alt={`Video thumbnail ${index + 1}`}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover'
                                    }}
                                    onError={(e) => {
                                      console.error(`❌ Failed to load thumbnail for video ${index}:`, thumbnail);
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                </Box>
                              ) : (
                                <Box
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'column',
                                    gap: 1
                                  }}
                                >
                                  <VideocamIcon sx={{ fontSize: 48, color: '#666' }} />
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      color: '#888',
                                      textAlign: 'center'
                                    }}
                                  >
                                    No thumbnail
                                  </Typography>
                                </Box>
                              )}
                              
                              {/* Play Button Overlay */}
                              <Box className="media-overlay" sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                bgcolor: thumbnail ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
                                opacity: 0,
                                transition: 'opacity 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <PlayArrowIcon sx={{ color: 'white', fontSize: 48 }} />
                              </Box>
                              
                              {/* Video Number Badge */}
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  bgcolor: 'rgba(0,0,0,0.7)',
                                  color: 'white',
                                  px: 1,
                                  py: 0.25,
                                  borderRadius: 1,
                                  fontSize: '0.7rem',
                                  fontWeight: 500
                                }}
                              >
                                {index + 1}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
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
                              onChange={(e) => handleMediaUpload(e, diary.id)}
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

                      {/* Selected Images Preview for Comments - Compact */}
                      {selectedCommentImages[diary.id]?.length > 0 && (
                        <Box sx={{ 
                          mb: 2,
                          p: 1,
                          bgcolor: 'background.paper',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: 'divider'
                        }}>
                          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                            Selected images ({selectedCommentImages[diary.id].length})
                          </Typography>
                          <Box sx={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: 0.5
                          }}>
                            {selectedCommentImages[diary.id].map((img, index) => (
                              <Box key={index} sx={{ 
                                position: 'relative',
                                width: 50,
                                height: 50,
                                borderRadius: 4,
                                overflow: 'hidden'
                              }}>
                                <img
                                  src={img}
                                  alt={`Preview ${index}`}
                                  style={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    objectFit: 'cover'
                                  }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => removeMedia(index, null, diary.id, 'image')}
                                  sx={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -4,
                                    bgcolor: 'error.main',
                                    color: 'white',
                                    width: 20,
                                    height: 20,
                                    '&:hover': { 
                                      bgcolor: 'error.dark' 
                                    }
                                  }}
                                >
                                  <CloseIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                              </Box>
                            ))}
                          </Box>
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
                              handleImageUpload={handleMediaUpload}
                              selectedCommentImages={selectedCommentImages}
                              setSelectedCommentImages={setSelectedCommentImages}
                              onEditComment={handleEditComment}
                              onDeleteComment={handleCommentDeleteClick}
                              replyingTo={replyingTo}
                              setReplyingTo={setReplyingTo}
                              onMediaClick={handleMediaClick}
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