import {
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Done as DoneIcon,
  Edit as EditIcon,
  Forward as ForwardIcon,
  MoreVert as MoreVertIcon,
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
  profile, 
  currentFriend,
  getAvatarUrl,
  getUserInitials 
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [avatarError, setAvatarError] = useState(false);

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

  const handleForwardClick = () => {
    if (onForward) {
      onForward(message);
    }
    handleClose();
  };

  const showMenu = !message.is_temp;

  // Get proper sender information with avatar
  const getSenderInfo = () => {
    // If message already has sender data with avatar, use it
    if (message.sender && message.sender.username) {
      const avatarUrl = message.sender.avatar_url;
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

  const myAvatar = getMyAvatar();

  const handleAvatarError = () => {
    setAvatarError(true);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        mb: 2,
        px: 1,
      }}
    >
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
                onClick={handleReplyClick}
              >
                <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', fontWeight: 500 }}>
                  Replying to {message.reply_to.sender_id === profile?.id ? 'yourself' : senderInfo.username}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8, fontStyle: 'italic' }}>
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
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
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
                
                {/* Fixed Read receipts for my messages */}
                {isMine && (
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
                    {message.is_temp ? (
                      // Message sending (loading)
                      <CircularProgress size={10} sx={{ color: 'rgba(255,255,255,0.5)' }} />
                    ) : message.read_at || message.is_read ? (
                      // Message read by recipient (double tick - blue)
                      <DoneAllIcon 
                        fontSize="small" 
                        sx={{ 
                          fontSize: '1rem',
                          color: '#34B7F1'
                        }} 
                      />
                    ) : (
                      // Message sent but not read (single tick - white/grey)
                      <DoneIcon 
                        fontSize="small" 
                        sx={{ 
                          fontSize: '1rem',
                          color: 'rgba(255,255,255,0.7)'
                        }} 
                      />
                    )}
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