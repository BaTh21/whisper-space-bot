import { Chat as ChatIcon } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import ChatMessage from '../ChatMessage';

export const MessagesList = ({
  messages,
  threadedMessages,
  messagesContainerRef,
  selectedFriend,
  profile,
  onEditMessage,
  onDeleteMessage,
  onReply,
  onForward,
  onPin,
  getAvatarUrl,
  getUserInitials,
  pinnedMessage,
  isMobile,
  lastMessageSeen
}) => {
  return (
    <Box
      ref={messagesContainerRef}
      sx={{
        flex: 1,
        overflowY: 'auto',
        bgcolor: 'grey.50',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 50%, #f8f9fa 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 0.75, sm: 1, md: 1.25 },
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: '#c1c1c1',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: '#a8a8a8',
        },
      }}
    >
      {messages.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          mt: 8, 
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ChatIcon sx={{ 
            fontSize: { xs: 64, sm: 80, md: 96 }, 
            color: 'grey.400', 
            mb: 3,
            opacity: 0.6
          }} />
          <Typography 
            variant="h5" 
            color="text.secondary" 
            sx={{ 
              fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
              fontWeight: 500,
              mb: 1
            }}
          >
            No messages yet
          </Typography>
          <Typography 
            color="text.secondary" 
            sx={{ 
              fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
              opacity: 0.8
            }}
          >
            Say hello to {selectedFriend.username}!
          </Typography>
        </Box>
      ) : (
        threadedMessages.map((message, i) => {
          const isLast = i === threadedMessages.length - 1;
          const isMyLastMessage = isLast && message.sender_id === profile?.id;
          const shouldShowSeenStatus = isMyLastMessage && lastMessageSeen;
          
          return (
            <ChatMessage
              key={message.id}
              message={message}
              isMine={message.sender_id === profile?.id}
              onUpdate={onEditMessage}
              onDelete={onDeleteMessage}
              onReply={onReply}
              onForward={onForward}
              onPin={onPin}
              profile={profile}
              currentFriend={selectedFriend}
              getAvatarUrl={getAvatarUrl}
              getUserInitials={getUserInitials}
              isPinned={pinnedMessage?.id === message.id}
              showSeenStatus={shouldShowSeenStatus}
            />
          );
        })
      )}
    </Box>
  );
};