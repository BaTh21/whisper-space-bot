import {
  Box,
  IconButton,
  TextField,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Image as ImageIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import ProfileSection from '../../dashboard/ProfileSection';

export const MessageInput = ({
  selectedFriend,
  newMessage,
  onInputChange,
  onSendMessage,
  replyingTo,
  uploadingImage,
  imagePreview,
  onFileSelect,
  onRemoveImagePreview,
  isMobile
}) => {
  return (
    <Box
      sx={{
        position: { xs: 'sticky', sm: 'relative' },
        bottom: 0,
        p: { xs: 1.5, sm: 2, md: 2 },
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'white',
        display: 'flex',
        gap: { xs: 1, sm: 1.5, md: 1.5 },
        alignItems: 'flex-end',
        flexShrink: 0,
      }}
    >
      {/* Image Preview */}
      {imagePreview && (
        <Box sx={{ position: 'relative', mb: 1 }}>
          <img 
            src={imagePreview} 
            alt="Preview" 
            style={{ 
              width: 100, 
              height: 100, 
              objectFit: 'cover', 
              borderRadius: '8px' 
            }} 
          />
          <IconButton
            size="small"
            onClick={onRemoveImagePreview}
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              bgcolor: 'error.main',
              color: 'white',
              '&:hover': { bgcolor: 'error.dark' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Upload Button */}
      <input
        accept="image/*"
        style={{ display: 'none' }}
        id="image-upload"
        type="file"
        onChange={onFileSelect}
        disabled={!selectedFriend || uploadingImage}
      />
      <label htmlFor="image-upload">
        <IconButton
          component="span"
          disabled={!selectedFriend || uploadingImage}
          sx={{
            borderRadius: '50%',
            width: { xs: 44, sm: 46, md: 48 },
            height: { xs: 44, sm: 46, md: 48 },
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          {uploadingImage ? <CircularProgress size={24} /> : <ImageIcon />}
        </IconButton>
      </label>

      {/* Message Input */}
      <TextField
        fullWidth
        size="small"
        placeholder={
          !selectedFriend
            ? 'Select a friend...'
            : replyingTo
            ? `Replying to ${replyingTo.sender_id === ProfileSection?.id ? 'you' : selectedFriend.username}...`
            : 'Type a message...'
        }
        value={newMessage}
        onChange={onInputChange}
        onKeyPress={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && selectedFriend) {
            e.preventDefault();
            onSendMessage();
          }
        }}
        multiline
        maxRows={3}
        disabled={!selectedFriend || uploadingImage}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '24px',
            fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
          },
          bgcolor: '#f8f9fa',
        }}
      />

      {/* Send Button */}
      <IconButton
        color="primary"
        onClick={onSendMessage}
        disabled={!selectedFriend || (!newMessage.trim() && !imagePreview) || uploadingImage}
        sx={{
          borderRadius: '50%',
          width: { xs: 44, sm: 46, md: 48 },
          height: { xs: 44, sm: 46, md: 48 },
          bgcolor: 'primary.main',
          color: 'white',
          '&.Mui-disabled': { bgcolor: 'grey.300' },
          flexShrink: 0,
        }}
      >
        <SendIcon fontSize={isMobile ? 'small' : 'medium'} />
      </IconButton>
    </Box>
  );
};