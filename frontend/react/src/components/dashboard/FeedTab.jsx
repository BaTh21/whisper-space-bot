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
  Save as SaveIcon,
  Videocam as VideocamIcon,
  ZoomIn as ZoomInIcon,
} from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SearchIcon from '@mui/icons-material/Search';
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
  Divider,
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
  useTheme,
  InputAdornment,
  Tooltip
} from '@mui/material';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { commentOnDiary, deleteCommentById, deleteDiaryById, getDiaryById, getDiaryComments, getDiaryLikes, likeDiary, sendFriendRequest, updateComment, updateDiaryById } from '../../services/api';
import { formatCambodiaDate } from '../../utils/dateUtils';
import { DiaryCard } from '../diary/DairyCard';
import { convertFilesToBase64, CommentItemWithActions, MediaPlayer, getVideoThumbnail } from '../diary/DiaryHelper';
import ActivityComponent from '../diary/ActivityComponent';
import SuggestFriendComponent from '../diary/SuggestFriendComponent';
import { useAuth } from '../../context/AuthContext';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CreateDiaryComponent from '../diary/CreateDiaryComponent';
import NorthIcon from '@mui/icons-material/North';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import TurnedInNotOutlinedIcon from '@mui/icons-material/TurnedInNotOutlined';

const FeedTab = ({ diaries, onNewDiary, onDataUpdate, profile, groups, friends = [], setError }) => {
  const [expandedDiary, setExpandedDiary] = useState(null);
  const [diaryComments, setDiaryComments] = useState({});
  const [diaryLikes, setDiaryLikes] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
  const [likedDiaries, setLikedDiaries] = useState(new Set());
  const [commentLoading, setCommentLoading] = useState({});
  const { auth } = useAuth();
  const user = auth?.user;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [diaryToDelete, setDiaryToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [editingDiary, setEditingDiary] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editShareType, setEditShareType] = useState('');
  const [editGroupIds, setEditGroupIds] = useState([]);
  const [editImages, setEditImages] = useState([]);
  const [editVideos, setEditVideos] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedCommentImages, setSelectedCommentImages] = useState({});
  const [commentDeleteDialogOpen, setCommentDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [commentDeleteLoading, setCommentDeleteLoading] = useState(false);

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedDiaryForMenu, setSelectedDiaryForMenu] = useState(null);
  const menuOpen = Boolean(menuAnchorEl);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [mediaUpdateTrigger, setMediaUpdateTrigger] = useState(0);

  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState('');
  const [selectedThumbnail, setSelectedThumbnail] = useState('');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [selectedMediaType, setSelectedMediaType] = useState('image');
  const [currentMediaList, setCurrentMediaList] = useState([]);
  const [sendingRequests, setSendingRequests] = useState(new Set());
  const [search, setSearch] = useState("");

  const scrollRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      setVisible(el.scrollTop > 300);
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    scrollRef.current.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const initialLiked = new Set();
    const initialLikes = {};

    diaries.forEach(diary => {
      if (diary.likes.some(like => like.user.id === user.id)) {
        initialLiked.add(diary.id);
      }
      initialLikes[diary.id] = diary.likes.length;
    });

    setLikedDiaries(initialLiked);
    setDiaryLikes(initialLikes);
  }, [diaries, user.id]);

  const handleSendFriendRequest = async (userId) => {
    if (!userId || !profile || userId === profile.id) return;
    if (sendingRequests.has(userId)) return;

    setSendingRequests(prev => new Set(prev).add(userId));

    try {
      const result = await sendFriendRequest(userId);

      if (result.success) {
        let message = result.message || t('request_sent');

        if (result.code === 'ALREADY_EXISTS') {
          message = result.message || t('already_sent');
        } else if (result.code === 'ALREADY_FRIENDS') {
          message = t('already_friends');
        }

        showMessage(message, 'success');

        if (onDataUpdate) onDataUpdate();
      } else {
        showMessage(result.message || t('request_failed'), 'error');
      }
    } catch (err) {
      console.error('Send friend request failed:', err);
      let errorMessage = err.message || t('unexpected_error');

      if (err.message?.includes('401')) {
        errorMessage = t('please_login');
      } else if (!navigator.onLine) {
        errorMessage = t('no_internet');
      }

      showMessage(errorMessage, 'error');
    } finally {
      setSendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Normalize data
  const normalizedDiaries = diaries.map(diary => ({
    ...diary,
    groups: Array.isArray(diary.groups) ? diary.groups : [],
    images: Array.isArray(diary.images) ? diary.images : [],
    videos: Array.isArray(diary.videos) ? diary.videos : [],
    video_thumbnails: Array.isArray(diary.video_thumbnails) ? diary.video_thumbnails : [],
  }));

  const normalizedGroups = Array.isArray(groups) ? groups : [];

  const filteredDiaries = useMemo(() => {
    if (!search.trim()) return normalizedDiaries;

    const q = search.toLowerCase();

    return normalizedDiaries.filter(diary => {
      return (
        diary.title?.toLowerCase().includes(q) ||
        diary.content?.toLowerCase().includes(q) ||
        diary.author?.username?.toLowerCase().includes(q) ||
        diary.groups.some(g => g.name?.toLowerCase().includes(q))
      );
    });
  }, [search, normalizedDiaries]);

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

  // Media viewer functions
  const openMediaViewer = (mediaList, startIndex = 0) => {
    const media = mediaList[startIndex];
    setCurrentMediaList(mediaList);
    setSelectedMedia(media.src);
    setSelectedMediaType(media.type);
    setSelectedThumbnail(media.thumbnail || '');
    setSelectedMediaIndex(startIndex);
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
    const newIndex =
      selectedMediaIndex > 0
        ? selectedMediaIndex - 1
        : currentMediaList.length - 1;
    const media = currentMediaList[newIndex];
    setSelectedMedia(media.src);
    setSelectedMediaType(media.type);
    setSelectedThumbnail(media.thumbnail || '');
    setSelectedMediaIndex(newIndex);
  };

  const handleNextMedia = () => {
    const newIndex =
      selectedMediaIndex < currentMediaList.length - 1 ? selectedMediaIndex + 1 : 0;
    const media = currentMediaList[newIndex];
    setSelectedMedia(media.src);
    setSelectedMediaType(media.type);
    setSelectedThumbnail(media.thumbnail || '');
    setSelectedMediaIndex(newIndex);
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
          showMessage(t('invalid_file_type (jpg, png, gif, etc.)'), 'error');
          return false;
        }

        if (!isValidSize) {
          showMessage(t('file_too_large'), 'error');
          return false;
        }

        // Check count for editing
        if (diaryId && editingDiary === diaryId) {
          const currentCount = mediaType === 'image' ? editImages.length : editVideos.length;
          const maxCount = mediaType === 'image' ? 10 : 3;
          if (currentCount + files.length > maxCount) {
            showMessage(t('max_images ${maxCount} ${mediaType === "image" ? "images" : "videos"} allowed'), 'error');
            return false;
          }
        }

        return true;
      } else if (mediaType === 'video') {
        const isValidType = file.type.startsWith('video/') || ['.mp4', '.mov', '.avi', '.webm', '.mkv'].some(ext => file.name.toLowerCase().endsWith(ext));
        const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB for videos

        if (!isValidType) {
          showMessage(t('invalid_video_type (mp4, mov, avi, webm, mkv)'), 'error');
          return false;
        }

        if (!isValidSize) {
          showMessage(t('video_too_large'), 'error');
          return false;
        }

        // Check count for editing
        if (diaryId && editingDiary === diaryId) {
          if (editVideos.length + files.length > 3) {
            showMessage(t('max_videos 3 videos allowed'), 'error');
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
      showMessage(t('diary_deleted'));
      handleDeleteCancel();
      if (onDataUpdate) onDataUpdate();
    } catch (err) {
      showMessage(err.message || t('failed_delete_diary'), 'error');
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
    showMessage(t('edit_cancelled'), 'info');
  };

  const handleEditSave = async (diaryId) => {
    if (!editTitle.trim() || !editContent.trim()) {
      showMessage(t('title_content_required'), 'error');
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

      // Send all images (existing URLs + new base64)
      updateData.images = [...existingImageUrls, ...newBase64Images];

      // Send all videos (existing URLs + new base64)
      updateData.videos = [...existingVideoUrls, ...newBase64Videos];

      await updateDiaryById(diaryId, updateData);
      showMessage(t('diary_updated'));
      handleEditCancel();
      if (onDataUpdate) onDataUpdate();
    } catch (err) {
      console.error('Update diary error:', err);
      showMessage(err.message || t('failed_update_diary'), 'error');
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
      showMessage(err.message || t('failed_like'), 'error');
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
      showMessage(t('comment_added'));
    } catch (err) {
      showMessage(err.message || t('failed_add_comment'), 'error');
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
      showMessage(t('reply_added'));
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

      showMessage(t('comment_updated'));
    } catch (err) {
      showMessage(err.message || t('failed_update_comment'), 'error');
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

      showMessage(t('comment_deleted'));
    } catch (err) {
      showMessage(err.message || t('failed_delete_comment'), 'error');
    } finally {
      handleCommentDeleteCancel();
    }
  };

  // Handle media click - FIXED: Pass thumbnails for videos
  const handleMediaClick = (url, type = 'image') => {
    const diary = filteredDiaries.find(d =>
      d.images?.includes(url) || d.videos?.includes(url)
    );

    if (!diary) {
      const singleMedia = { src: url, type, thumbnail: '' };
      openMediaViewer([singleMedia], 0);
      return;
    }

    const images = diary.images.map(src => ({ src, type: 'image' }));
    const videos = diary.videos.map((src, i) => ({
      src,
      type: 'video',
      thumbnail: diary.video_thumbnails?.[i] || '',
    }));

    const mediaList = [...images, ...videos];
    const index = mediaList.findIndex(m => m.src === url);

    openMediaViewer(mediaList, index);
  };

  const isFriend = (authorId) =>
    friends?.some(
      f =>
        f.status === 'accepted' &&
        (f.user.id === authorId || f.friend.id === authorId)
    );

  const isRequesting = (authorId) =>
    friends?.some(
      f =>
        f.status === 'pending' &&
        (f.user.id === authorId || f.friend.id === authorId)
    );

  return (
    <Box sx={{
      maxWidth: '100%',
      overflow: 'hidden',
      '&::-webkit-scrollbar': { display: 'none' },
      scrollbarWidth: 'none',
      display: 'flex',
      gap: 3
    }}>

      <Box
        sx={{
          width: '100%'
        }}
      >
        <Modal
          open={mediaViewerOpen}
          onClose={handleMediaViewerClose}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              outline: 'none',
            }}
          >
            {/* Media Player */}
            <MediaPlayer
              url={selectedMedia}
              type={selectedMediaType}
              thumbnail={selectedThumbnail}
              onClose={handleMediaViewerClose}
            />

            {/* Prev Button */}
            {currentMediaList.length > 1 && (
              <IconButton
                onClick={handlePrevMedia}
                sx={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <ArrowBackIcon />
              </IconButton>
            )}

            {/* Next Button */}
            {currentMediaList.length > 1 && (
              <IconButton
                onClick={handleNextMedia}
                sx={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <ArrowForwardIcon />
              </IconButton>
            )}

            {/* Counter */}
            {currentMediaList.length > 1 && (
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
                  fontSize: '0.875rem',
                }}
              >
                {selectedMediaIndex + 1} / {currentMediaList.length}
              </Typography>
            )}

            {/* Close Button */}
            <IconButton
              onClick={handleMediaViewerClose}
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                bgcolor: 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Modal>


        <Snackbar
          open={snackbarOpen}
          autoHideDuration={2000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbarSeverity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>

        <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
          <DialogTitle>{t('delete_title')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('delete_diary', { title: diaryToDelete?.title })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} disabled={deleteLoading}>{t('cancel')}</Button>
            <Button
              onClick={handleDeleteDiary}
              color="error"
              variant="contained"
              disabled={deleteLoading}
              startIcon={deleteLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
            >
              {deleteLoading ? t('deleting') : t('delete')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={commentDeleteDialogOpen} onClose={handleCommentDeleteCancel}>
          <DialogTitle>{t('delete_comment')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('delete_confirm')}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCommentDeleteCancel} disabled={commentDeleteLoading}>{t('cancel')}</Button>
            <Button
              onClick={() => handleDeleteComment(commentToDelete)}
              color="error"
              variant="contained"
              disabled={commentDeleteLoading}
              startIcon={commentDeleteLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
            >
              {commentDeleteLoading ? t('deleting') : t('delete')}
            </Button>
          </DialogActions>
        </Dialog>

        <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={handleMenuClose}>
          <MenuItem onClick={handleEditDiaryClick}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} /> {t('edit')}
          </MenuItem>
          <MenuItem onClick={handleDeleteDiaryClick}>
            <DeleteIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
            <Typography color="error">{t('delete')}</Typography>
          </MenuItem>
        </Menu>

        <Box
          ref={scrollRef}
          sx={{
            maxHeight: '90vh',
            overflowY: 'auto',
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >

          <CreateDiaryComponent
            groups={groups}
            user={user}
            onSuccess={onDataUpdate}
            setError={setError}
          />

          <Box sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
            pb: { xs: 3, md: 2 },
            width: '100%',
            left: 0,
          }}>

            <TextField
              sx={{ width: { xs: '100%', md: "50%" } }}
              id="outlined-member-search"
              label="Search diary"
              variant="outlined"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {search && (
                      <IconButton
                        size="small"
                        onClick={() => setSearch("")}
                        edge="end"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" edge="end">
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              variant="contained"
              onClick={onNewDiary}
              startIcon={<ArticleIcon />}
              sx={{ borderRadius: '8px', width: { sm: 150 } }}
            >
              {isMobile ? t('new') : t('new_diary')}
            </Button>
          </Box>

          <Button
            onClick={scrollToTop}
            sx={{
              position: "absolute",
              bottom: 20,
              right: { xs: 20, md: 250, lg: 350 },
              fontSize: "16px",
              borderRadius: "50%",
              border: "none",
              color: "white",
              backgroundColor: '#254D70',
              cursor: "pointer",
              display: visible ? "flex" : "none",
              zIndex: 1300,
              minWidth: 0,
              width: 45,
              height: 45
            }}
          >
            <NorthIcon />
          </Button>

          {filteredDiaries.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              {t('no_diaries_yet')}
            </Typography>
          ) : (
            <Box>
              {filteredDiaries.map((diary) => {
                const combinedMedia = [
                  ...(diary.images || []).map((src) => ({
                    type: 'image',
                    src
                  })),
                  ...(diary.videos || []).map((src) => ({
                    type: 'video',
                    src,
                    thumbnail: getVideoThumbnail(src, diary)
                  }))
                ];

                const visibleMedia = combinedMedia.slice(0, 6);

                return (
                  <Box key={diary.id}>
                    <Card
                      sx={{
                        p: { xs: 1, sm: 2 },
                        mb: 2, width: '100%',
                      }}>
                      {/* Diary Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, }}>
                        <Box sx={{ flex: 1 }}>
                          {editingDiary === diary.id ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <TextField
                                fullWidth
                                label={t('title')}
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                disabled={editLoading}
                                size="medium"
                              />
                              <TextField
                                fullWidth
                                label={t('content')}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                disabled={editLoading}
                                multiline
                                rows={4}
                                size="medium"
                              />
                              <FormControl size="medium" fullWidth>
                                <InputLabel>{t('share_type')}</InputLabel>
                                <Select
                                  value={editShareType}
                                  label={t('share_type')}
                                  onChange={(e) => setEditShareType(e.target.value)}
                                  disabled={editLoading}
                                >
                                  <MenuItem value="public">{t('public')}</MenuItem>
                                  <MenuItem value="friends">{t('friends')}</MenuItem>
                                  <MenuItem value="personal">{t('personal')}</MenuItem>
                                  <MenuItem value="group">{t('group')}</MenuItem>
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
                                    {t('add_images_max', { max: 10 })}
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
                                    {t('add_videos_max', { max: 3 })}
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
                                    {t('images_count', { count: editImages.length, max: 10 })}
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
                                          {img.startsWith('http') ? t('existing') : t('new')}
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
                                    {t('videos_count', { count: editVideos.length, max: 3 })}
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
                                            {isExistingVideo ? t('uploaded') : t('new')}
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
                                  size="medium"
                                >
                                  {t('cancel')}
                                </Button>
                                <Button
                                  variant="contained"
                                  onClick={() => handleEditSave(diary.id)}
                                  disabled={editLoading || !editTitle.trim() || !editContent.trim()}
                                  startIcon={editLoading ? <CircularProgress size={24} /> : <SaveIcon />}
                                  size="medium"
                                >
                                  {editLoading ? t('saving...') : t('save')}
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <>
                              {/* Author Info with Avatar */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  <Avatar
                                    src={diary.author?.avatar_url}
                                    alt={diary.author?.username}
                                    sx={{
                                      width: 40,
                                      height: 40,
                                      bgcolor: 'primary.light',
                                      fontSize: '1.1rem',
                                    }}
                                  >
                                    {diary.author?.username?.charAt(0)?.toUpperCase() || 'U'}
                                  </Avatar>

                                  <Box>
                                    <Typography variant="body1" fontWeight="600" color="green">
                                      {diary.author?.username || 'Unknown User'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatCambodiaDate(diary.created_at)}
                                    </Typography>
                                  </Box>
                                  {/* Friend Request / Status Chips */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    {profile && diary.author?.id !== profile.id && (
                                      <>
                                        {isFriend(diary.author.id) ? (
                                          <Chip
                                            label="Friend"
                                            color="success"
                                            size="small"
                                            variant="outlined"
                                            sx={{ borderRadius: '16px' }}
                                          />
                                        ) : isRequesting(diary.author.id) ? (
                                          <Chip
                                            label="Requesting"
                                            color="warning"
                                            size="small"
                                            variant="outlined"
                                            sx={{ borderRadius: '16px' }}
                                          />
                                        ) : (
                                          <Tooltip title={`Add ${diary.author.username} as friend`}>
                                            <Button
                                              size="small"
                                              onClick={() => handleSendFriendRequest(diary.author.id)}
                                              disabled={sendingRequests.has(diary.author.id)}
                                              sx={{
                                                borderRadius: 2,
                                                textTransform: 'none',
                                                fontWeight: 500,
                                                py: 0.5,
                                                minWidth: 0
                                              }}
                                            >
                                              {sendingRequests.has(diary.author.id) ? <CircularProgress sx={{ fontSize: 22 }} /> : <PersonAddIcon sx={{ fontSize: 22 }} />}
                                            </Button>
                                          </Tooltip>
                                        )}
                                      </>
                                    )}

                                    {profile && diary.author?.id === profile.id && (
                                      <Chip
                                        label="You"
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        sx={{ fontSize: '0.75rem', height: 26 }}
                                      />
                                    )}
                                  </Box>

                                </Box>

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

                      {editingDiary !== diary.id && (
                        <Box>
                          {combinedMedia.length > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                              <Box
                                sx={{
                                  display: 'grid',
                                  gap: 0.5,
                                  borderRadius: 2,
                                  overflow: 'hidden',
                                  gridTemplateColumns: (() => {
                                    switch (visibleMedia.length) {
                                      case 1:
                                        return '1fr';
                                      case 2:
                                        return '1fr 1fr';
                                      case 3:
                                        return '2fr 1fr';
                                      default:
                                        return '1fr 1fr';
                                    }
                                  })(),
                                  gridTemplateRows:
                                    visibleMedia.length === 3 ? '1fr 1fr' : 'auto',
                                }}
                              >
                                {visibleMedia.slice(0, 4).map((media, index) => {
                                  const isLarge =
                                    visibleMedia.length === 3 && index === 0;

                                  return (
                                    <Box
                                      key={index}
                                      onClick={() => handleMediaClick(media.src, media.type)}
                                      sx={{
                                        position: 'relative',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        bgcolor: '#000',
                                        aspectRatio:
                                          visibleMedia.length === 1
                                            ? '16 / 9'
                                            : '1 / 1',
                                        gridRow: isLarge ? 'span 2' : 'auto',
                                      }}
                                    >
                                      {/* Image */}
                                      {media.type === 'image' && (
                                        <Box
                                          component="img"
                                          src={media.src}
                                          alt="feed img"
                                          sx={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                          }}
                                        />
                                      )}

                                      {/* Video */}
                                      {media.type === 'video' && (
                                        <>
                                          <Box
                                            component="img"
                                            src={media.thumbnail}
                                            alt=""
                                            sx={{
                                              width: '100%',
                                              height: '100%',
                                              objectFit: 'cover',
                                            }}
                                          />

                                          {/* Play icon */}
                                          <PlayArrowIcon
                                            sx={{
                                              position: 'absolute',
                                              top: '50%',
                                              left: '50%',
                                              transform: 'translate(-50%, -50%)',
                                              color: '#fff',
                                              fontSize: 48,
                                              opacity: 0.9,
                                            }}
                                          />
                                        </>
                                      )}

                                      {/* +X overlay */}
                                      {index === 3 && combinedMedia.length > 4 && (
                                        <Box
                                          sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            bgcolor: 'rgba(0,0,0,0.55)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontSize: 32,
                                            fontWeight: 700,
                                          }}
                                        >
                                          +{combinedMedia.length - 4}
                                        </Box>
                                      )}
                                    </Box>
                                  );
                                })}
                              </Box>

                            </Box>
                          )}

                          {diary.title && (
                            <Typography
                              sx={{
                                mt: 2,
                                fontSize: 18,
                                lineHeight: 1.5,
                              }}
                            >
                              {diary.title}
                            </Typography>
                          )}

                          <DiaryCard diary={diary} />

                          <Divider />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: { md: 2 }, mb: expandedDiary === diary.id ? 0 : 2 }}>
                            <Tooltip title='Like this post'>
                              <Button
                                onClick={() => handleLikeDiary(diary.id)}
                                size="medium"
                                sx={{
                                  minWidth: 40,
                                  padding: isMobile ? 1 : undefined,
                                  color: likedDiaries.has(diary.id) ? 'error.main' : 'inherit',
                                  fontWeight: likedDiaries.has(diary.id) ? 'bold' : 'normal',
                                  transition: 'color 0.2s, transform 0.2s',
                                  justifyContent: 'center',
                                  '&:hover': { transform: 'scale(1.05)' },
                                  display: 'flex',
                                  gap: 1
                                }}
                              >
                                {isMobile ? (
                                  likedDiaries.has(diary.id)
                                    ? <Favorite color="error" />
                                    : <FavoriteBorder />
                                ) : (
                                  <>
                                    {likedDiaries.has(diary.id)
                                      ? <Favorite color="error" />
                                      : <FavoriteBorder />
                                    }
                                    {t('like ')}
                                  </>
                                )}
                                {diary.likes.length ? (diary.likes.length) : ('')}
                              </Button>
                            </Tooltip>

                            <Tooltip title={`Have something to say?`}>
                              <Button
                                onClick={() => handleExpandDiary(diary.id)}
                                size="medium"
                                sx={{ minWidth: 40, justifyContent: 'center' }}
                              >
                                {isMobile ? (
                                  <ChatBubbleOutlineOutlinedIcon />
                                ) : (
                                  <>
                                    <ChatBubbleOutlineOutlinedIcon />
                                    <Typography ml={1}>
                                      {t('comment')}
                                    </Typography>
                                  </>
                                )}
                                <Typography ml={1}>
                                  {diary.comments.length ? (diary.comments.length) : ('')}
                                </Typography>
                              </Button>
                            </Tooltip>

                            <Tooltip title={`Share this post`}>
                              <Button
                                size="medium"
                                sx={{ minWidth: 40, justifyContent: 'center' }}
                              >
                                {isMobile ? <ShareOutlinedIcon sx={{ mb: 0.5 }} /> : <> <ShareOutlinedIcon sx={{ mb: 0.5 }} /> <Typography ml={1}>Share</Typography> </>}
                                <Typography ml={1}>

                                </Typography>
                              </Button>
                            </Tooltip>

                            <Tooltip title={`Save this post`}>
                              <Button
                                size="medium"
                                sx={{ minWidth: 40, justifyContent: 'center' }}
                              >
                                {isMobile ? <TurnedInNotOutlinedIcon sx={{ mb: 0.5 }} /> : <> <TurnedInNotOutlinedIcon sx={{ mb: 0.5 }} /> <Typography ml={1}>Save</Typography> </>}
                                <Typography ml={1}>

                                </Typography>
                              </Button>
                            </Tooltip>
                          </Box>

                          {/* Comments Section */}
                          <Collapse in={expandedDiary === diary.id}>
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: '12px', border: "1px solid" }}>
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
                                  placeholder={t('placeholder')}
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
                                    {t('image')}
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
                                      t('send')
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
                                  {t('no_comments')}
                                </Typography>
                              )}
                            </Box>
                          </Collapse>
                        </Box>
                      )}
                    </Card>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          mb: 2, width: { xs: '100%' },
          display: { xs: 'none', md: 'block' },
          mt: 2,
          maxWidth: 300
        }}
      >
        <ActivityComponent />
        <br />
        <SuggestFriendComponent />
      </Box>
    </Box>
  );
};

export default FeedTab;