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
  PushPin as PushPinIcon,
  Reply as ReplyIcon,
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
  onReply,
  onForward,
  onPin,
  profile,
  currentFriend,
  getAvatarUrl,
  getUserInitials,
  isPinned = false,
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
  // First check explicit message_type from server
  if (msg.message_type === 'image') return 'image';
  if (msg.message_type === 'voice') return 'voice';
  
  const content = msg.content || '';
  
  // Voice detection - ONLY MP3 files
  const isVoiceUrl = 
    content.match(/\.mp3$/i) || // Only .mp3 extension
    content.startsWith('data:audio/mp3') ||
    content.startsWith('data:audio/mpeg') ||
    (content.startsWith('blob:') && content.includes('audio/mp3'));
  
  if (isVoiceUrl) return 'voice';
  
  // Image detection - everything else that looks like media
  const isImageUrl = 
    content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|webm)$/i) || // Added webm to images
    content.includes('cloudinary.com') ||
    content.includes('res.cloudinary.com') ||
    content.startsWith('data:image/') ||
    content.startsWith('data:video/') || // Video data URLs
    content.startsWith('blob:');
  
  if (isImageUrl) return 'image';
  
  // Default to text
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
        await onUpdate(message.id, editText, message.is_temp);
      } catch (err) {
        console.error('Edit error:', err);
      }
    }
    setEditing(false);
    handleClose();
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

  const handleReplyClick = () => { 
    if (onReply) {
      onReply(message);
    }
    handleClose(); 
  };

  const handlePinClick = () => { 
    onPin?.(message); 
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

    if (message.is_read === true && message.read_at) return 'seen';
    if (message.delivered_at) return 'delivered';
    if (message.status === 'seen') return 'seen';
    if (message.status === 'delivered') return 'delivered';
    if (message.status === 'sent') return 'sent';
    
    if (message.seen_status === 'seen') return 'seen';
    if (message.seen_status === 'delivered') return 'delivered';

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
    if (!showSeenStatus || !isMine || status !== 'seen') return null;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 0.5, gap: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.7, color: 'text.secondary' }}>
          Seen
        </Typography>
        <Avatar
          src={seenAvatarError ? undefined : friendAv.avatar_url}
          sx={{ width: 16, height: 16, fontSize: '0.5rem', bgcolor: 'primary.main' }}
          imgProps={{ onError: () => setSeenAvatarError(true) }}
        >
          {friendAv.initial}
        </Avatar>
      </Box>
    );
  };

  /* ---------------------------------------------------------- */
  /*                     RENDER VOICE                           */
  /* ---------------------------------------------------------- */
  const renderVoiceContent = () => {
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <Box sx={{ mb: 1 }}>
        <audio
          ref={audioRef}
          src={message.content}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadedMetadata={handleLoadedMetadata}
          preload="metadata"
        />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            bgcolor: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: isMine ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: isMine ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
            },
            maxWidth: '300px',
          }}
          onClick={handlePlayVoice}
        >
          <IconButton 
            size="small" 
            sx={{
              bgcolor: isMine ? 'white' : 'primary.main',
              color: isMine ? 'primary.main' : 'white',
              '&:hover': {
                bgcolor: isMine ? 'grey.100' : 'primary.dark',
              },
            }}
          >
            {isPlaying ? <StopIcon /> : <PlayArrowIcon />}
          </IconButton>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, color: isMine ? 'white' : 'text.primary' }}>
              Voice message
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box 
                sx={{ 
                  flex: 1, 
                  height: 4, 
                  bgcolor: isMine ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
                  borderRadius: 2,
                  overflow: 'hidden'
                }}
              >
                <Box 
                  sx={{ 
                    height: '100%', 
                    bgcolor: isMine ? 'white' : 'primary.main',
                    width: `${progress}%`,
                    borderRadius: 2,
                    transition: 'width 0.1s ease'
                  }} 
                />
              </Box>
              <Typography 
                variant="caption" 
                sx={{ 
                  opacity: 0.7, 
                  minWidth: 40,
                  color: isMine ? 'white' : 'text.primary'
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
      {/* Error state */}
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
          <Button 
            size="small" 
            variant="outlined"
            onClick={retryImageLoad}
          >
            Retry
          </Button>
        </Box>
      )}
      
      {/* Image */}
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
          
          {/* Image actions overlay */}
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
            
            {/* Modal actions */}
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

      {/* Pin badge */}
      {isPinned && (
        <Box
          sx={{
            position: 'absolute',
            top: -8,
            left: isMine ? 'auto' : 40,
            right: isMine ? 40 : 'auto',
            bgcolor: 'warning.main',
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: '12px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            zIndex: 1,
          }}
        >
          <PushPinIcon fontSize="small" sx={{ fontSize: '0.8rem' }} />
          Pinned
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
              sx={{ borderRadius: '12px' }}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="small" variant="contained" onClick={handleEdit}>Save</Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ position: 'relative' }} className="message-bubble">
            {/* Reply preview */}
            {message.reply_to && (
              <Box
                sx={{
                  mb: 1,
                  p: 1.5,
                  bgcolor: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderRadius: '8px',
                  borderLeft: '3px solid',
                  borderColor: isMine ? 'rgba(255,255,255,0.5)' : 'primary.main',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: isMine ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' },
                }}
                onClick={() => onReply?.(message.reply_to)}
              >
                <Typography 
                  variant="caption" 
                  sx={{ 
                    opacity: 0.7, 
                    display: 'block', 
                    fontWeight: 500,
                    color: isMine ? 'white' : 'text.primary'
                  }}
                >
                  Replying to{' '}
                  {message.reply_to.sender_id === profile?.id
                    ? 'yourself'
                    : message.reply_to.sender_username ?? senderInfo.username}
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    mt: 0.5, 
                    opacity: 0.8, 
                    fontStyle: 'italic', 
                    lineHeight: 1.3,
                    color: isMine ? 'white' : 'text.primary'
                  }}
                >
                  {message.reply_to.content}
                </Typography>
              </Box>
            )}

            {/* Message bubble */}
            <Box
              sx={{
                bgcolor: isMine ? '#0088cc' : '#f0f0f0',
                color: isMine ? 'white' : 'text.primary',
                p: 2,
                borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                position: 'relative',
                boxShadow: isPinned ? '0 2px 8px rgba(255,152,0,0.3)' : '0 1px 2px rgba(0,0,0,0.1)',
                border: isPinned ? '2px solid' : 'none',
                borderColor: isPinned ? 'warning.main' : 'transparent',
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

              {/* ALWAYS VISIBLE menu button */}
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

        {/* Seen: Friend's avatar + "Seen" */}
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
            {/* Image message specific options */}
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

            {/* For MY messages - Show ALL menu items */}
            {isMine && [
              actualMessageType === 'text' && (
                <MenuItem key="edit" onClick={() => { setEditing(true); setEditText(message.content); handleClose(); }}>
                  <EditIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Edit
                </MenuItem>
              ),
              <MenuItem key="reply" onClick={handleReplyClick}>
                <ReplyIcon fontSize="small" sx={{ mr: 1.5 }} />
                Reply
              </MenuItem>,
              <MenuItem key="pin" onClick={handlePinClick}>
                <PushPinIcon fontSize="small" sx={{ mr: 1.5 }} />
                {isPinned ? 'Unpin Message' : 'Pin Message'}
              </MenuItem>,
              <MenuItem key="forward" onClick={handleForwardClick}>
                <ForwardIcon fontSize="small" sx={{ mr: 1.5 }} />
                Forward
              </MenuItem>,
              <MenuItem key="delete" onClick={handleDelete} sx={{ color: 'error.main' }}>
                <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
                Delete
              </MenuItem>
            ].filter(Boolean)}

            {/* For FRIEND'S messages - Show Reply, Pin, Forward */}
            {!isMine && [
              <MenuItem key="reply" onClick={handleReplyClick}>
                <ReplyIcon fontSize="small" sx={{ mr: 1.5 }} />
                Reply
              </MenuItem>,
              <MenuItem key="pin" onClick={handlePinClick}>
                <PushPinIcon fontSize="small" sx={{ mr: 1.5 }} />
                {isPinned ? 'Unpin Message' : 'Pin Message'}
              </MenuItem>,
              <MenuItem key="forward" onClick={handleForwardClick}>
                <ForwardIcon fontSize="small" sx={{ mr: 1.5 }} />
                Forward
              </MenuItem>
            ]}
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