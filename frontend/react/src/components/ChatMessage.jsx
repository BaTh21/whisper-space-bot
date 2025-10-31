import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Forward as ForwardIcon,
  MoreVert as MoreVertIcon,
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

// Time formatting helper function
const formatCambodiaTime = (dateString) => {
  if (!dateString) return 'Just now';

  try {
    let date = new Date(dateString);
    if (isNaN(date.getTime())) {
      date = new Date(dateString + 'Z');
    }
    
    const options = {
      timeZone: 'Asia/Bangkok',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    };

    const now = new Date();
    const messageTime = date.toLocaleString('en-US', options);
    const today = now.toLocaleDateString('en-US', { timeZone: 'Asia/Phnom_Penh' });
    const messageDate = date.toLocaleDateString('en-US', { timeZone: 'Asia/Phnom_Penh' });

    if (today === messageDate) {
      return messageTime;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-US', { timeZone: 'Asia/Phnom_Penh' });

    if (yesterdayStr === messageDate) {
      return `Yesterday ${messageTime}`;
    }
    
    const dateStr = date.toLocaleDateString('en-GB', { 
      timeZone: 'Asia/Phnom_Penh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    return `${dateStr} ${messageTime}`;

  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
};

const ChatMessage = ({ 
  message, 
  isMine, 
  onUpdate, 
  onDelete, 
  onReply, 
  onForward, 
  profile,
  currentFriend
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

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

  // Get sender information - IMPROVED
  const getSenderInfo = () => {
    // If message has sender data, use it (highest priority)
    if (message.sender && message.sender.username) {
      return {
        username: message.sender.username,
        avatar_url: message.sender.avatar_url,
        initial: message.sender.username.charAt(0).toUpperCase()
      };
    }
    
    // If it's my message, use my profile
    if (isMine) {
      return {
        username: profile?.username || 'Me',
        avatar_url: profile?.avatar_url,
        initial: (profile?.username?.charAt(0) || 'M').toUpperCase()
      };
    }
    
    // If we have currentFriend data (for received messages), use it
    if (currentFriend) {
      return {
        username: currentFriend.username || 'Friend',
        avatar_url: currentFriend.avatar_url,
        initial: (currentFriend.username?.charAt(0) || 'F').toUpperCase()
      };
    }
    
    // Final fallback
    return {
      username: 'Unknown User',
      avatar_url: null,
      initial: 'U'
    };
  };

  const senderInfo = getSenderInfo();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        mb: 2,
        px: 1,
      }}
    >
      {!isMine && (
        <Avatar 
          src={senderInfo.avatar_url} 
          sx={{ 
            width: 32, 
            height: 32, 
            mr: 1,
            mt: 'auto',
            fontSize: '0.8rem',
            bgcolor: 'primary.main'
          }}
          imgProps={{ 
            onError: (e) => { 
              e.target.style.display = 'none';
            } 
          }}
        >
          {senderInfo.initial}
        </Avatar>
      )}
      
      <Box sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                }
              }}
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
            {/* Reply preview - IMPROVED */}
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
              {/* Forward indicator */}
              {message.is_forwarded && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, opacity: 0.8 }}>
                  <ForwardIcon fontSize="small" sx={{ mr: 0.5, fontSize: '1rem' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                    Forwarded {message.original_sender && `from ${message.original_sender}`}
                  </Typography>
                </Box>
              )}

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
              
              {/* Message timestamp and status - IMPROVED READ RECEIPTS */}
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
                
                {/* FIX 2: Improved read receipts */}
                {isMine && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {message.is_read ? (
                      <Box sx={{ 
                        color: isMine ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)', 
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        ✓✓
                      </Box>
                    ) : (
                      <Box sx={{ 
                        color: isMine ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', 
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        ✓
                      </Box>
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
              sx: {
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }
            }}
          >
            {/* For my own messages: Show Edit, Reply, Forward, Delete */}
            {isMine && (
              <MenuItem 
                onClick={() => { 
                  setEditing(true); 
                  handleClose(); 
                }}
                sx={{ borderRadius: '8px', my: 0.5, mx: 1 }}
              >
                <EditIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
                Edit
              </MenuItem>
            )}
            
            {/* For all messages: Show Reply option */}
            <MenuItem 
              onClick={handleReplyClick}
              sx={{ borderRadius: '8px', my: 0.5, mx: 1 }}
            >
              <ReplyIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
              Reply
            </MenuItem>

            {/* For all messages: Show Forward option */}
            <MenuItem 
              onClick={handleForwardClick}
              sx={{ borderRadius: '8px', my: 0.5, mx: 1 }}
            >
              <ForwardIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
              Forward
            </MenuItem>

            {/* For my own messages: Show Delete option */}
            {isMine && (
              <MenuItem 
                onClick={handleDelete} 
                sx={{ 
                  borderRadius: '8px', 
                  my: 0.5, 
                  mx: 1,
                  color: 'error.main',
                  '&:hover': {
                    bgcolor: 'error.light',
                    color: 'error.dark'
                  }
                }}
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

      {isMine && (
        <Avatar 
          src={profile?.avatar_url} 
          sx={{ 
            width: 32, 
            height: 32, 
            ml: 1,
            mt: 'auto',
            fontSize: '0.8rem',
            bgcolor: 'secondary.main'
          }}
          imgProps={{ 
            onError: (e) => { 
              e.target.style.display = 'none';
            } 
          }}
        >
          {(profile?.username?.charAt(0) || 'M').toUpperCase()}
        </Avatar>
      )}
    </Box>
  );
};

export default ChatMessage;