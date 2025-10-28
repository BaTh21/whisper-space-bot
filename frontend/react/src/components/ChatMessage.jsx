// src/components/ChatMessage.jsx
import { useState } from 'react';
import { Box, IconButton, Menu, MenuItem, Typography, TextField } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplyIcon from '@mui/icons-material/Reply';
import { editMessage, unsendMessage, deleteMessage } from '../services/api';

export default function ChatMessage({ message, isMine, onUpdate, onDelete }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const handleMenu = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleEdit = async () => {
    if (editText.trim() && editText !== message.content) {
      try {
        const updated = await editMessage(message.id, { content: editText });
        onUpdate(updated);
      } catch (err) {
        alert('Failed to edit',err);
      }
    }
    setEditing(false);
    handleClose();
  };

  const handleUnsend = async () => {
    if (confirm('Unsend this message?')) {
      try {
        await unsendMessage(message.id);
        onUpdate({ ...message, content: 'Message unsent', is_unsent: true });
      } catch (err) {
        alert('Failed to unsend',err);
      }
    }
    handleClose();
  };

  const handleDelete = async () => {
    if (confirm('Delete this message?')) {
      try {
        await deleteMessage(message.id);
        onDelete(message.id);
      } catch (err) {
        alert('Failed to delete',err);
      }
    }
    handleClose();
  };

  if (message.is_unsent) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        Message unsent
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        maxWidth: '70%',
        mb: 1,
      }}
    >
      {editing ? (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEdit()}
            autoFocus
          />
          <Button size="small" onClick={handleEdit}>Save</Button>
          <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
        </Box>
      ) : (
        <Box
          sx={{
            bgcolor: isMine ? 'primary.light' : 'grey.100',
            color: isMine ? 'white' : 'text.primary',
            p: 1.5,
            borderRadius: 2,
            position: 'relative',
          }}
        >
          <Typography variant="body2">{message.content}</Typography>
          {isMine && (
            <>
              <IconButton
                size="small"
                onClick={handleMenu}
                sx={{ position: 'absolute', top: 4, right: 4, color: 'rgba(255,255,255,0.7)' }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
                <MenuItem onClick={() => { setEditing(true); handleClose(); }}>
                  <EditIcon fontSize="small" /> Edit
                </MenuItem>
                <MenuItem onClick={handleUnsend}>
                  <ReplyIcon fontSize="small" /> Unsend
                </MenuItem>
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                  <DeleteIcon fontSize="small" /> Delete
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}