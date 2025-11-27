import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Done as DoneIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Forward as ForwardIcon,
  Image as ImageIcon,
  MoreVert as MoreVertIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  ZoomIn as ZoomInIcon
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography
} from '@mui/material';
import { useRef, useState } from 'react';
import { formatCambodiaTime } from '../../utils/dateUtils';

const ChatMessage = ({
  message,
  isMine,
  onUpdate,
  onDelete,
  onForward,
  profile,
  currentFriend,
  getAvatarUrl,
  getUserInitials,
  showSeenStatus = false,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [avatarError, setAvatarError] = useState(false);
  const [seenAvatarError, setSeenAvatarError] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  /* ---------------------------------------------------------- */
  /*                     MESSAGE TYPE DETECTION                */
  /* ---------------------------------------------------------- */
const detectMessageType = (msg) => {
  if (msg.message_type === 'image') return 'image';
  if (msg.message_type === 'voice') return 'voice';
  if (msg.message_type === 'file')  return 'file';
  if (msg.message_type === 'text')  return 'text';

  const content = (msg.content || '').trim();

  const isVoiceUrl =
    content.includes('/voice_messages/') ||
    content.includes('/video/upload/') ||
    /\.(mp3|m4a|wav|ogg|aac|opus|flac|webm|mp4)$/i.test(content);

  if (isVoiceUrl) return 'voice';

  const isImageUrl =
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(content) ||
    (content.includes('cloudinary.com') && content.includes('/image/upload/')) ||
    content.startsWith('data:image/');

  if (isImageUrl) return 'image';

  return 'text';
};
  const actualMessageType = detectMessageType(message);

  /* ---------------------------------------------------------- */
  /*                     MENU HANDLERS                         */
  /* ---------------------------------------------------------- */
  const handleMenu = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleEdit = async () => {
    if (editText.trim() && editText !== message.content && onUpdate) {
      try {
        // Pass both the message ID and whether it's temporary
        await onUpdate(message.id, editText, message.is_temp);
        setEditing(false);
        handleClose();
      } catch (err) {
        console.error('Edit error:', err);
        // Don't close editing mode on error - let user retry
      }
    } else {
      setEditing(false);
      handleClose();
    }
  };

  const handleCancelEdit = () => {
    setEditText(message.content); // Reset to original
    setEditing(false);
  };

  const handleDelete = async () => {
    if (onDelete) {
      try {
        await onDelete(message.id, message.is_temp);
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
    handleClose();
  };

  const handleForwardClick = () => {
    onForward?.(message);
    handleClose();
  };

  const showMenu = true;

  /* ---------------------------------------------------------- */
  /*                     VOICE MESSAGE HANDLING                */
  /* ---------------------------------------------------------- */
  const handlePlayVoice = async (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Error playing voice message:', err);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || message.voice_duration || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || message.voice_duration || 0);
    }
  };

  /* ---------------------------------------------------------- */
  /*                     IMAGE HANDLERS                        */
  /* ---------------------------------------------------------- */
  const handleImageError = () => {
    setImageError(true);
  };

  const handleDownloadImage = async (e) => {
    e.stopPropagation();
    try {
      const response = await fetch(message.content);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const filename = `chat-image-${message.id}-${Date.now()}.jpg`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleViewFullImage = (e) => {
    e?.stopPropagation();
    setImageModalOpen(true);
  };

  const retryImageLoad = () => {
    setImageError(false);
  };

  /* ---------------------------------------------------------- */
  /*                     AVATAR HELPERS                        */
  /* ---------------------------------------------------------- */
  const getSenderInfo = () => {
    if (message.sender?.username) {
      const url = message.sender.avatar_url || message.sender.avatar;
      return {
        username: message.sender.username,
        avatar_url: getAvatarUrl ? getAvatarUrl(url) : url,
        initial: getUserInitials?.(message.sender.username) ?? (message.sender.username?.[0] ?? 'U').toUpperCase(),
      };
    }
    if (isMine) {
      const url = profile?.avatar_url || profile?.avatar;
      return {
        username: profile?.username ?? 'Me',
        avatar_url: getAvatarUrl ? getAvatarUrl(url) : url,
        initial: getUserInitials?.(profile?.username) ?? (profile?.username?.[0] ?? 'M').toUpperCase(),
      };
    }
    if (currentFriend) {
      const url = currentFriend.avatar_url || currentFriend.avatar;
      return {
        username: currentFriend.username ?? 'Friend',
        avatar_url: getAvatarUrl ? getAvatarUrl(url) : url,
        initial: getUserInitials?.(currentFriend.username) ?? (currentFriend.username?.[0] ?? 'F').toUpperCase(),
      };
    }
    return { username: 'Unknown', avatar_url: null, initial: 'U' };
  };

  const senderInfo = getSenderInfo();

  const myAvatar = () => {
    const url = profile?.avatar_url || profile?.avatar;
    return {
      avatar_url: getAvatarUrl ? getAvatarUrl(url) : url,
      initial: getUserInitials?.(profile?.username) ?? (profile?.username?.[0] ?? 'M').toUpperCase(),
    };
  };

  const friendAvatar = () => {
    if (!currentFriend) return { avatar_url: null, initial: 'F' };
    const url = currentFriend.avatar_url || currentFriend.avatar;
    return {
      avatar_url: getAvatarUrl ? getAvatarUrl(url) : url,
      initial: getUserInitials?.(currentFriend.username) ?? (currentFriend.username?.[0] ?? 'F').toUpperCase(),
    };
  };

  const myAv = myAvatar();
  const friendAv = friendAvatar();

  /* ---------------------------------------------------------- */
  /*                     STATUS LOGIC                           */
  /* ---------------------------------------------------------- */
  const getMessageStatus = () => {
    if (!isMine) return 'sent';
    if (message.is_temp) return 'sending';
    if (message.is_read === true) return 'seen';
    if (message.seen_by && message.seen_by.length > 0) return 'seen';
    if (message.delivered_at) return 'delivered';
    return 'sent';
  };

  const status = getMessageStatus();

  const renderTick = () => {
    switch (status) {
      case 'sending':
        return <DoneIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)' }} />;
      case 'sent':
        return <DoneIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)' }} />;
      case 'delivered':
        return <DoneAllIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)' }} />;
      case 'seen':
        return <DoneAllIcon sx={{ fontSize: '1rem', color: '#34B7F1' }} />;
      default:
        return null;
    }
  };

  const renderSeenAvatar = () => {
    // Only show for MY messages that have been seen
    if (!isMine) return null;

    // Get the reader (should be the friend for 1-on-1 chat)
    const reader = currentFriend;
    if (!reader) return null;

    // Check if this specific friend has seen the message
    const hasSeen = Array.isArray(message.seen_by) &&
      message.seen_by.some(s => s.user_id === reader.id);

    if (hasSeen) {
      const seenInfo = message.seen_by.find(s => s.user_id === reader.id);

      return (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          mt: 0.5,
          gap: 0.5,
          minHeight: 20 // Prevent layout shift
        }}>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.7rem',
              color: 'text.secondary',
              fontWeight: 500
            }}
          >
            Seen
          </Typography>
          <Avatar
            src={getAvatarUrl(reader.avatar_url)}
            sx={{
              width: 16,
              height: 16,
              border: '1px solid',
              borderColor: 'background.paper'
            }}
            onError={() => setSeenAvatarError(true)}
          >
            {getUserInitials(reader.username)}
          </Avatar>
        </Box>
      );
    }

    // Show "Delivered" status for messages that are delivered but not seen
    if (message.is_read && !hasSeen) {
      return (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          mt: 0.5
        }}>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.7rem',
              color: 'text.secondary',
              fontWeight: 500
            }}
          >
            Delivered
          </Typography>
        </Box>
      );
    }

    return null;
  };

  /* ---------------------------------------------------------- */
  /*                     RENDER VOICE                           */
  /* ---------------------------------------------------------- */
