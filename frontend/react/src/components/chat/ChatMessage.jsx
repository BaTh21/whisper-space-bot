import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Done as DoneIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Forward as ForwardIcon,
  Image as ImageIcon,
  Schedule as LastSeenIcon,
  MoreVert as MoreVertIcon,
  FiberManualRecord as OnlineIcon,
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
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCambodiaTime } from '../../utils/dateUtils';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import CallIcon from '@mui/icons-material/Call';

import EmojiButton from '../EmojiButton';
import MessageReactions from '../MessageReactions';

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
  onAddReaction,
  onRemoveReaction,
  onLoadReactions,
  onCallBack
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [avatarError, setAvatarError] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [friendOnlineStatus, setFriendOnlineStatus] = useState(null);
  const [lastSeenTime, setLastSeenTime] = useState(null);
  const [showOnlineStatusTooltip, setShowOnlineStatusTooltip] = useState(false);
  const [reactions, setReactions] = useState(message.reactions || []);
  const [showReactionAnimation, setShowReactionAnimation] = useState(null);
  const { t, i18n } = useTranslation();

  const detectMessageType = (msg) => {
    if (msg.message_type === 'image') return 'image';
    if (msg.message_type === 'voice') return 'voice';
    if (msg.message_type === 'file') return 'file';
    if (msg.message_type === 'text') return 'text';
    if (msg.message_type === 'system') return 'system';

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

  const handleMenu = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleEdit = async () => {
    if (!editText.trim() || editText === message.content || !onUpdate) {
      setEditing(false);
      handleClose();
      return;
    }

    setIsEditing(true);

    try {
      await onUpdate(message.id, editText, message.is_temp);
      setEditing(false);
      handleClose();
    } catch (err) {
      console.error('Edit error:', err);
    }

    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.content);
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
        return <DoneAllIcon sx={{ fontSize: '1rem', color: '#ffffffff' }} />;
      default:
        return null;
    }
  };

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
            gap: 1.5,
            p: 1.5,
            bgcolor: isMine ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
            borderRadius: '16px',
            border: '1px solid',
            borderColor: isMine ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            maxWidth: '280px',
            '&:hover': {
              bgcolor: isMine ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.09)',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            },
          }}
          onClick={handlePlayVoice}
        >
          <IconButton
            size="small"
            sx={{
              bgcolor: isMine ? 'white' : 'primary.main',
              color: isMine ? 'primary.main' : 'white',
              width: 32,
              height: 32,
              '&:hover': {
                bgcolor: isMine ? 'grey.100' : 'primary.dark',
              },
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {isPlaying ? <StopIcon /> : <PlayArrowIcon />}
          </IconButton>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                mb: 0.5,
                color: isMine ? 'white' : 'text.primary',
                fontSize: '0.8rem',
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
              <Box
                sx={{
                  flex: 1,
                  height: 4,
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

              <Typography
                variant="caption"
                sx={{
                  fontWeight: 'bold',
                  minWidth: 48,
                  textAlign: 'right',
                  color: isMine ? 'white' : 'text.primary',
                  opacity: 0.9,
                  fontSize: '0.75rem',
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

  const renderCallMessage = () => {
    return (
      <Box>
        <Typography
          variant="body2"
          sx={{
            wordBreak: 'break-word',
            lineHeight: 1.4,
            fontSize: '0.9rem',
            mb: reactions.length > 0 ? 0.5 : 0,
            color: isMine ? 'white' : 'text.primary'
          }}
        >
          {message.content}
        </Typography>

        <Button
          variant="outlined"
          size="small"
          sx={{
            width: '100%',
            mt: 1,
            color: isMine ? 'white' : 'primary.dark',
            borderColor: isMine ? 'white' : 'primary.dark',
            '&:hover': {
              borderColor: isMine ? 'white' : 'primary.dark',
              backgroundColor: isMine ? 'rgba(255,255,255,0.1)' : undefined
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            onCallBack()
          }}
        >
          <CallIcon
            sx={{
              fontSize: 18,
              mr: 0.5
            }}
          />
          Call Back
        </Button>
      </Box>
    );
  };

  const renderOnlineStatus = () => {
    if (isMine || !friendOnlineStatus || !currentFriend) return null;

    const isOnline = friendOnlineStatus.is_online;

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          ml: 1,
          position: 'relative',
          cursor: 'help'
        }}
        onMouseEnter={() => setShowOnlineStatusTooltip(true)}
        onMouseLeave={() => setShowOnlineStatusTooltip(false)}
      >
        {isOnline ? (
          <>
            <OnlineIcon
              sx={{
                fontSize: '0.6rem',
                color: '#4CAF50',
                filter: 'drop-shadow(0 0 2px rgba(76, 175, 80, 0.5))',
                animation: 'pulse 2s infinite'
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: '#4CAF50',
                fontWeight: 500,
                fontSize: '0.65rem',
                letterSpacing: '0.3px'
              }}
            >
              Online
            </Typography>
          </>
        ) : (
          <>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: 0.3
              }}
            >
              <LastSeenIcon fontSize="inherit" />
              {lastSeenTime || ''}
            </Typography>
          </>
        )}

        {showOnlineStatusTooltip && (
          <Box
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              bgcolor: 'background.paper',
              boxShadow: 3,
              borderRadius: '8px',
              p: 1.5,
              minWidth: 180,
              zIndex: 9999,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Typography variant="caption" fontWeight="bold">
              {currentFriend.username}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: isOnline ? '#4CAF50' : '#9E9E9E',
                  animation: isOnline ? 'pulse 2s infinite' : 'none'
                }}
              />
            </Box>

            {!isOnline && friendOnlineStatus.last_seen && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                Last seen: {new Date(friendOnlineStatus.last_seen).toLocaleString()}
              </Typography>
            )}

            {friendOnlineStatus.last_activity && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                Last activity: {new Date(friendOnlineStatus.last_activity).toLocaleTimeString()}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  };

  useEffect(() => {
    if (!isMine && currentFriend) {
      const fetchFriendStatus = async () => {
        try {
          const { getUserOnlineStatus } = await import('../../services/api');
          const status = await getUserOnlineStatus(currentFriend.id);
          setFriendOnlineStatus(status);

          if (status.last_seen) {
            const lastSeen = new Date(status.last_seen);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));

            if (diffMinutes < 1) {
              setLastSeenTime('just now');
            } else if (diffMinutes < 60) {
              setLastSeenTime(`${diffMinutes}m ago`);
            } else if (diffMinutes < 1440) {
              const hours = Math.floor(diffMinutes / 60);
              setLastSeenTime(`${hours}h ago`);
            } else {
              const days = Math.floor(diffMinutes / 1440);
              setLastSeenTime(`${days}d ago`);
            }
          }
        } catch (err) {
          console.error('Failed to fetch friend status:', err);
        }
      };

      fetchFriendStatus();
      const interval = setInterval(fetchFriendStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isMine, currentFriend]);

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}
`;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  useEffect(() => {
    setReactions(message.reactions || []);
  }, [message.reactions]);

  // Enhanced add reaction handler
  const handleAddReaction = async (emoji) => {
    if (onAddReaction) {
      try {
        // Show immediate animation
        setShowReactionAnimation({
          emoji,
          type: 'add',
          timestamp: Date.now()
        });

        // Clear animation after 1 second
        setTimeout(() => {
          setShowReactionAnimation(null);
        }, 1000);

        await onAddReaction(message.id, emoji);

        // Play sound if available (optional)
        playReactionSound('add');
      } catch (err) {
        console.error('Failed to add reaction:', err);
      }
    }
  };

  // Enhanced remove reaction handler
  const handleRemoveReaction = async (reactionId) => {
    if (onRemoveReaction) {
      try {
        const reactionToRemove = reactions.find(r => r.id === reactionId);
        if (reactionToRemove) {
          // Show immediate animation
          setShowReactionAnimation({
            emoji: reactionToRemove.emoji,
            type: 'remove',
            timestamp: Date.now()
          });

          // Clear animation after 1 second
          setTimeout(() => {
            setShowReactionAnimation(null);
          }, 1000);
        }

        await onRemoveReaction(message.id, reactionId);

        // Play sound if available (optional)
        playReactionSound('remove');
      } catch (err) {
        console.error('Failed to remove reaction:', err);
      }
    }
  };

  // Load reactions when component mounts - ONLY for non-temp messages
  useEffect(() => {
    // Check if this is a temp message
    const isTempMessage = message.is_temp ||
      (typeof message.id === 'string' && message.id.startsWith('temp-'));

    // Only load reactions for real messages
    if (onLoadReactions && message.id && !isTempMessage && !message.reactions) {
      onLoadReactions(message.id);
    }
  }, [message.id, onLoadReactions, message.reactions, message.is_temp]);

  // Animation for new reactions
  useEffect(() => {
    if (showReactionAnimation) {
      const floatingAnimation = document.createElement('div');
      floatingAnimation.className = 'floating-emoji';
      floatingAnimation.innerHTML = showReactionAnimation.emoji;

      const messageBubble = document.querySelector(`[data-message-id="${message.id}"] .message-bubble`);
      if (messageBubble) {
        const rect = messageBubble.getBoundingClientRect();
        floatingAnimation.style.cssText = `
          position: fixed;
          font-size: 24px;
          z-index: 9999;
          pointer-events: none;
          animation: floatUp 1s ease-out forwards;
          left: ${rect.right - 30}px;
          top: ${rect.top}px;
        `;

        document.body.appendChild(floatingAnimation);

        setTimeout(() => {
          if (floatingAnimation.parentNode) {
            document.body.removeChild(floatingAnimation);
          }
        }, 1000);
      }
    }
  }, [showReactionAnimation, message.id]);

  // Sound effect helper
  const playReactionSound = (type) => {
    if (typeof window === 'undefined') return;

    try {
      const audio = new Audio();
      audio.volume = 0.2;

      if (type === 'add') {
        audio.src = 'https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3';
      } else if (type === 'remove') {
        audio.src = 'https://assets.mixkit.co/sfx/preview/mixkit-plastic-bubble-click-1124.mp3';
      }

      audio.play().catch(() => { });
    } catch (error) { }
  };

  // Add CSS animations for reactions
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes floatUp {
        0% {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
        50% {
          transform: translateY(-30px) scale(1.2);
          opacity: 0.8;
        }
        100% {
          transform: translateY(-60px) scale(0.8);
          opacity: 0;
        }
      }
      
      @keyframes reactionPop {
        0% { transform: scale(0.5); opacity: 0; }
        70% { transform: scale(1.1); }
        100% { transform: scale(1); opacity: 1; }
      }
      
      .floating-emoji {
        will-change: transform, opacity;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

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

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        mb: 1,
        px: 1,
        position: 'relative',
      }}
      data-message-id={message.id}
      data-is-unread={!isMine && !message.is_read && !message.is_temp ? "true" : "false"}
      data-is-friend={!isMine ? "true" : "false"}
      data-sender-id={message.sender_id}
    >
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

      {!isMine && (
        <Avatar
          src={avatarError ? undefined : senderInfo.avatar_url}
          sx={{
            width: 32,
            height: 32,
            mr: 1,
            mt: 'auto',
            fontSize: '0.8rem',
            fontWeight: 'bold',
          }}
          imgProps={{ onError: () => setAvatarError(true) }}
        >
          {senderInfo.initial}
        </Avatar>
      )}

      <Box sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
        {!isMine && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, ml: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 500, mr: 1 }}
            >
              {senderInfo.username}
            </Typography>
            {renderOnlineStatus()}
          </Box>
        )}

        {editing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
            <EmojiButton
              onSelect={(emoji) => setEditText(prev => prev + emoji)}
              placement="bottom-start"
              size="small"
              width={300}
              height={350}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={handleCancelEdit}>{t('cancel')}</Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleEdit}
                disabled={isEditing}
              >
                {isEditing ? "Saving..." : t('save')}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ position: 'relative', width: '100%' }}>
            {/* Message bubble */}
            <Box
              className="message-bubble"
              sx={{
                bgcolor: isMine ? 'primary.main' : '#f0f0f0',
                color: isMine ? 'white' : 'text.primary',
                p: 1.4,
                borderRadius: isMine ? '18px 18px 4px 18px' : '4px 18px  18px 18px ',
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
              onClick={handleMenu}
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
              ) : actualMessageType === 'system' ? (
                renderCallMessage()
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    wordBreak: 'break-word',
                    lineHeight: 1.4,
                    fontSize: '0.9rem',
                    mb: reactions.length > 0 ? 0.5 : 0
                  }}
                >
                  {message.content}
                </Typography>
              )}

              {/* Time + tick */}
              <Box sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                mt: reactions.length > 0 ? 0.5 : 1,
                gap: 0.5
              }}>
                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.7,
                    fontSize: '0.7rem',
                    lineHeight: 1,
                    color: isMine ? 'rgba(255, 255, 255, 1)' : 'text.secondary'
                  }}
                >
                  {formatCambodiaTime(message.created_at)}
                  {message.updated_at && message.updated_at !== message.created_at && ' (edited)'}
                </Typography>
                {isMine && renderTick()}
              </Box>

              {!message.is_temp && reactions.length > 0 && (
                <Box
                  sx={{
                    mt: 0.5,
                    pt: 0.5,
                    borderTop: '1px solid',
                    borderColor: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  }}
                  onClick={(e) => { e.stopPropagation() }}
                >
                  <MessageReactions
                    messageId={message.id}
                    reactions={reactions}
                    currentUserId={profile?.id}
                    onAddReaction={handleAddReaction}
                    onRemoveReaction={handleRemoveReaction}
                    showAddButton={true}
                    size="small"
                    isMine={isMine}
                  />
                </Box>
              )}
            </Box>
          </Box>
        )}

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
            {(() => {
              const menuItems = [];

              if (actualMessageType === 'image') {
                menuItems.push(
                  <MenuItem key="view-full" onClick={handleViewFullImage}>
                    <ZoomInIcon fontSize="small" sx={{ mr: 1.5 }} />
                    {t('view_full_image')}
                  </MenuItem>,
                  <MenuItem key="download" onClick={handleDownloadImage}>
                    <DownloadIcon fontSize="small" sx={{ mr: 1.5 }} />
                    {t('download_image')}
                  </MenuItem>
                );
              }

              if (isMine) {
                if (actualMessageType === 'text') {
                  menuItems.push(
                    <MenuItem
                      key="edit"
                      onClick={() => {
                        setEditing(true);
                        setEditText(message.content);
                        handleClose();
                      }}
                    >
                      <EditIcon fontSize="small" sx={{ mr: 1.5 }} />
                      {t('edit')}
                    </MenuItem>
                  );
                }
                menuItems.push(
                  <MenuItem
                    key="react"
                  >
                    <MessageReactions
                      messageId={message.id}
                      reactions={reactions}
                      currentUserId={profile?.id}
                      onAddReaction={handleAddReaction}
                      onRemoveReaction={handleRemoveReaction}
                      showAddButton={true}
                      size="small"
                      isMine={isMine}
                    />
                  </MenuItem>,
                  <MenuItem key="forward" onClick={handleForwardClick}>
                    <ShortcutIcon fontSize="small" sx={{ mr: 1.5 }} />
                    {t('forward')}
                  </MenuItem>,
                  <MenuItem
                    key="delete"
                    onClick={handleDelete}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
                    {t('delete')}
                  </MenuItem>
                );
              } else {
                menuItems.push(
                  <MenuItem
                    key="react">
                    <MessageReactions
                      messageId={message.id}
                      reactions={reactions}
                      currentUserId={profile?.id}
                      onAddReaction={handleAddReaction}
                      onRemoveReaction={handleRemoveReaction}
                      showAddButton={true}
                      size="small"
                      isMine={isMine}
                    />
                  </MenuItem>,
                  <MenuItem key="forward" onClick={handleForwardClick}>
                    <ShortcutIcon fontSize="small" sx={{ mr: 1.5 }} />
                    {t('forward')}
                  </MenuItem>
                );
              }

              return menuItems;
            })()}
          </Menu>
        )}
      </Box>

    </Box>
  );
};

export default ChatMessage;