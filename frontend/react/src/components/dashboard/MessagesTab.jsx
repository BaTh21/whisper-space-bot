import { Chat as ChatIcon, Close as CloseIcon, Reply as ReplyIcon, Send as SendIcon } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useAvatar } from '../../hooks/useAvatar';
import { deleteMessage, editMessage, getPrivateChat, sendPrivateMessage } from '../../services/api';
import ChatMessage from '../chat/ChatMessage';
import ForwardMessageDialog from '../chat/ForwardMessageDialog';

const MessagesTab = ({ friends, profile, setError, setSuccess }) => {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  // Use the avatar hook - single instance for all avatars
  const { getAvatarUrl, getUserInitials, getUserAvatar } = useAvatar();

  // Clear chat state helper
  const clearChatState = () => {
    setMessages([]);
    setReplyingTo(null);
    setNewMessage('');
  };

  // Check for selected friend from FriendsTab when component mounts
  useEffect(() => {
    const storedFriend = localStorage.getItem('selectedFriend');
    if (storedFriend) {
      try {
        const friend = JSON.parse(storedFriend);
        handleSelectFriend(friend);
        localStorage.removeItem('selectedFriend');
      } catch (error) {
        console.error('Error parsing stored friend:', error);
      }
    }
  }, []);

  // FIXED: No more polling - only load when selectedFriend changes
  useEffect(() => {
    if (!selectedFriend) {
      setMessages([]);
      return;
    }

    let isSubscribed = true;

    const loadMessages = async () => {
      try {
        const chatMessages = await getPrivateChat(selectedFriend.id);
        
        if (isSubscribed) {
          const enhancedMessages = chatMessages.map(message => {
            const isMyMessage = message.sender_id === profile?.id;
            const sender = isMyMessage ? profile : selectedFriend;
            
            return {
              ...message,
              sender: {
                username: sender?.username || 'Unknown User',
                avatar_url: getUserAvatar(sender),
                id: sender?.id
              },
              is_read: message.is_read || false
            };
          });
          
          const sortedMessages = enhancedMessages.sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
          );

          setMessages(sortedMessages);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    loadMessages();

    return () => {
      isSubscribed = false;
    };
  }, [selectedFriend?.id, profile, getUserAvatar]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectFriend = async (friend) => {
    clearChatState();
    setSelectedFriend(friend);
    setIsLoadingMessages(true);
    
    try {
      const chatMessages = await getPrivateChat(friend.id);
      
      const enhancedMessages = chatMessages.map(message => {
        const isMyMessage = message.sender_id === profile?.id;
        const sender = isMyMessage ? profile : friend;
        
        return {
          ...message,
          sender: {
            username: sender?.username || 'Unknown User',
            avatar_url: getUserAvatar(sender),
            id: sender?.id
          },
          is_read: message.is_read || false
        };
      });
      
      const sortedMessages = enhancedMessages.sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      );
      setMessages(sortedMessages);
    } catch (err) {
      setError(err.message || 'Failed to load messages');
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      const updatedMessage = await editMessage(messageId, newContent);
      const isMyMessage = updatedMessage.sender_id === profile?.id;
      const sender = isMyMessage ? profile : selectedFriend;
      
      const enhancedMessage = {
        ...updatedMessage,
        sender: {
          username: sender?.username || 'Unknown User',
          avatar_url: getUserAvatar(sender),
          id: sender?.id
        }
      };
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...enhancedMessage, is_temp: false }
            : msg
        )
      );
      setSuccess('Message updated successfully');
    } catch (err) {
      setError(err.message || 'Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    setMessages(prev => prev.filter(msg => String(msg.id) !== String(messageId)));
    setSuccess('Message deleted successfully');
    
    try {
      await deleteMessage(messageId);
    } catch (err) {
      setError('Failed to delete message on server',err);
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    setTimeout(() => {
      const input = document.querySelector('textarea');
      if (input) input.focus();
    }, 100);
  };

  const handleForward = (message) => {
    setForwardingMessage(message);
    setForwardDialogOpen(true);
  };

  const handleForwardMessage = async (message, friendIds) => {
    try {
      setMessageLoading(true);
      const forwardPromises = friendIds.map(friendId =>
        sendPrivateMessage(friendId, {
          content: message.content,
          message_type: 'text',
          is_forwarded: true,
          original_sender: message.sender?.username || profile?.username || 'Unknown',
          reply_to_id: message.reply_to_id || null,
        })
      );

      await Promise.all(forwardPromises);
      setSuccess(`Message forwarded to ${friendIds.length} ${friendIds.length === 1 ? 'friend' : 'friends'}`);
      setForwardDialogOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to forward message');
    } finally {
      setMessageLoading(false);
    }
  };

  const clearReply = () => {
    setReplyingTo(null);
    setTimeout(() => {
      const input = document.querySelector('textarea');
      if (input) input.focus();
    }, 100);
  };

  const handleSendMessage = async () => {
    const messageContent = newMessage.trim();
    if (!messageContent || !selectedFriend) return;

    setMessageLoading(true);

    try {
      const tempMessage = {
        id: Date.now(),
        sender_id: profile.id,
        receiver_id: selectedFriend.id,
        content: messageContent,
        message_type: 'text',
        is_read: false,
        created_at: new Date().toISOString(),
        is_temp: true,
        reply_to_id: replyingTo?.id || null,
        reply_to: replyingTo || null,
        sender: {
          username: profile.username,
          avatar_url: getUserAvatar(profile),
          id: profile.id
        }
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      setReplyingTo(null);

      const sentMessage = await sendPrivateMessage(selectedFriend.id, { 
        content: messageContent, 
        message_type: 'text',
        reply_to_id: replyingTo?.id || null,
      });

      const enhancedSentMessage = {
        ...sentMessage,
        sender: {
          username: profile.username,
          avatar_url: getUserAvatar(profile),
          id: profile.id
        },
        is_temp: false,
        is_read: sentMessage.is_read || false
      };

      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.is_temp);
        const newMessages = [...filtered, enhancedSentMessage];
        return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

    } catch (err) {
      setError(err.message || 'Failed to send message');
      setMessages(prev => prev.filter(msg => !msg.is_temp));
      setNewMessage(messageContent);
    } finally {
      setMessageLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ display: 'flex', height: 600, borderRadius: '8px', overflow: 'hidden' }}>
      {/* Friends List Sidebar */}
      <Box sx={{ 
        width: 300, 
        borderRight: 1, 
        borderColor: 'divider', 
        pr: 2,
        bgcolor: 'background.paper'
      }}>
        <Typography variant="h6" gutterBottom sx={{ p: 2, fontWeight: 600 }}>
          Friends {isLoadingMessages && <CircularProgress size={16} sx={{ ml: 1 }} />}
        </Typography>
        <List sx={{ maxHeight: 520, overflow: 'auto' }}>
          {friends.map((friend) => (
            <ListItem
              key={friend.id}
              selected={selectedFriend?.id === friend.id}
              onClick={() => handleSelectFriend(friend)}
              disabled={isLoadingMessages}
              sx={{
                borderRadius: '12px',
                mb: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'action.hover',
                  transform: 'translateX(4px)',
                },
                '&.Mui-selected': {
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                }
              }}
            >
              <ListItemAvatar>
                <Avatar 
                  src={getUserAvatar(friend)} 
                  alt={friend.username} 
                  sx={{ width: 40, height: 40 }}
                >
                  {getUserInitials(friend.username)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="body1" fontWeight="500">
                    {friend.username}
                  </Typography>
                }
                secondary={friend.email}
              />
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Chat Area */}
      <Box sx={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: '#f8f9fa'
      }}>
        {selectedFriend ? (
          <>
            {/* Chat Header */}
            <Box sx={{ 
              p: 2, 
              borderBottom: 1, 
              borderColor: 'divider', 
              bgcolor: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}>
              <Avatar 
                src={getUserAvatar(selectedFriend)} 
                sx={{ 
                  width: 44, 
                  height: 44,
                  fontSize: '1.2rem',
                  fontWeight: 'bold'
                }}
              >
                {getUserInitials(selectedFriend.username)}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" fontWeight="600">
                  {selectedFriend.username || 'Friend'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isLoadingMessages ? 'Loading messages...' : 
                   messages.length > 0 ? 'Online • Last seen recently' : 'Start a conversation'}
                </Typography>
              </Box>
              <Chip
                label="Manual refresh"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ borderRadius: '8px' }}
              />
            </Box>
            
            {/* Reply Preview Bar */}
            {replyingTo && (
              <Box sx={{ 
                p: 2, 
                bgcolor: 'primary.light', 
                color: 'primary.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <ReplyIcon sx={{ mr: 1.5, fontSize: '1.2rem', flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', fontWeight: 500 }}>
                      Replying to {replyingTo.sender_id === profile?.id ? 'yourself' : selectedFriend.username}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                    }}>
                      {replyingTo.content}
                    </Typography>
                  </Box>
                </Box>
                <IconButton 
                  size="small" 
                  onClick={clearReply}
                  sx={{ 
                    color: 'primary.contrastText',
                    flexShrink: 0,
                    ml: 1
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
            
            {/* Messages Container */}
            <Box sx={{ 
              flexGrow: 1, 
              overflow: 'auto', 
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)'
            }}>
              {isLoadingMessages ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              ) : messages.length === 0 ? (
                <Box sx={{ 
                  textAlign: 'center', 
                  mt: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%'
                }}>
                  <ChatIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No messages yet
                  </Typography>
                  <Typography color="text.secondary">
                    Start a conversation with {selectedFriend.username}
                  </Typography>
                </Box>
              ) : (
                <>
                  {messages
                    .filter(message => !message.is_unsent && !message.is_temp)
                    .map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        isMine={message.sender_id === profile?.id}
                        onUpdate={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onReply={handleReply}
                        onForward={handleForward}
                        profile={profile}
                        currentFriend={selectedFriend}
                        getAvatarUrl={getAvatarUrl}
                        getUserInitials={getUserInitials}
                      />
                    ))
                  }
                  <div ref={messagesEndRef} />
                </>
              )}
            </Box>
            
            {/* Message Input */}
            <Box sx={{ 
              p: 2, 
              borderTop: 1, 
              borderColor: 'divider', 
              bgcolor: 'white',
              display: 'flex', 
              gap: 1, 
              alignItems: 'flex-end' 
            }}>
              <TextField
                fullWidth
                size="small"
                placeholder={
                  replyingTo 
                    ? `Replying to ${replyingTo.sender_id === profile?.id ? 'yourself' : selectedFriend.username}...` 
                    : "Type a message... (Press Enter to send)"
                }
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                multiline
                maxRows={3}
                disabled={messageLoading}
                sx={{ 
                  borderRadius: '24px',
                  bgcolor: '#f8f9fa'
                }}
                autoFocus={!!replyingTo}
              />
              <Button
                variant="contained"
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || messageLoading}
                sx={{ 
                  minWidth: '48px', 
                  height: '48px', 
                  borderRadius: '50%',
                  bgcolor: '#0088cc',
                  '&:hover': {
                    bgcolor: '#0077b3'
                  }
                }}
              >
                {messageLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <SendIcon />}
              </Button>
            </Box>
          </>
        ) : (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            bgcolor: '#f8f9fa'
          }}>
            <ChatIcon sx={{ fontSize: 96, color: 'grey.300', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select a friend to start chatting
            </Typography>
            <Typography color="text.secondary" align="center">
              Choose a friend from the list to begin your conversation
            </Typography>
          </Box>
        )}
      </Box>

      {/* Forward Message Dialog */}
      <ForwardMessageDialog
        open={forwardDialogOpen}
        onClose={() => setForwardDialogOpen(false)}
        message={forwardingMessage}
        friends={friends.filter(friend => friend.id !== selectedFriend?.id)}
        onForward={handleForwardMessage}
        getAvatarUrl={getAvatarUrl}
        getUserInitials={getUserInitials}
      />
    </Box>
  );
};

export default MessagesTab;