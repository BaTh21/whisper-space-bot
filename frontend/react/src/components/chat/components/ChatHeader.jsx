import { Close as CloseIcon, Menu as MenuIcon } from '@mui/icons-material';
import { Avatar, Box, Chip, IconButton, Typography } from '@mui/material';

export const ChatHeader = ({
  selectedFriend,
  status,
  isMobile,
  onOpenMobileDrawer,
  onCloseChat,
  getUserAvatar
}) => {
  if (!selectedFriend) return null;

  if (isMobile) {
    return (
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton size="small" onClick={onOpenMobileDrawer}>
            <MenuIcon />
          </IconButton>
          <Avatar src={getUserAvatar(selectedFriend)} sx={{ width: 36, height: 36 }} />
          <Box>
            <Typography variant="body1" fontWeight="600" sx={{ fontSize: '0.95rem' }}>
              {selectedFriend.username}
            </Typography>
            <Typography variant="caption" color={status.color} sx={{ fontSize: '0.75rem' }}>
              {status.text}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onCloseChat}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: { sm: 1.5, md: 2 },
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0,
      }}
    >
      <Avatar src={getUserAvatar(selectedFriend)} sx={{ width: { sm: 40, md: 44 }, height: { sm: 40, md: 44 } }} />
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h6" fontWeight="600" sx={{ fontSize: { sm: '1.1rem', md: '1.25rem' } }}>
          {selectedFriend.username}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { sm: '0.75rem', md: '0.875rem' } }}>
          {status.text}
        </Typography>
      </Box>
      <Chip
        label={status.text}
        size="small"
        sx={{ bgcolor: status.color, color: 'white', fontSize: { sm: '0.7rem', md: '0.75rem' } }}
      />
    </Box>
  );
};