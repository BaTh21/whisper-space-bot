//chat/ChatMessage.jsx
import {
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Done as DoneIcon,
  Edit as EditIcon,
  Forward as ForwardIcon,
  MoreVert as MoreVertIcon,
  PushPin as PushPinIcon,
  Reply as ReplyIcon
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
  Typography
} from '@mui/material';
import { useState } from 'react';
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
  showSeenStatus = false
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [avatarError, setAvatarError] = useState(false);
  const [seenAvatarError, setSeenAvatarError] = useState(false);

  const handleMenu = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };
  
  const handleClose = () => setAnchorEl(null);

  const handleEdit = async () => {
    if (editText.trim() && editText !== message.content) {
      try {
        if (onUpdate) {
          await onUpdate(message.id, editText);
        }
      } catch (err) {
        console.error('Failed to edit message:', err);
      }
    }
    setEditing(false);
    handleClose();
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this message permanently?')) {
      try {
        if (onDelete) {
          await onDelete(message.id);
        }
      } catch (err) {
        console.error('Failed to delete message:', err);
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
    if (onPin) {
      onPin(message);
    }
    handleClose();
  };

  const handleForwardClick = () => {
    if (onForward) {
      onForward(message);
    }
    handleClose();
  };

  const showMenu = !message.is_temp;

  // Get proper sender information with avatar
  const getSenderInfo = () => {
    // If message has sender data, use it (most reliable)
    if (message.sender && message.sender.username) {
      const avatarUrl = message.sender.avatar_url || message.sender.avatar;
      return {
        username: message.sender.username,
        avatar_url: getAvatarUrl ? getAvatarUrl(avatarUrl) : avatarUrl,
        initial: getUserInitials ? getUserInitials(message.sender.username) : (message.sender.username?.charAt(0) || 'U').toUpperCase()
      };
    }
    
    // For my messages
    if (isMine) {
      const avatarUrl = profile?.avatar_url || profile?.avatar;
      return {
        username: profile?.username || 'Me',
        avatar_url: getAvatarUrl ? getAvatarUrl(avatarUrl) : avatarUrl,
        initial: getUserInitials ? getUserInitials(profile?.username) : (profile?.username?.charAt(0) || 'M').toUpperCase()
      };
    }
    
    // For friend's messages
    if (currentFriend) {
      const avatarUrl = currentFriend.avatar_url || currentFriend.avatar;
      return {
        username: currentFriend.username || 'Friend',
        avatar_url: getAvatarUrl ? getAvatarUrl(avatarUrl) : avatarUrl,
        initial: getUserInitials ? getUserInitials(currentFriend.username) : (currentFriend.username?.charAt(0) || 'F').toUpperCase()
      };
    }
    
    // Fallback
    return {
      username: 'Unknown User',
      avatar_url: null,
      initial: 'U'
    };
  };

  const senderInfo = getSenderInfo();

  // Get my profile avatar for display on my messages
  const getMyAvatar = () => {
    const avatarUrl = profile?.avatar_url || profile?.avatar;
    return {
      avatar_url: getAvatarUrl ? getAvatarUrl(avatarUrl) : avatarUrl,
      initial: getUserInitials ? getUserInitials(profile?.username) : (profile?.username?.charAt(0) || 'M').toUpperCase()
    };
  };

  // Get friend's avatar for seen status
  const getFriendAvatar = () => {
    if (!currentFriend) return { avatar_url: null, initial: 'F' };
    
    const avatarUrl = currentFriend.avatar_url || currentFriend.avatar;
    return {
      avatar_url: getAvatarUrl ? getAvatarUrl(avatarUrl) : avatarUrl,
      initial: getUserInitials ? getUserInitials(currentFriend.username) : (currentFriend.username?.charAt(0) || 'F').toUpperCase()
    };
  };

  const myAvatar = getMyAvatar();
  const friendAvatar = getFriendAvatar();

  const handleAvatarError = () => {
    setAvatarError(true);
  };

  const handleSeenAvatarError = () => {
    setSeenAvatarError(true);
  };

  // SIMPLIFIED: Correct message status determination
  const getMessageStatus = () => {
    if (!isMine) return 'none';
    
    // Check temporary messages first
    if (message.is_temp) return 'sending';
    
    // Debug: Log message status for troubleshooting
    console.log('Message status debug:', {
      id: message.id,
      is_read: message.is_read,
      read_at: message.read_at,
      delivered_at: message.delivered_at,
      status: message.status,
      seen_status: message.seen_status
    });
    
    // Priority 1: Check read status with timestamp
    if (message.is_read === true && message.read_at) {
      return 'seen';
    }
    
    // Priority 2: Check delivered status
    if (message.delivered_at) {
      return 'delivered';
    }
    
    // Priority 3: Check status field
    if (message.status === 'seen') return 'seen';
    if (message.status === 'delivered') return 'delivered';
    if (message.status === 'sent') return 'sent';
    
    // Priority 4: Check seen_status field
    if (message.seen_status === 'seen') return 'seen';
    if (message.seen_status === 'delivered') return 'delivered';
    
    // Default: Assume sent
    return 'sent';
  };

  const messageStatus = getMessageStatus();

  // Render the appropriate tick icon based on message status
  const renderStatusIcon = () => {
    switch (messageStatus) {
      case 'sending':
        return <CircularProgress size={10} sx={{ color: 'rgba(255,255,255,0.5)' }} />;
      
      case 'seen':
        return (
          <DoneAllIcon 
            fontSize="small" 
            sx={{ 
              fontSize: '1rem',
              color: '#34B7F1' // BLUE for SEEN
            }} 
          />
        );
      
      case 'delivered':
        return (
          <DoneAllIcon 
            fontSize="small" 
            sx={{ 
              fontSize: '1rem',
              color: 'rgba(255,255,255,0.7)' // GREY for DELIVERED
            }} 
          />
        );
      
      case 'sent':
        return (
          <DoneIcon 
            fontSize="small" 
            sx={{ 
              fontSize: '1rem',
              color: 'rgba(255,255,255,0.7)' // GREY for SENT
            }} 
          />
        );
      
      default:
        return null;
    }
  };

  // Render seen status with friend's avatar (like Messenger)
  const renderSeenStatus = () => {
    // Only show for my messages that are seen AND when explicitly told to show
    if (!showSeenStatus || !isMine || messageStatus !== 'seen') return null;

    console.log('Rendering seen status for message:', message.id, 'friend:', currentFriend);

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 0.5, gap: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.7, color: 'text.secondary' }}>
          Seen
        </Typography>
        <Avatar 
          src={seenAvatarError ? null : friendAvatar.avatar_url}
          sx={{ 
            width: 16, 
            height: 16,
            fontSize: '0.5rem',
            bgcolor: 'primary.main',
            minWidth: 16
          }}
          imgProps={{
            onError: handleSeenAvatarError
          }}
        >
          {friendAvatar.initial}
        </Avatar>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        mb: 2,
        px: 1,
        position: 'relative'
      }}
    >
      {/* Pin indicator for pinned messages */}
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
            zIndex: 1
          }}
        >
          <PushPinIcon fontSize="small" sx={{ fontSize: '0.8rem' }} />
          Pinned
        </Box>
      )}
      
      {/* Friend's avatar (left side for their messages) */}
      {!isMine && (
        <Avatar 
          src={avatarError ? null : senderInfo.avatar_url}
          sx={{ 
            width: 32, 
            height: 32, 
            mr: 1,
            mt: 'auto',
            fontSize: '0.8rem',
            bgcolor: 'primary.main',
            fontWeight: 'bold'
          }}
          imgProps={{ 
            onError: handleAvatarError
          }}
        >
          {senderInfo.initial}
        </Avatar>
      )}
      
      <Box sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
        {/* Friend's username */}
        {!isMine && (
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              mb: 0.5,
              ml: 1,
              fontWeight: 500
            }}
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
              <Button size="small" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={handleEdit}>
                Save
              </Button>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              position: 'relative',
              '&:hover .message-actions': {
                opacity: 1,
              }
            }}
          >
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
                  '&:hover': {
                    bgcolor: isMine ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                  }
                }}
                onClick={() => onReply && onReply(message.reply_to)}
              >
                <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', fontWeight: 500 }}>
                  Replying to {message.reply_to.sender_id === profile?.id ? 'yourself' : 
                    (message.reply_to.sender_username || senderInfo.username)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8, fontStyle: 'italic', lineHeight: 1.3 }}>
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
                },
              }}
            >
              {/* Forwarded indicator */}
              {message.is_forwarded && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, opacity: 0.8 }}>
                  <ForwardIcon fontSize="small" sx={{ mr: 0.5, fontSize: '1rem' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                    Forwarded {message.original_sender && `from ${message.original_sender}`}
                  </Typography>
                </Box>
              )}

              {/* Message content */}
              <Typography 
                variant="body2" 
                sx={{ 
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                  fontSize: '0.9rem'
                }}
              >
                {message.content}
              </Typography>
              
              {/* Message timestamp and status */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 1, gap: 0.5 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    opacity: 0.7,
                    fontSize: '0.7rem',
                    lineHeight: 1
                  }}
                >
                  {formatCambodiaTime(message.created_at)}
                  {message.updated_at && message.updated_at !== message.created_at && ' (edited)'}
                </Typography>
                
                {/* Read receipts with correct tick logic */}
                {isMine && (
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
                    {renderStatusIcon()}
                  </Box>
                )}
              </Box>

              {/* Message actions menu */}
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
                    opacity: 0,
                    transition: 'opacity 0.2s, transform 0.2s',
                    width: 24,
                    height: 24,
                    '&:hover': {
                      bgcolor: isMine ? '#0077b3' : '#e0e0e0',
                      transform: 'scale(1.1)',
                    }
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>
        )}

        {/* Seen status with friend's avatar (Messenger style) */}
        {renderSeenStatus()}

        {/* Message actions menu */}
        {showMenu && (
          <Menu 
            anchorEl={anchorEl} 
            open={Boolean(anchorEl)} 
            onClose={handleClose}
            anchorOrigin={{
              vertical: 'top',
              horizontal: isMine ? 'left' : 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: isMine ? 'right' : 'left',
            }}
            PaperProps={{
              sx: { borderRadius: '12px' }
            }}
          >
            {/* Edit option (only for my messages) */}
            {isMine && (
              <MenuItem 
                onClick={() => { 
                  setEditing(true); 
                  handleClose(); 
                }}
              >
                <EditIcon fontSize="small" sx={{ mr: 1.5 }} />
                Edit
              </MenuItem>
            )}
            
            {/* Reply option */}
            <MenuItem onClick={handleReplyClick}>
              <ReplyIcon fontSize="small" sx={{ mr: 1.5 }} />
              Reply
            </MenuItem>

            {/* Pin option */}
            <MenuItem onClick={handlePinClick}>
              <PushPinIcon fontSize="small" sx={{ mr: 1.5 }} />
              {isPinned ? 'Unpin Message' : 'Pin Message'}
            </MenuItem>

            {/* Forward option */}
            <MenuItem onClick={handleForwardClick}>
              <ForwardIcon fontSize="small" sx={{ mr: 1.5 }} />
              Forward
            </MenuItem>

            {/* Delete option (only for my messages) */}
            {isMine && (
              <MenuItem 
                onClick={handleDelete} 
                sx={{ color: 'error.main' }}
              >
                <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
                Delete
              </MenuItem>
            )}
          </Menu>
        )}

        {/* Loading indicator for temporary messages */}
        {message.is_temp && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
            <Typography variant="caption" sx={{ opacity: 0.7, mr: 1, fontSize: '0.7rem' }}>
              Sending...
            </Typography>
            <CircularProgress size={10} />
          </Box>
        )}
      </Box>

      {/* My avatar (right side for my messages) */}
      {isMine && (
        <Avatar 
          src={avatarError ? null : myAvatar.avatar_url}
          sx={{ 
            width: 32, 
            height: 32, 
            ml: 1,
            mt: 'auto',
            fontSize: '0.8rem',
            bgcolor: 'primary.main',
            fontWeight: 'bold'
          }}
          imgProps={{ 
            onError: handleAvatarError
          }}
        >
          {myAvatar.initial}
        </Avatar>
      )}
    </Box>
  );
};

export default ChatMessage;