import { Close as CloseIcon, PushPin as PushPinIcon } from '@mui/icons-material';
import { Avatar, Box, Card, IconButton, Typography } from '@mui/material';

export const PinnedMessage = ({
  pinnedMessage,
  onUnpin,
  profile,
  selectedFriend,
  getUserAvatar,
  isMobile
}) => {
  if (!pinnedMessage) return null;

  return (
    <Card
      sx={{
        m: { xs: 1, sm: 1.5, md: 2 },
        mb: { xs: 0.5, sm: 1, md: 1 },
        p: { xs: 1.5, sm: 1.5, md: 2 },
        bgcolor: 'warning.light',
        border: '2px solid',
        borderColor: 'warning.main',
        borderRadius: '12px',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <PushPinIcon
              sx={{
                mr: 1,
                color: 'warning.dark',
                transform: 'rotate(45deg)',
                fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: 'warning.dark',
                fontWeight: 600,
                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.75rem' },
              }}
            >
              Pinned
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Avatar
              src={getUserAvatar(pinnedMessage.sender_id === profile?.id ? profile : selectedFriend)}
              sx={{ width: { xs: 20, sm: 22, md: 24 }, height: { xs: 20, sm: 22, md: 24 }, mr: 1 }}
            />
            <Typography
              variant="body2"
              fontWeight="500"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.875rem' } }}
            >
              {pinnedMessage.sender_id === profile?.id ? 'You' : selectedFriend.username}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.875rem' } }}>
            {pinnedMessage.content}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onUnpin} sx={{ p: { xs: 0.5, sm: 0.75, md: 1 }, ml: 1 }}>
          <CloseIcon fontSize={isMobile ? 'small' : 'medium'} />
        </IconButton>
      </Box>
    </Card>
  );
};