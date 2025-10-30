// components/ChatMessage.jsx
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ReplyIcon from '@mui/icons-material/Reply';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { deleteMessage, editMessage } from '../services/api';

// ChatMessage Component - UPDATED
const ChatMessage = ({ message, isMine, onUpdate, onDelete, onReply, profile }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const handleMenu = (e) => setAnchorEl(e.currentTarget);
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

  // Show menu for:
  // - My own messages (all options: Edit, Reply, Delete)
  // - Other people's messages (only Reply option)
  const showMenu = !message.is_temp;

  return (
    <Box
      sx={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        maxWidth: '70%',
        mb: 1,
      }}
    >
      {editing ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 300 }}>
          <TextField
            size="small"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            multiline
            maxRows={4}
            autoFocus
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
            bgcolor: isMine ? 'primary.light' : 'grey.100',
            color: isMine ? 'white' : 'text.primary',
            p: 1.5,
            borderRadius: 2,
            position: 'relative',
            '&:hover': {
              bgcolor: isMine ? 'primary.main' : 'grey.200',
            },
          }}
        >
          {/* Reply preview */}
          {message.reply_to && (
            <Box 
              sx={{ 
                mb: 1, 
                p: 1, 
                bgcolor: 'rgba(0,0,0,0.1)', 
                borderRadius: 1,
                borderLeft: '3px solid',
                borderColor: 'primary.main'
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
                Replying to: {message.reply_to.content}
              </Typography>
            </Box>
          )}

          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
            {message.content}
          </Typography>
          
          {/* Message timestamp */}
          <Typography 
            variant="caption" 
            sx={{ 
              display: 'block',
              mt: 0.5,
              opacity: 0.7,
              fontSize: '0.7rem'
            }}
          >
            {formatCambodiaTime(message.created_at)}
            {message.updated_at && message.updated_at !== message.created_at && ' (edited)'}
          </Typography>

          {/* Message actions menu - UPDATED LOGIC */}
          {showMenu && (
            <>
              <IconButton
                size="small"
                onClick={handleMenu}
                sx={{ 
                  position: 'absolute', 
                  top: 4, 
                  right: 4, 
                  color: isMine ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  '.MuiBox-root:hover &': {
                    opacity: 1,
                  }
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu 
                anchorEl={anchorEl} 
                open={Boolean(anchorEl)} 
                onClose={handleClose}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                {/* For my own messages: Show Edit, Reply, Delete */}
                {isMine && (
                  <MenuItem 
                    onClick={() => { 
                      setEditing(true); 
                      handleClose(); 
                    }}
                  >
                    <EditIcon fontSize="small" sx={{ mr: 1 }} />
                    Edit
                  </MenuItem>
                )}
                
                {/* For all messages: Show Reply option */}
                <MenuItem onClick={handleReplyClick}>
                  <ReplyIcon fontSize="small" sx={{ mr: 1 }} />
                  Reply
                </MenuItem>

                {/* For my own messages: Show Delete option */}
                {isMine && (
                  <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                    <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                    Delete
                  </MenuItem>
                )}
              </Menu>
            </>
          )}

          {/* Loading indicator for temporary messages */}
          {message.is_temp && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.7, mr: 1 }}>
                Sending...
              </Typography>
              <CircularProgress size={12} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};