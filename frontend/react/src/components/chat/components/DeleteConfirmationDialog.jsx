import { Box, Button, Typography } from '@mui/material';

export const DeleteConfirmationDialog = ({
  open,
  messageToDelete,
  onClose,
  onConfirm
}) => {
  if (!open || !messageToDelete) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        bgcolor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <Box
        sx={{
          bgcolor: 'white',
          borderRadius: '12px',
          p: 3,
          maxWidth: 400,
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Typography variant="h6" gutterBottom>
          Delete {messageToDelete.message.message_type === 'image' ? 'Image' : 'Message'}?
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {messageToDelete.message.message_type === 'image' 
            ? 'This image will be permanently deleted from the chat and Cloudinary storage. This action cannot be undone.'
            : 'This message will be permanently deleted from the chat. This action cannot be undone.'
          }
        </Typography>

        {messageToDelete.message.message_type === 'image' && (
          <Box sx={{ mb: 2, textAlign: 'center' }}>
            <img 
              src={messageToDelete.message.content} 
              alt="To be deleted"
              style={{ 
                maxWidth: '100%', 
                maxHeight: 150,
                borderRadius: '8px'
              }}
            />
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button 
            onClick={onClose}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            variant="contained" 
            color="error"
          >
            Delete
          </Button>
        </Box>
      </Box>
    </Box>
  );
};