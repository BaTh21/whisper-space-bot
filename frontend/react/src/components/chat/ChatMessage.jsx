// src/components/chat/ChatMessage.jsx
import {
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Done as DoneIcon,
  Edit as EditIcon,
  Forward as ForwardIcon,
  MoreVert as MoreVertIcon,
  PushPin as PushPinIcon,
  Reply as ReplyIcon,
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
  showSeenStatus = false,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [avatarError, setAvatarError] = useState(false);
  const [seenAvatarError, setSeenAvatarError] = useState(false);

  /* ---------------------------------------------------------- */
  /*                     MENU HANDLERS                         */
  /* ---------------------------------------------------------- */
  const handleMenu = (e) => {
    e.stopPropagation();
    console.log('Menu button clicked for message:', message.id);
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
    if (!window.confirm('Delete this message permanently?')) return;
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
  console.log('Reply clicked for message:', message.id, message.content);
  
  // Call onReply immediately without any conditions
  if (onReply) {
    console.log('Calling onReply with message');
    onReply(message);
  } else {
    console.error('onReply is undefined - prop not passed from parent');
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

  // Show menu for all messages
  const showMenu = true;

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
          <Box sx={{ position: 'relative' }}>
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
                <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', fontWeight: 500 }}>
                  Replying to{' '}
                  {message.reply_to.sender_id === profile?.id
                    ? 'yourself'
                    : message.reply_to.sender_username ?? senderInfo.username}
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
                '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
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
              <Typography
                variant="body2"
                sx={{ wordBreak: 'break-word', lineHeight: 1.4, fontSize: '0.9rem' }}
              >
                {message.content}
              </Typography>

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
            {/* For MY messages - Show ALL menu items */}
            {isMine && (
              <>
                <MenuItem onClick={() => { setEditing(true); setEditText(message.content); handleClose(); }}>
                  <EditIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Edit
                </MenuItem>
                
                <MenuItem onClick={handleReplyClick}>
                  <ReplyIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Reply
                </MenuItem>
                
                <MenuItem onClick={handlePinClick}>
                  <PushPinIcon fontSize="small" sx={{ mr: 1.5 }} />
                  {isPinned ? 'Unpin Message' : 'Pin Message'}
                </MenuItem>
                
                <MenuItem onClick={handleForwardClick}>
                  <ForwardIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Forward
                </MenuItem>
                
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                  <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Delete
                </MenuItem>
              </>
            )}

            {/* For FRIEND'S messages - Show Reply, Pin, Forward */}
            {!isMine && (
              <>
                <MenuItem onClick={handleReplyClick}>
                  <ReplyIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Reply
                </MenuItem>
                <MenuItem onClick={handlePinClick}>
                  <PushPinIcon fontSize="small" sx={{ mr: 1.5 }} />
                  {isPinned ? 'Unpin Message' : 'Pin Message'}
                </MenuItem>
                <MenuItem onClick={handleForwardClick}>
                  <ForwardIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Forward
                </MenuItem>
              </>
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