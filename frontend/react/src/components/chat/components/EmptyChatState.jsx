import { Box, Button, Typography } from '@mui/material';
import { Chat as ChatIcon } from '@mui/icons-material';

export const EmptyChatState = ({
  isMobile,
  onOpenFriendsList
}) => {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 3, sm: 4, md: 2 },
        textAlign: 'center',
      }}
    >
      <ChatIcon sx={{ fontSize: { xs: 64, sm: 72, md: 80 }, color: 'grey.300', mb: 2 }} />
      <Typography
        variant="h6"
        color="text.secondary"
        sx={{ fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.25rem' }, mb: 1 }}
      >
        {isMobile ? 'Select a friend' : 'Choose a friend to start chatting'}
      </Typography>
      {isMobile && (
        <Button
          variant="contained"
          onClick={onOpenFriendsList}
          sx={{ mt: 2, borderRadius: '20px', px: 3, py: 1, fontSize: '0.9rem' }}
        >
          Open Friends List
        </Button>
      )}
    </Box>
  );
};