const renderVoiceContent = () => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Box sx={{ mb: 1 }}>
      {/* Hidden audio element — plays real MP3 from backend */}
      <audio
        ref={audioRef}
        src={message.content}               // Direct MP3 URL
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        preload="metadata"
      />

      {/* Beautiful voice message bubble */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          bgcolor: isMine ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
          borderRadius: '16px',
          border: '1px solid',
          borderColor: isMine ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          maxWidth: '320px',
          '&:hover': {
            bgcolor: isMine ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.09)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          },
        }}
        onClick={handlePlayVoice}
      >
        {/* Play/Stop Button */}
        <IconButton
          size="small"
          sx={{
            bgcolor: isMine ? 'white' : 'primary.main',
            color: isMine ? 'primary.main' : 'white',
            width: 40,
            height: 40,
            '&:hover': {
              bgcolor: isMine ? 'grey.100' : 'primary.dark',
            },
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {isPlaying ? <StopIcon /> : <PlayArrowIcon />}
        </IconButton>

        {/* Text + Progress */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5,
              color: isMine ? 'white' : 'text.primary',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            Voice message
            <Box
              component="span"
              sx={{
                fontSize: '0.65rem',
                fontWeight: 'bold',
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                px: 0.8,
                py: 0.2,
                borderRadius: 1,
                letterSpacing: '0.5px',
              }}
            >
              MP3
            </Box>
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Progress Bar */}
            <Box
              sx={{
                flex: 1,
                height: 6,
                bgcolor: isMine ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.12)',
                borderRadius: 3,
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  width: `${progress}%`,
                  bgcolor: isMine ? 'white' : 'primary.main',
                  borderRadius: 3,
                  transition: 'width 0.15s ease-out',
                  boxShadow: '0 0 8px rgba(255,255,255,0.4)',
                }}
              />
            </Box>

            {/* Duration */}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 'bold',
                minWidth: 48,
                textAlign: 'right',
                color: isMine ? 'white' : 'text.primary',
                opacity: 0.9,
                fontSize: '0.85rem',
              }}
            >
              {Math.floor(message.voice_duration || duration || 0)}s
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

  /* ---------------------------------------------------------- */
  /*                     RENDER IMAGE CONTENT                  */
  /* ---------------------------------------------------------- */
  const renderImageContent = () => (
    <Box sx={{ mb: 1, position: 'relative' }}>
      {imageError && (
        <Box
          sx={{
            width: '100%',
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.100',
            borderRadius: '8px',
            border: '1px dashed',
            borderColor: 'grey.300',
            flexDirection: 'column',
            gap: 1
          }}
        >
          <ImageIcon sx={{ color: 'grey.400', fontSize: 40 }} />
          <Typography variant="body2" color="text.secondary" align="center">
            Failed to load image
          </Typography>
          <Button size="small" variant="outlined" onClick={retryImageLoad}>
            Retry
          </Button>
        </Box>
      )}

      {!imageError && (
        <>
          <img
            src={message.content}
            alt="Chat image"
            onError={handleImageError}
            style={{
              maxWidth: '100%',
              maxHeight: 300,
              borderRadius: '8px',
              cursor: 'pointer',
              objectFit: 'cover',
            }}
            onClick={handleViewFullImage}
          />

          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              gap: 0.5,
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
            className="image-actions"
          >
            <IconButton
              size="small"
              onClick={handleViewFullImage}
              sx={{
                bgcolor: 'rgba(0,0,0,0.7)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
              }}
            >
              <ZoomInIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleDownloadImage}
              sx={{
                bgcolor: 'rgba(0,0,0,0.7)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
              }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Box>
        </>
      )}
    </Box>
  );

  /* ---------------------------------------------------------- */
  /*                     RENDER                                 */
  /* ---------------------------------------------------------- */
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        mb: 2,
        px: 1,
        position: 'relative',
      }}
      data-message-id={message.id}
      data-is-unread={!isMine && !message.is_read && !message.is_temp ? "true" : "false"}
      data-is-friend={!isMine ? "true" : "false"} // Add this for auto-seen
      data-sender-id={message.sender_id}
    >
      {/* Image Modal */}
      {imageModalOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setImageModalOpen(false)}
        >
          <Box
            sx={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              sx={{
                position: 'absolute',
                top: -40,
                right: 0,
                color: 'white',
                bgcolor: 'rgba(0,0,0,0.5)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
              }}
              onClick={() => setImageModalOpen(false)}
            >
              <CloseIcon />
            </IconButton>

            <img
              src={message.content}
              alt="Full size chat image"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: '8px',
                objectFit: 'contain',
              }}
            />

            <Box sx={{ position: 'absolute', bottom: -40, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 1 }}>
              <IconButton
                onClick={handleDownloadImage}
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <DownloadIcon />
              </IconButton>
              {isMine && (
                <IconButton
                  onClick={handleDelete}
                  sx={{
                    color: 'white',
                    bgcolor: 'rgba(244,67,54,0.7)',
                    '&:hover': { bgcolor: 'rgba(244,67,54,0.9)' },
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Friend avatar (left) */}
      {!isMine && (
        <Avatar
          src={avatarError ? undefined : senderInfo.avatar_url}
          sx={{
            width: 32,
            height: 32,
            mr: 1,
            mt: 'auto',
            fontSize: '0.8rem',
            bgcolor: 'primary.main',
            fontWeight: 'bold',
          }}
          imgProps={{ onError: () => setAvatarError(true) }}
        >
          {senderInfo.initial}
        </Avatar>
      )}

      <Box sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
        {/* Friend name */}
        {!isMine && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', mb: 0.5, ml: 1, fontWeight: 500 }}
          >
            {senderInfo.username}
          </Typography>
        )}

        {editing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 300 }}>
            <TextField
              size="small"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              multiline
              maxRows={4}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleEdit();
                } else if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
              sx={{ borderRadius: '12px' }}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={handleCancelEdit}>Cancel</Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleEdit}
                disabled={!editText.trim() || editText === message.content}
              >
                Save
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ position: 'relative' }} className="message-bubble">
            {/* Message bubble */}
            <Box
              sx={{
                bgcolor: isMine ? '#0088cc' : '#f0f0f0',
                color: isMine ? 'white' : 'text.primary',
                p: 2,
                borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                position: 'relative',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  '& .image-actions': {
                    opacity: 1
                  }
                },
              }}
            >
              {/* Forwarded badge */}
              {message.is_forwarded && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, opacity: 0.8 }}>
                  <ForwardIcon fontSize="small" sx={{ mr: 0.5, fontSize: '1rem' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                    Forwarded {message.original_sender && `from ${message.original_sender}`}
                  </Typography>
                </Box>
              )}

              {/* Content */}
              {actualMessageType === 'image' ? (
                renderImageContent()
              ) : actualMessageType === 'voice' ? (
                renderVoiceContent()
              ) : (
                <Typography
                  variant="body2"
                  sx={{ wordBreak: 'break-word', lineHeight: 1.4, fontSize: '0.9rem' }}
                >
                  {message.content}
                </Typography>
              )}

              {/* Time + tick */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 1, gap: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.7, fontSize: '0.7rem', lineHeight: 1 }}
                >
                  {formatCambodiaTime(message.created_at)}
                  {message.updated_at && message.updated_at !== message.created_at && ' (edited)'}
                </Typography>
                {isMine && renderTick()}
              </Box>

              {/* Menu button */}
              {showMenu && (
                <IconButton
                  size="small"
                  onClick={handleMenu}
                  className="message-actions"
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: isMine ? -8 : 'auto',
                    left: isMine ? 'auto' : -8,
                    bgcolor: isMine ? '#0088cc' : '#f0f0f0',
                    color: isMine ? 'white' : 'text.primary',
                    opacity: 1,
                    pointerEvents: 'auto',
                    transition: 'all 0.2s ease',
                    width: 24,
                    height: 24,
                    zIndex: 10,
                    '&:hover': {
                      bgcolor: isMine ? '#0077b3' : '#e0e0e0',
                      transform: 'scale(1.1)',
                    },
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>
        )}

        {/* Seen status */}
        {renderSeenAvatar()}

        {/* Context menu */}
        {showMenu && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'top', horizontal: isMine ? 'left' : 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: isMine ? 'right' : 'left' }}
            PaperProps={{
              sx: {
                borderRadius: '12px',
                zIndex: 9999
              }
            }}
          >
            {/* Image-specific options */}
            {actualMessageType === 'image' && [
              <MenuItem key="view-full" onClick={handleViewFullImage}>
                <ZoomInIcon fontSize="small" sx={{ mr: 1.5 }} />
                View Full Image
              </MenuItem>,
              <MenuItem key="download" onClick={handleDownloadImage}>
                <DownloadIcon fontSize="small" sx={{ mr: 1.5 }} />
                Download Image
              </MenuItem>
            ]}

            {/* My messages */}
            {isMine && [
              actualMessageType === 'text' && (
                <MenuItem key="edit" onClick={() => { setEditing(true); setEditText(message.content); handleClose(); }}>
                  <EditIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Edit
                </MenuItem>
              ),
              <MenuItem key="forward" onClick={handleForwardClick}>
                <ForwardIcon fontSize="small" sx={{ mr: 1.5 }} />
                Forward
              </MenuItem>,
              <MenuItem key="delete" onClick={handleDelete} sx={{ color: 'error.main' }}>
                <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
                Delete
              </MenuItem>
            ].filter(Boolean)}

            {/* Friend's messages */}
            {!isMine && (
              <MenuItem key="forward" onClick={handleForwardClick}>
                <ForwardIcon fontSize="small" sx={{ mr: 1.5 }} />
                Forward
              </MenuItem>
            )}
          </Menu>
        )}
      </Box>

      {/* My avatar (right) */}
      {isMine && (
        <Avatar
          src={avatarError ? undefined : myAv.avatar_url}
          sx={{
            width: 32,
            height: 32,
            ml: 1,
            mt: 'auto',
            fontSize: '0.8rem',
            bgcolor: 'primary.main',
            fontWeight: 'bold',
          }}
          imgProps={{ onError: () => setAvatarError(true) }}
        >
          {myAv.initial}
        </Avatar>
      )}
    </Box>
  );
};

export default ChatMessage;