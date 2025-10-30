// components/ChatMessage.jsx
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
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
import { deleteMessage } from '../services/api';

export default function ChatMessage({ message, isMine, onUpdate, onDelete }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const openMenu = (e) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  const startEdit = () => {
    setEditing(true);
    closeMenu();
  };

  const saveEdit = async () => {
    if (editText.trim() && editText !== message.content && onUpdate) {
      try {
        await onUpdate(message.id, editText);
      } catch (e) {
        alert('Failed to edit message', e);
      }
    }
    setEditing(false);
  };

 const handleDelete = async () => {
  if (!window.confirm('Delete this message for everyone? This cannot be undone.')) return;

  try {
    await deleteMessage(message.id);   // hits the hard-delete endpoint
    onDelete(message.id);              // optimistic UI removal
  } catch (e) {
    alert(e.message);
  }
  closeMenu();
};

  return (
    <Box sx={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '70%', mb: 1 }}>
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
            <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="small" variant="contained" onClick={saveEdit}>Save</Button>
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
            '&:hover': { bgcolor: isMine ? 'primary.main' : 'grey.200' },
          }}
        >
          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
            {message.content}
          </Typography>

          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.5, opacity: 0.7, fontSize: '0.7rem' }}
          >
            {new Date(message.created_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Typography>

          {isMine && !message.is_temp && (
            <>
              <IconButton
                size="small"
                onClick={openMenu}
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  color: 'rgba(255,255,255,0.7)',
                  opacity: 0,
                  transition: 'opacity .2s',
                  '.MuiBox-root:hover &': { opacity: 1 },
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>

              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
                <MenuItem onClick={startEdit}>
                  <EditIcon fontSize="small" sx={{ mr: 1 }} />
                  Edit
                </MenuItem>
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                  <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                  Delete
                </MenuItem>
              </Menu>
            </>
          )}

          {message.is_temp && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Sending...
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}