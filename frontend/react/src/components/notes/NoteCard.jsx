import {
    Archive as ArchiveIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    MoreVert as MoreIcon,
    PushPin as PinIcon,
    PushPinOutlined as PinOutlinedIcon,
    Unarchive as UnarchiveIcon
} from '@mui/icons-material';
import {
    Box,
    Card,
    CardContent,
    IconButton,
    Menu,
    MenuItem,
    Typography
} from '@mui/material';
import { useState } from 'react';

const NoteCard = ({ note, onEdit, onDelete, onTogglePin, onToggleArchive }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    onEdit(note);
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete(note.id);
    handleMenuClose();
  };

  const handleTogglePin = () => {
    onTogglePin(note.id);
    handleMenuClose();
  };

  const handleToggleArchive = () => {
    onToggleArchive(note.id);
    handleMenuClose();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card
      sx={{
        height: '100%',
        backgroundColor: note.color || '#ffffff',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)'
        },
        position: 'relative'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent sx={{ p: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              lineHeight: 1.3,
              mr: 1
            }}
          >
            {note.title}
          </Typography>
          
          {(isHovered || note.is_pinned) && (
            <IconButton
              size="small"
              onClick={handleTogglePin}
              sx={{ mt: -0.5 }}
            >
              {note.is_pinned ? (
                <PinIcon fontSize="small" />
              ) : (
                <PinOutlinedIcon fontSize="small" />
              )}
            </IconButton>
          )}
          
          <IconButton size="small" onClick={handleMenuOpen} sx={{ mt: -0.5 }}>
            <MoreIcon fontSize="small" />
          </IconButton>
        </Box>

        {note.content && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {note.content.length > 150 
              ? `${note.content.substring(0, 150)}...` 
              : note.content
            }
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {formatDate(note.updated_at)}
          </Typography>
        </Box>
      </CardContent>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleTogglePin}>
          {note.is_pinned ? (
            <>
              <PinOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
              Unpin
            </>
          ) : (
            <>
              <PinIcon fontSize="small" sx={{ mr: 1 }} />
              Pin
            </>
          )}
        </MenuItem>
        <MenuItem onClick={handleToggleArchive}>
          {note.is_archived ? (
            <>
              <UnarchiveIcon fontSize="small" sx={{ mr: 1 }} />
              Unarchive
            </>
          ) : (
            <>
              <ArchiveIcon fontSize="small" sx={{ mr: 1 }} />
              Archive
            </>
          )}
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default NoteCard;