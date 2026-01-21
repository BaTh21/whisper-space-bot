import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Done as DoneIcon,
  Edit as EditIcon,
  Image as ImageIcon,
  Schedule as LastSeenIcon,
  FiberManualRecord as OnlineIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCambodiaTime } from '../../utils/dateUtils';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import CallIcon from '@mui/icons-material/Call';
import ReplyIcon from '@mui/icons-material/Reply';

import EmojiButton from '../EmojiButton';
import MessageReactions from '../MessageReactions';
import { VoiceMessagePlayer } from '../group/VoiceMessagePlayer';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';

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
  onCallBack,
  onReply,
  userId
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [avatarError, setAvatarError] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
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

  const showMenu = true;

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

  const handleAddReaction = async (emoji) => {
    if (onAddReaction) {
      try {
        setShowReactionAnimation({
          emoji,
          type: 'add',
          timestamp: Date.now()
        });

        setTimeout(() => {
          setShowReactionAnimation(null);
        }, 1000);

        await onAddReaction(message.id, emoji);

        playReactionSound('add');
      } catch (err) {
        console.error('Failed to add reaction:', err);
      }
    }
  };

  const handleRemoveReaction = async (reactionId) => {
    if (onRemoveReaction) {
      try {
        const reactionToRemove = reactions.find(r => r.id === reactionId);
        if (reactionToRemove) {
          setShowReactionAnimation({
            emoji: reactionToRemove.emoji,
            type: 'remove',
            timestamp: Date.now()
          });

          setTimeout(() => {
            setShowReactionAnimation(null);
          }, 1000);
        }

        await onRemoveReaction(message.id, reactionId);
        playReactionSound('remove');
      } catch (err) {
        console.error('Failed to remove reaction:', err);
      }
    }
  };

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
            border: '1px solid primary.main',
            flexDirection: 'column',
            gap: 1,
            textAlign: isMine ? 'right' : 'left',
            direction: isMine ? 'rtl' : 'ltr',
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
            onClick={handleMenu}
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
              <RemoveRedEyeIcon fontSize="small" />
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
              <SaveAltIcon fontSize="small" />
            </IconButton>
          </Box>
        </>
      )}

      {!message.is_temp && reactions.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 10,
            ...(isMine
              ? { right: 10 }
              : { left: 10 }),
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
  );

  const renderVoiceContent = () => {

    return (
      <VoiceMessagePlayer
        url={message.content}
        isOwn={isMine}
        messageId={message.id}
        reactions={reactions}
        currentUserId={profile?.id}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
      />

    );
  };

  const renderCallMessage = () => {
    return (
      <Box
        sx={{
          bgcolor: isMine ? 'primary.main' : 'white',
          color: isMine ? 'white' : 'text.primary',
          p: 2,
          borderRadius: 3,
          boxShadow: 1,
          wordBreak: 'break-word',
          transition: 'all 0.2s',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            wordBreak: 'break-word',
            lineHeight: 1.4,
            fontSize: '0.9rem',
            mb: reactions.length > 0 ? 0.5 : 0,
            color: isMine ? 'white' : 'text.primary',
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
        {!message.is_temp && reactions.length > 0 && (
          <Box
            sx={{
              mt: 0.5,
              pt: 0.5,
              display: 'flex',
              justifyContent: isMine ? 'flex-end' : 'flex-start',
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
    );
  };

  // useEffect(() => {
  //   const isTempMessage = message.is_temp ||
  //     (typeof message.id === 'string' && message.id.startsWith('temp-'));

  //   if (onLoadReactions && message.id && !isTempMessage && !message.reactions) {
  //     onLoadReactions(message.id);
  //   }
  // }, [message.id, onLoadReactions, message.reactions, message.is_temp]);

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
                <SaveAltIcon />
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
          src={message?.sender_avatar_url}
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
          {message.sender_username.charAt(0).toUpperCase() ?? 'P'}
        </Avatar>
      )}

      <Box sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
        {!isMine && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, ml: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 'bold', mr: 1 }}
            >
              {message.sender_username}
            </Typography>
          </Box>
        )}

        {editing ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              p: 1.5,
              borderRadius: 3,
              bgcolor: 'background.paper',
              boxShadow: 1,
            }}
          >
            {/* Text input */}
            <TextField
              size="small"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              multiline
              maxRows={4}
              autoFocus
              placeholder={t('edit_message')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleEdit();
                } else if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.95rem',
                  borderRadius: 2,
                  bgcolor: 'grey.50',
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover fieldset': {
                    borderColor: 'text.secondary',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                    borderWidth: 1,
                  },
                },
              }}
            />

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <EmojiButton
                onSelect={(emoji) => setEditText((prev) => prev + emoji)}
                placement="bottom-start"
                size="small"
                width={300}
                height={350}
              />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 1,
                }}
              >
                <Button
                  size="small"
                  onClick={handleCancelEdit}
                  color="inherit"
                >
                  {t('cancel')}
                </Button>

                <Button
                  size="small"
                  variant="contained"
                  onClick={handleEdit}
                  disabled={isEditing}
                >
                  {isEditing ? t('saving') : t('save')}
                </Button>
              </Box>
            </Box>
          </Box>

        ) : (
          <Box sx={{ position: 'relative', width: '100%' }}>
            <Box
              className="message-bubble"
              onClick={handleMenu}
            >
              {message.is_forwarded && (
                <Box
                  sx={{
                    bgcolor: "#e8f0fe",
                    py: 1,
                    px: 3,
                    borderRadius: 1,
                    display: 'flex',
                    gap: 1,
                    maxHeight: '10vh',
                    maxWidth: 250,
                    overflow: 'hidden',
                    borderLeft: "3px solid #1a73e8",
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Forwarded from {message.forwarded_from_id !== userId ?
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.2,
                          alightItems: 'center'
                        }}
                      >
                        <Avatar
                          src={message.original_sender_avatar}
                          alt={message.original_sender || "author image"}
                          sx={{
                            width: 14,
                            height: 14,
                            mt: 0.3,
                            fontSize: 8
                          }}
                        >{message.original_sender.charAt(0).toUpperCase() || "P"}</Avatar>
                        {message.original_sender}
                      </Box>
                      :
                      (" you")}
                  </Typography>
                </Box>
              )}

              {message.reply_preview && (
                <Box
                  sx={{
                    bgcolor: "#e8f0fe",
                    py: 1,
                    px: 3,
                    borderRadius: 1,
                    display: 'flex',
                    gap: 1,
                    maxHeight: '10vh',
                    maxWidth: 250,
                    overflow: 'hidden',
                  }}
                >
                  <Typography variant="body2" sx={{ fontSize: 12, mt: 0.3 }}>
                    Reply to
                  </Typography>
                  <Box
                    sx={{
                      opacity: 0.6,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {message.reply_preview.sender_username}
                    </Typography>

                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {message.reply_preview.content}
                    </Typography>

                  </Box>
                </Box>
              )}

              {actualMessageType === 'image' ? (
                renderImageContent()
              ) : actualMessageType === 'voice' ? (
                renderVoiceContent()
              ) : actualMessageType === 'system' ? (
                renderCallMessage()
              ) : (
                <Box
                  sx={{
                    bgcolor: isMine ? 'primary.main' : 'white',
                    p: 2,
                    borderRadius: 3,
                    boxShadow: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: isMine ? 'white' : 'text.primary',
                      wordBreak: 'break-word',
                      transition: 'all 0.2s',
                      textAlign: isMine ? 'right' : 'left',
                    }}
                  >
                    {message.content}
                  </Typography>
                  {!message.is_temp && reactions.length > 0 && (
                    <Box
                      sx={{
                        mt: 0.5,
                        pt: 0.5,
                        display: 'flex',
                        justifyContent: isMine ? 'flex-end' : 'flex-start',
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
              )}

              <Box sx={{
                display: 'flex',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
                alignItems: 'center',
                mt: 0.5,
                gap: 0.5,
                alignItems: 'center'
              }}>
                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.7,
                    fontSize: '0.7rem',
                    lineHeight: 1,
                    color: 'text.secondary',
                    mt: 0.25
                  }}
                >
                  {message.edited_at && message.edited_at !== message.created_at && 'edited at '}
                  {formatCambodiaTime(message.created_at)}
                </Typography>
                {isMine && (
                  message?.seen_by?.length > 0 ?
                    (
                      <Tooltip title={message.seen_by[0]?.username || 'Seen'}>
                        <DoneAllIcon
                          sx={{
                            fontSize: 12,
                            color: 'green',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'scale(1.3)', cursor: 'pointer' },
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Tooltip>
                    ) : (
                      <DoneIcon fontSize="12" />
                    )
                )}
              </Box>

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

              // menuItems.push(
              //   <MenuItem
              //     key="react"
              //   >
              //     <MessageReactions
              //       messageId={message.id}
              //       reactions={reactions}
              //       currentUserId={profile?.id}
              //       onAddReaction={handleAddReaction}
              //       onRemoveReaction={handleRemoveReaction}
              //       showAddButton={true}
              //       size="small"
              //       isMine={isMine}
              //     />
              //   </MenuItem>
              // );

              menuItems.push(
                <MenuItem key="reply" onClick={onReply}>
                  <ReplyIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Reply
                </MenuItem>
              );

              if (actualMessageType !== 'system') {
                menuItems.push(
                  <MenuItem key="forward" onClick={onForward}>
                    <ShortcutIcon fontSize="small" sx={{ mr: 1.5 }} />
                    {t('forward')}
                  </MenuItem>,

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

                if (actualMessageType === 'image') {
                  menuItems.push(
                    <MenuItem key="view-full" onClick={handleViewFullImage}>
                      <RemoveRedEyeIcon fontSize="small" sx={{ mr: 1.5 }} />
                      {t('view_full_image')}
                    </MenuItem>,
                    <MenuItem key="download" onClick={handleDownloadImage}>
                      <SaveAltIcon fontSize="small" sx={{ mr: 1.5 }} />
                      {t('download_image')}
                    </MenuItem>
                  );
                }

                menuItems.push(
                  <MenuItem
                    key="delete"
                    onClick={handleDelete}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
                    {t('delete')}
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