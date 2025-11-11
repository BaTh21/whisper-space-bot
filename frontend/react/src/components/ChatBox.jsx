import {
  Close as CloseIcon,
  Forward as ForwardIcon,
  Reply as ReplyIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { deleteMessage, editMessage, getPrivateChat, sendPrivateMessage } from '../services/api';
import ChatMessage from './ChatMessage';

export default function ChatBox({ selectedFriend, profile, friends }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  // Enhanced message fetching with proper sender information
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedFriend?.id) {
        setMessages([]);
        return;
      }
      
      setIsLoadingMessages(true);
      try {
        const chatMessages = await getPrivateChat(selectedFriend.id);
        
        // Enhanced message processing with proper sender info
        const enhancedMessages = chatMessages.map(message => {
          const isMyMessage = message.sender_id === profile?.id;
          
          return {
            ...message,
            // FIX 1: Ensure proper sender information
            sender: {
              username: isMyMessage 
                ? profile?.username 
                : selectedFriend?.username || 'Unknown User',
              avatar_url: isMyMessage 
                ? profile?.avatar_url 
                : selectedFriend?.avatar_url,
              id: isMyMessage ? profile?.id : selectedFriend?.id
            },
            // FIX 2: Ensure proper read status
            is_read: message.is_read || false
          };
        });
        
        const sortedMessages = enhancedMessages.sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );
        setMessages(sortedMessages);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedFriend?.id, profile]);

  // Enhanced polling for real-time updates
  useEffect(() => {
    if (!selectedFriend?.id) return;

    let isSubscribed = true;

    const pollMessages = async () => {
      try {
        const chatMessages = await getPrivateChat(selectedFriend.id);
        
        if (isSubscribed) {
          // Enhanced message processing with proper sender info
          const enhancedMessages = chatMessages.map(message => {
            const isMyMessage = message.sender_id === profile?.id;
            
            return {
              ...message,
              // FIX 1: Ensure proper sender information
              sender: {
                username: isMyMessage 
                  ? profile?.username 
                  : selectedFriend?.username || 'Unknown User',
                avatar_url: isMyMessage 
                  ? profile?.avatar_url 
                  : selectedFriend?.avatar_url,
                id: isMyMessage ? profile?.id : selectedFriend?.id
              },
              // FIX 2: Ensure proper read status
              is_read: message.is_read || false
            };
          });
          
          const sortedMessages = enhancedMessages.sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
          );
          
          // Only update if messages actually changed
          setMessages(prev => {
            if (JSON.stringify(prev) === JSON.stringify(sortedMessages)) {
              return prev;
            }
            return sortedMessages;
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    
    // Poll every 1.5 seconds
    const pollInterval = setInterval(pollMessages, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [selectedFriend?.id, profile]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        sender: { // Enhanced sender info for immediate display
          username: profile.username,
          avatar_url: profile.avatar_url,
          id: profile.id
        }
      };

      // Add temporary message to UI immediately
      setMessages(prev => {
        const newMessages = [...prev, tempMessage];
        return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

      setNewMessage('');
      setReplyingTo(null);

      // Send to backend
      const sentMessage = await sendPrivateMessage(selectedFriend.id, { 
        content: messageContent, 
        message_type: 'text',
        reply_to_id: replyingTo?.id || null,
      });

      // Replace temporary message with real one from backend (with enhanced sender info)
      const enhancedSentMessage = {
        ...sentMessage,
        sender: {
          username: profile.username,
          avatar_url: profile.avatar_url,
          id: profile.id
        },
        is_temp: false,
        // FIX 2: Ensure read status is properly set
        is_read: sentMessage.is_read || false
      };

      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.is_temp);
        const newMessages = [...filtered, enhancedSentMessage];
        return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

    } catch (err) {
      console.error('Failed to send message:', err);
      // Remove temporary message on error
      setMessages(prev => prev.filter(msg => !msg.is_temp));
      setNewMessage(messageContent);
    } finally {
      setMessageLoading(false);
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      const updatedMessage = await editMessage(messageId, newContent);
      
      // Enhanced updated message with proper sender info
      const isMyMessage = updatedMessage.sender_id === profile?.id;
      const enhancedMessage = {
        ...updatedMessage,
        sender: {
          username: isMyMessage 
            ? profile?.username 
            : selectedFriend?.username || 'Unknown User',
          avatar_url: isMyMessage 
            ? profile?.avatar_url 
            : selectedFriend?.avatar_url,
          id: isMyMessage ? profile?.id : selectedFriend?.id
        }
      };
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...enhancedMessage, is_temp: false }
            : msg
        )
      );
    } catch (err) {
      console.error('Edit message error:', err);
      throw err;
    }
  };

  const handleDeleteMessage = async (messageId) => {
    console.log('Deleting message:', messageId);
    
    // Immediately remove from UI by filtering it out
    setMessages(prev => prev.filter(msg => String(msg.id) !== String(messageId)));
    
    // Call backend delete
    try {
      await deleteMessage(messageId);
      console.log('Backend delete successful');
    } catch (err) {
      console.error('Backend delete failed:', err);
      throw err;
    }
  };

  // Handle reply function - FIX 3: Improved reply system
  const handleReply = (message) => {
    setReplyingTo(message);
    // Auto-focus on input when replying
    setTimeout(() => {
      const input = document.querySelector('textarea');
      if (input) input.focus();
    }, 100);
  };

  // Handle forward function
  const handleForward = (message) => {
    setForwardingMessage(message);
  };

  // Handle actual forwarding
  const handleForwardMessage = async (message, friendIds) => {
    try {
      setMessageLoading(true);
      
      // Send the message to each selected friend
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
      
      console.log(`Message forwarded to ${friendIds.length} ${friendIds.length === 1 ? 'friend' : 'friends'}`);
      setForwardingMessage(null);
      
    } catch (err) {
      console.error('Failed to forward message:', err);
      throw err;
    } finally {
      setMessageLoading(false);
    }
  };

  // Clear reply - FIX 3: Improved reply clearing
  const clearReply = () => {
    setReplyingTo(null);
    // Auto-focus back to input
    setTimeout(() => {
      const input = document.querySelector('textarea');
      if (input) input.focus();
    }, 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!selectedFriend) {
    return (
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '70vh',
        flexDirection: 'column',
        bgcolor: '#f8f9fa'
      }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Select a friend to start chatting
        </Typography>
        <Typography color="text.secondary" align="center">
          Choose a friend from the list to begin your conversation
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '70vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
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
          src={selectedFriend.avatar_url} 
          sx={{ 
            width: 44, 
            height: 44, 
            bgcolor: 'primary.main',
            fontSize: '1.2rem',
            fontWeight: 'bold'
          }}
          // FIX 1: Better avatar fallback
          imgProps={{ onError: (e) => { e.target.style.display = 'none' } }}
        >
          {selectedFriend.username?.charAt(0)?.toUpperCase() || 'F'}
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
      </Box>
      
      {/* Messages Container */}
      <Box sx={{ 
        flex: 1, 
        overflowY: 'auto', 
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
              .filter(message => !message.is_temp) // REMOVED: unsent filtering
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
                />
              ))
            }
            <div ref={messagesEndRef} />
          </>
        )}
      </Box>

      {/* Reply preview bar - FIX 3: Improved reply UI */}
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
          onChange={e => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          multiline
          maxRows={3}
          disabled={messageLoading}
          InputProps={{
            sx: { 
              borderRadius: '24px',
              bgcolor: '#f8f9fa'
            }
          }}
          // FIX 3: Auto-focus when replying
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

      {/* Forward Dialog */}
      <ForwardMessageDialog
        open={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
        friends={friends.filter(friend => friend.id !== selectedFriend?.id)}
        onForward={handleForwardMessage}
      />
    </Box>
  );
}

// Forward Message Dialog Component (unchanged)
const ForwardMessageDialog = ({ open, onClose, message, friends, onForward }) => {
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleFriend = (friendId) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleForward = () => {
    if (selectedFriends.length > 0 && message) {
      onForward(message, selectedFriends);
      setSelectedFriends([]);
      setSearchTerm('');
      onClose();
    }
  };

  const handleCloseDialog = () => {
    setSelectedFriends([]);
    setSearchTerm('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleCloseDialog} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ForwardIcon color="primary" />
          <Typography variant="h6" fontWeight="600">Forward Message</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* Message Preview */}
        <Card 
          sx={{ 
            p: 2, 
            mb: 2, 
            bgcolor: 'grey.50',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1, opacity: 0.8 }}>
            Forwarding:
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            {message?.content}
          </Typography>
          {message?.reply_to && (
            <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
              <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 500 }}>
                Replying to: {message.reply_to.content}
              </Typography>
            </Box>
          )}
        </Card>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search friends..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            sx: {
              borderRadius: '12px',
            }
          }}
        />

        {/* Friends List */}
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Select friends to forward to:
        </Typography>
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {filteredFriends.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
              No friends found
            </Typography>
          ) : (
            filteredFriends.map((friend) => (
              <ListItem
                key={friend.id}
                sx={{
                  border: '1px solid',
                  borderColor: selectedFriends.includes(friend.id) ? 'primary.main' : 'divider',
                  borderRadius: '12px',
                  mb: 1,
                  bgcolor: selectedFriends.includes(friend.id) ? 'primary.light' : 'background.paper',
                  color: selectedFriends.includes(friend.id) ? 'primary.contrastText' : 'text.primary',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }
                }}
                onClick={() => handleToggleFriend(friend.id)}
                button
              >
                <ListItemAvatar>
                  <Avatar 
                    src={friend.avatar_url}
                    sx={{
                      width: 40,
                      height: 40,
                    }}
                  >
                    {friend.username?.charAt(0)?.toUpperCase() || 'F'}
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
                <Checkbox
                  checked={selectedFriends.includes(friend.id)}
                  onChange={() => handleToggleFriend(friend.id)}
                  color="primary"
                />
              </ListItem>
            ))
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button 
          onClick={handleCloseDialog}
          sx={{ borderRadius: '8px' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleForward}
          disabled={selectedFriends.length === 0}
          startIcon={<ForwardIcon />}
          sx={{ borderRadius: '8px' }}
        >
          Forward to {selectedFriends.length} {selectedFriends.length === 1 ? 'friend' : 'friends'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};