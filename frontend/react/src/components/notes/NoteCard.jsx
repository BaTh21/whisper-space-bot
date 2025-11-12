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
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Typography
} from '@mui/material';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const NoteCard = ({ note, onEdit, onDelete, onTogglePin, onToggleArchive, onShare }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Get current user from auth context
  const { auth } = useAuth();
  const currentUser = auth.user;
  const currentUserId = currentUser?.id;
  
  // Check if current user is the owner of the note
  const isOwner = note.user_id === currentUserId;
  
  // Flexible permission checking - handle different API structures
  let isSharedWithEdit = false;
  
  if (!isOwner) {
    // Method 1: Check if note has direct can_edit property
    if (note.can_edit !== undefined) {
      isSharedWithEdit = note.can_edit;
    }
    // Method 2: Check shared_with array with objects
    else if (note.shared_with && Array.isArray(note.shared_with)) {
      isSharedWithEdit = note.shared_with.some(share => {
        // Handle both object and simple ID structures
        if (typeof share === 'object') {
          return share.user_id === currentUserId && share.can_edit;
        } else {
          // If shared_with is just an array of user IDs, assume edit permission
          return share === currentUserId;
        }
      });
    }
    // Method 3: Check permissions object
    else if (note.permissions && note.permissions.can_edit !== undefined) {
      isSharedWithEdit = note.permissions.can_edit;
    }
  }

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    if (isOwner || isSharedWithEdit) {
      console.log('Edit allowed - isOwner:', isOwner, 'isSharedWithEdit:', isSharedWithEdit);
      onEdit(note);
    } else {
      console.log('Edit blocked - isOwner:', isOwner, 'isSharedWithEdit:', isSharedWithEdit);
      alert('You can only view this note. Edit permission is not granted.');
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = () => {
    onDelete(note.id);
    setDeleteDialogOpen(false);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleTogglePin = () => {
    if (!isOwner) {
      alert('Only the note creator can pin/unpin this note.');
      handleMenuClose();
      return;
    }
    onTogglePin(note.id);
    handleMenuClose();
  };

  const handleToggleArchive = () => {
    if (!isOwner) {
      alert('Only the note creator can archive/unarchive this note.');
      handleMenuClose();
      return;
    }
    onToggleArchive(note.id);
    handleMenuClose();
  };

  const handleShare = () => {
    if (!isOwner) {
      alert('Only the note creator can share this note.');
      handleMenuClose();
      return;
    }
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

  // Determine edit label based on permissions
  const getEditLabel = () => {
    if (isOwner) return 'Edit';
    if (isSharedWithEdit) return 'Edit (Shared)';
    return 'View Only';
  };

  return (
    <>
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
            {!isOwner && (
              <Chip 
                label={isSharedWithEdit ? "Can Edit" : "View Only"} 
                size="small" 
                color={isSharedWithEdit ? "primary" : "secondary"} 
                sx={{ height: 20, fontSize: '0.6rem' }} 
              />
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
            
            {/* Pin button - only show for owner when hovered or pinned */}
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
            {!isOwner && (
              <Typography variant="caption" color="primary">
                Shared with you
              </Typography>
            )}
          </Box>
        </CardContent>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {/* Edit option - always visible but behavior depends on permissions */}
          <MenuItem onClick={handleEdit}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            {getEditLabel()}
          </MenuItem>
          
          {/* Pin option - only for owner */}
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
          
          {/* Archive option - only for owner */}
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
          
          {/* Share option - only for owner */}
          {isOwner && (
            <MenuItem onClick={handleShare}>
              <ShareIcon fontSize="small" sx={{ mr: 1 }} />
              Share
            </MenuItem>
          )}
          
          {/* Delete option - only for owner */}
          {isOwner && (
            <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
              <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
              Delete
            </MenuItem>
          )}

          {/* Show message for shared users about limited permissions */}
          {!isOwner && (
            <MenuItem disabled sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              Only note creator can use other options
            </MenuItem>
          )}
        </Menu>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            minWidth: 400
          }
        }}
      >
        <DialogTitle 
          id="delete-dialog-title"
          sx={{ 
            bgcolor: 'error.main', 
            color: 'white',
            py: 2,
            px: 3
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon />
            <Typography variant="h6" component="span" fontWeight="600">
              Delete Note
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ py: 3, px: 3 }}>
          <DialogContentText 
            id="delete-dialog-description"
            sx={{ 
              color: 'text.primary',
              fontSize: '1rem',
              mb: 2
            }}
          >
            Are you sure you want to delete this note?
          </DialogContentText>
          
          <Card 
            variant="outlined" 
            sx={{ 
              bgcolor: 'grey.50',
              borderColor: 'grey.300',
              p: 2,
              mb: 2
            }}
          >
            <Typography variant="subtitle1" fontWeight="600" gutterBottom>
              {note.title}
            </Typography>
            {note.content && (
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {note.content}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Last updated: {formatDate(note.updated_at)}
            </Typography>
          </Card>
          
          <DialogContentText 
            sx={{ 
              color: 'error.main',
              fontSize: '0.875rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            <DeleteIcon fontSize="small" />
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        
        <DialogActions sx={{ py: 2, px: 3, gap: 1 }}>
          <Button 
            onClick={handleDeleteCancel}
            variant="outlined"
            sx={{
              borderRadius: 1,
              px: 3,
              textTransform: 'none',
              fontWeight: '600'
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            sx={{
              borderRadius: 1,
              px: 3,
              textTransform: 'none',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(211, 47, 47, 0.3)',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(211, 47, 47, 0.4)',
                bgcolor: 'error.dark'
              }
            }}
          >
            Delete Note
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NoteCard;