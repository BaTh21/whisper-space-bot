import {
  Archive as ArchiveIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Group as GroupIcon,
  MoreVert as MoreIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  Public as PublicIcon,
  Share as ShareIcon,
  Unarchive as UnarchiveIcon
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Typography
} from '@mui/material';
import { useState } from 'react';

// You need to get current user ID from context, props, or localStorage
// For now, I'll assume you have a way to get current user ID
const getCurrentUserId = () => {
  // Replace this with your actual method to get current user ID
  // Example: from context, props, or localStorage
  return parseInt(localStorage.getItem('userId') || '1'); // Fallback to 1 for demo
};

const NoteCard = ({ note, onEdit, onDelete, onTogglePin, onToggleArchive, onShare }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // Get current user ID
  const currentUserId = getCurrentUserId();
  
  // Fixed logic for checking ownership and sharing
  const isOwner = note.user_id === currentUserId;
  const isSharedWithMe = !isOwner && note.shared_with && note.shared_with.includes(currentUserId);

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

  const handleShare = () => {
    onShare(note);
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
        {/* Sharing Indicators */}
        <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
          {note.share_type === 'public' && (
            <PublicIcon fontSize="small" color="primary" titleAccess="Public note" />
          )}
          {note.share_type === 'shared' && note.shared_with && note.shared_with.length > 0 && (
            <GroupIcon fontSize="small" color="primary" titleAccess={`Shared with ${note.shared_with.length} friend${note.shared_with.length !== 1 ? 's' : ''}`} />
          )}
          {isSharedWithMe && (
            <Chip label="Shared" size="small" color="secondary" sx={{ height: 20, fontSize: '0.6rem' }} />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              lineHeight: 1.3,
              mr: 1,
              pr: 2
            }}
          >
            {note.title}
          </Typography>
          
          {(isHovered || note.is_pinned) && isOwner && (
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
          {isSharedWithMe && (
            <Typography variant="caption" color="primary">
              From friend
            </Typography>
          )}
        </Box>
      </CardContent>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {(isOwner || (isSharedWithMe && note.can_edit)) && (
          <MenuItem onClick={handleEdit}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            {isOwner ? 'Edit' : 'Edit (Shared)'}
          </MenuItem>
        )}
        
        {isOwner && (
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
        )}
        
        {isOwner && (
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
        )}
        
        {isOwner && (
          <MenuItem onClick={handleShare}>
            <ShareIcon fontSize="small" sx={{ mr: 1 }} />
            Share
          </MenuItem>
        )}
        
        {isOwner && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default NoteCard;