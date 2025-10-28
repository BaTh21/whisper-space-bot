// components/MessageItem.jsx
import { useState } from 'react';
import {
  Box, Typography, IconButton, Menu, MenuItem,
  TextField, Button, Stack
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { formatCambodiaTime } from '../utils/time';

const MessageItem = ({ message, isMine, onEdit, onUnsend, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(message.content);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleMenu = (e) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  if (message.is_unsent) {
    return <Typography variant="caption" color="text.secondary" fontStyle="italic">This message was unsent</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', mb: 1 }}>
      <Box sx={{
        bgcolor: isMine ? 'primary.main' : 'grey.200',
        color: isMine ? 'white' : 'text.primary',
        borderRadius: 2, px: 2, py: 1, maxWidth: '75%', wordBreak: 'break-word'
      }}>
        {editing ? (
          <Stack spacing={1}>
            <TextField value={content} onChange={e => setContent(e.target.value)} multiline size="small" fullWidth />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="small" variant="contained" color="success" onClick={() => { onEdit(message.id, content); setEditing(false); }}>Update</Button>
            </Stack>
          </Stack>
        ) : (
          <>
            <Typography variant="body2">{message.content}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>{formatCambodiaTime(message.created_at)}</Typography>
              {isMine && (
                <>
                  <IconButton size="small" onClick={handleMenu} sx={{ color: 'inherit' }}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                  <Menu anchorEl={anchorEl} open={open} onClose={closeMenu}>
                    <MenuItem onClick={() => { setEditing(true); closeMenu(); }}>Edit</MenuItem>
                    <MenuItem onClick={() => { onUnsend(message.id); closeMenu(); }} sx={{ color: 'error.main' }}>Unsend</MenuItem>
                    <MenuItem onClick={() => { onDelete(message.id); closeMenu(); }} sx={{ color: 'error.main' }}>Delete</MenuItem>
                  </Menu>
                </>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default MessageItem;