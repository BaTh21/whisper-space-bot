import { Close as CloseIcon, Reply as ReplyIcon } from '@mui/icons-material';
import { Box, IconButton, Typography } from '@mui/material';

export const ReplyPreview = ({
  replyingTo,
  profile,
  selectedFriend,
  onCancelReply,
  isMobile
}) => {
  if (!replyingTo) return null;

  return (
    <Box
      sx={{
        p: { xs: 1, sm: 1.25, md: 1.5 },
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'primary.light',
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <ReplyIcon sx={{ mr: 1, color: 'primary.dark' }} fontSize={isMobile ? 'small' : 'medium'} />
            <Typography
              variant="caption"
              sx={{
                color: 'primary.dark',
                fontWeight: 600,
                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.75rem' },
              }}
            >
              Replying to {replyingTo.sender_id === profile?.id ? 'yourself' : selectedFriend.username}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{
              color: 'primary.contrastText',
              fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.8rem' },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {replyingTo.content}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onCancelReply}
          sx={{ p: { xs: 0.5, sm: 0.75, md: 1 }, ml: 1 }}
        >
          <CloseIcon fontSize={isMobile ? 'small' : 'medium'} />
        </IconButton>
      </Box>
    </Box>
  );
};