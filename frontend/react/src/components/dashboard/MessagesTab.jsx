//dashboard/MessagesTab.jsx
import { Chat as ChatIcon, Close as CloseIcon, Menu as MenuIcon, PushPin as PushPinIcon, Reply as ReplyIcon, Send as SendIcon } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useAvatar } from '../../hooks/useAvatar';
import { deleteMessage, editMessage, getPrivateChat, markMessagesAsRead, sendPrivateMessage } from '../../services/api';
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
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const messageInterval = useRef(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Use the avatar hook
  const { getAvatarUrl, getUserInitials, getUserAvatar, handleAvatarError } = useAvatar();

  // Clear chat state helper
  const clearChatState = () => {
    setMessages([]);
    setReplyingTo(null);
    setPinnedMessage(null);
    setNewMessage('');
  };

  // Organize messages into threads
  const organizeMessagesIntoThreads = (messagesList) => {
    const threads = new Map();
    const rootMessages = [];
    
    messagesList.forEach(message => {
      if (message.reply_to_id) {
        if (!threads.has(message.reply_to_id)) {
          threads.set(message.reply_to_id, []);
        }
        threads.get(message.reply_to_id).push(message);
      } else {
        rootMessages.push(message);
      }
    });
    
    const buildThread = (message) => {
      const thread = {
        ...message,
        replies: threads.get(message.id) ? 
          threads.get(message.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : 
          []
      };
      
      thread.replies = thread.replies.map(reply => buildThread(reply));
      
      return thread;
    };
    
    return rootMessages.map(message => buildThread(message))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  // Flatten threads for rendering
  const flattenThreads = (threads, level = 0) => {
    let flatList = [];
    
    threads.forEach(thread => {
      flatList.push({
        ...thread,
        threadLevel: level,
        isThreadStart: level === 0 && thread.replies.length > 0
      });
      
      if (thread.replies && thread.replies.length > 0) {
        flatList = flatList.concat(flattenThreads(thread.replies, level + 1));
      }
    });
    
    return flatList;
  };

  // Get messages organized in threads
  const getThreadedMessages = () => {
    const threads = organizeMessagesIntoThreads(messages);
    return flattenThreads(threads);
  };

  // Real-time message polling
  useEffect(() => {
    if (!selectedFriend || !profile?.id) return;

    const pollForNewMessages = async () => {
      try {
        const chatMessages = await getPrivateChat(selectedFriend.id);
        
        const enhancedMessages = chatMessages.map(message => {
          const isMyMessage = message.sender_id === profile?.id;
          const sender = isMyMessage ? profile : selectedFriend;
          
          const replyToData = message.reply_to ? {
            id: message.reply_to.id,
            content: message.reply_to.content,
            sender_id: message.reply_to.sender_id,
            sender_username: message.reply_to.sender_id === profile?.id ? profile.username : selectedFriend.username
          } : null;
          
          return {
            ...message,
            sender: {
              username: sender?.username || 'Unknown User',
              avatar_url: getUserAvatar(sender),
              id: sender?.id
            },
            reply_to: replyToData,
            is_read: message.is_read || false,
            read_at: message.read_at || null,
            delivered_at: message.delivered_at || null,
            is_temp: message.is_temp || false
          };
        });
        
        const sortedMessages = enhancedMessages.sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );

        setMessages(sortedMessages);
      } catch (error) {
        console.error('Failed to poll messages:', error);
      }
    };

    messageInterval.current = setInterval(pollForNewMessages, 3000);
    pollForNewMessages();

    return () => {
      if (messageInterval.current) {
        clearInterval(messageInterval.current);
      }
    };
  }, [selectedFriend?.id, profile, getUserAvatar]);

  // Mark messages as read when they are visible
  useEffect(() => {
    if (messages.length > 0 && selectedFriend) {
      const unreadMessages = messages.filter(
        msg => !msg.is_read && 
               !msg.read_at && 
               msg.sender_id === selectedFriend.id &&
               !msg.is_temp
      );
      
      if (unreadMessages.length > 0) {
        const unreadIds = unreadMessages.map(msg => msg.id);
        handleMarkAsRead(unreadIds);
      }
    }
  }, [messages, selectedFriend]);

  // Function to mark messages as read
  const handleMarkAsRead = async (messageIds) => {
    try {
      setMessages(prev => prev.map(msg => 
        messageIds.includes(msg.id) 
          ? { 
              ...msg, 
              is_read: true, 
              read_at: msg.read_at || new Date().toISOString() 
            }
          : msg
      ));
      
      await markMessagesAsRead(messageIds);
      
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  // Simulate real-time message reception from friend
  useEffect(() => {
    if (!selectedFriend) return;

    const simulateFriendTyping = () => {
      const shouldSendMessage = Math.random() > 0.98;
      
      if (shouldSendMessage) {
        const friendMessages = [
          "Hey! How are you?",
          "What's up?",
          "Nice to chat with you!",
          "I got your message",
          "Thanks for reaching out!",
          "How's your day going?",
          "That's interesting!",
          "I agree with you",
          "Let me think about that",
          "Sounds good to me!"
        ];
        
        const randomMessage = friendMessages[Math.floor(Math.random() * friendMessages.length)];
        
        const simulatedMessage = {
          id: `friend-${Date.now()}-${Math.random()}`,
          sender_id: selectedFriend.id,
          receiver_id: profile.id,
          content: randomMessage,
          message_type: 'text',
          is_read: false,
          read_at: null,
          delivered_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          is_temp: false,
          sender: {
            username: selectedFriend.username,
            avatar_url: getUserAvatar(selectedFriend),
            id: selectedFriend.id
          }
        };
        
        setMessages(prev => {
          const messageExists = prev.some(msg => msg.id === simulatedMessage.id);
          if (messageExists) return prev;
          
          const newMessages = [...prev, simulatedMessage];
          return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
        
        setSuccess(`New message from ${selectedFriend.username}`);
        setTimeout(() => {
          setSuccess('');
        }, 2000);
      }
    };

    const typingInterval = setInterval(simulateFriendTyping, 15000);

    return () => {
      clearInterval(typingInterval);
    };
  }, [selectedFriend, profile, getUserAvatar, setSuccess]);

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

  const handleSelectFriend = async (friend) => {
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
    
    clearChatState();
    setSelectedFriend(friend);
    setIsLoadingMessages(true);
    
    try {
      const chatMessages = await getPrivateChat(friend.id);
      
      const enhancedMessages = chatMessages.map(message => {
        const isMyMessage = message.sender_id === profile?.id;
        const sender = isMyMessage ? profile : friend;
        
        const replyToData = message.reply_to ? {
          id: message.reply_to.id,
          content: message.reply_to.content,
          sender_id: message.reply_to.sender_id,
          sender_username: message.reply_to.sender_id === profile?.id ? profile.username : friend.username
        } : null;
        
        return {
          ...message,
          sender: {
            username: sender?.username || 'Unknown User',
            avatar_url: getUserAvatar(sender),
            id: sender?.id
          },
          reply_to: replyToData,
          is_read: message.is_read || false,
          read_at: message.read_at || null,
          delivered_at: message.delivered_at || null
        };
      });
      
      const sortedMessages = enhancedMessages.sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      );
      setMessages(sortedMessages);
    } catch (err) {
      console.error('Failed to load messages:', err);
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
      
      const replyToData = updatedMessage.reply_to ? {
        id: updatedMessage.reply_to.id,
        content: updatedMessage.reply_to.content,
        sender_id: updatedMessage.reply_to.sender_id,
        sender_username: updatedMessage.reply_to.sender_id === profile?.id ? profile.username : selectedFriend.username
      } : null;
      
      const enhancedMessage = {
        ...updatedMessage,
        sender: {
          username: sender?.username || 'Unknown User',
          avatar_url: getUserAvatar(sender),
          id: sender?.id
        },
        reply_to: replyToData,
        is_read: updatedMessage.is_read || false,
        read_at: updatedMessage.read_at || null,
        delivered_at: updatedMessage.delivered_at || null
      };
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...enhancedMessage, is_temp: false }
            : msg
        )
      );
      setSuccess('Message updated successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || 'Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (pinnedMessage && pinnedMessage.id === messageId) {
      setPinnedMessage(null);
    }
    if (replyingTo && replyingTo.id === messageId) {
      setReplyingTo(null);
    }
    
    setMessages(prev => prev.filter(msg => String(msg.id) !== String(messageId)));
    setSuccess('Message deleted successfully');
    setTimeout(() => setSuccess(''), 2000);
    
    try {
      await deleteMessage(messageId);
    } catch (err) {
      console.error('Failed to delete message on server:', err);
    }
  };

  // Handle reply - automatically pin the message
  const handleReply = (message) => {
    setReplyingTo(message);
    setPinnedMessage(message);
    setTimeout(() => {
      const input = document.querySelector('textarea');
      if (input) input.focus();
    }, 100);
  };

  // Handle manual pinning of messages
  const handlePinMessage = (message) => {
    setPinnedMessage(message);
    setSuccess('Message pinned to top');
    setTimeout(() => setSuccess(''), 2000);
  };

  // Handle unpinning messages
  const handleUnpinMessage = () => {
    setPinnedMessage(null);
    if (replyingTo && pinnedMessage && replyingTo.id === pinnedMessage.id) {
      setReplyingTo(null);
    }
    setSuccess('Message unpinned');
    setTimeout(() => setSuccess(''), 2000);
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
      setTimeout(() => setSuccess(''), 2000);
      setForwardDialogOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to forward message');
    } finally {
      setMessageLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const messageContent = newMessage.trim();
    if (!messageContent || !selectedFriend) return;

    setMessageLoading(true);

    const replyToData = replyingTo ? {
      id: replyingTo.id,
      content: replyingTo.content,
      sender_id: replyingTo.sender_id,
      sender_username: replyingTo.sender_id === profile?.id ? profile.username : selectedFriend.username
    } : null;

    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender_id: profile.id,
      receiver_id: selectedFriend.id,
      content: messageContent,
      message_type: 'text',
      is_read: false,
      read_at: null,
      delivered_at: null,
      created_at: new Date().toISOString(),
      is_temp: true,
      reply_to_id: replyingTo?.id || null,
      reply_to: replyToData,
      sender: {
        username: profile.username,
        avatar_url: getUserAvatar(profile),
        id: profile.id
      }
    };

    try {
      setMessages(prev => {
        const newMessages = [...prev, tempMessage];
        return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });
      
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
        is_read: sentMessage.is_read || false,
        read_at: sentMessage.read_at || null,
        delivered_at: sentMessage.delivered_at || new Date().toISOString(),
        reply_to: replyToData
      };

      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== tempMessage.id);
        const newMessages = [...filtered, enhancedSentMessage];
        return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

    } catch (err) {
      setError(err.message || 'Failed to send message');
      setMessages(prev => prev.filter(msg => !msg.is_temp || msg.id !== tempMessage.id));
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

  const getConnectionStatus = () => {
    return { text: 'Online • Real-time', color: 'success.main' };
  };

  const status = getConnectionStatus();

  const handleLocalAvatarError = (avatarUrl) => {
    console.log('Avatar failed to load in MessagesTab:', avatarUrl);
  };

  // Get threaded messages for rendering
  const threadedMessages = getThreadedMessages();

  // Mobile drawer for friends list
  const FriendsListDrawer = () => (
    <Drawer
      variant="temporary"
      open={mobileDrawerOpen}
      onClose={() => setMobileDrawerOpen(false)}
      ModalProps={{
        keepMounted: true,
      }}
      sx={{
        display: { xs: 'block', md: 'none' },
        '& .MuiDrawer-paper': { 
          boxSizing: 'border-box', 
          width: 300,
          borderRight: 1, 
          borderColor: 'divider', 
          pr: 2,
          bgcolor: 'background.paper'
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Friends {isLoadingMessages && <CircularProgress size={16} sx={{ ml: 1 }} />}
        </Typography>
        <List sx={{ maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
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
                  imgProps={{
                    onError: () => handleAvatarError ? handleAvatarError(friend.avatar_url || friend.avatar) : handleLocalAvatarError(friend.avatar_url || friend.avatar)
                  }}
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
              <Box 
                sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  bgcolor: 'success.main',
                  ml: 1
                }} 
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );

  return (
    <Box sx={{ 
      display: 'flex', 
      height: { xs: 'calc(100vh - 200px)', sm: 600 },
      borderRadius: '8px', 
      overflow: 'hidden',
      flexDirection: 'column'
    }}>
      {/* Mobile Header */}
      {isMobile && selectedFriend && (
        <Box sx={{ 
          p: 1, 
          borderBottom: 1, 
          borderColor: 'divider', 
          bgcolor: 'white',
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center',
          gap: 1
        }}>
          <IconButton onClick={() => setMobileDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Avatar 
            src={getUserAvatar(selectedFriend)} 
            sx={{ 
              width: 36, 
              height: 36,
              fontSize: '1rem',
            }}
          >
            {getUserInitials(selectedFriend.username)}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body1" fontWeight="600">
              {selectedFriend.username || 'Friend'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {status.text}
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', flex: 1, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Friends List Sidebar - Desktop */}
        {!isMobile && (
          <Box sx={{ 
            width: { md: 300, lg: 350 }, 
            borderRight: 1, 
            borderColor: 'divider', 
            pr: 2,
            bgcolor: 'background.paper',
            display: { xs: 'none', md: 'block' }
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
                      imgProps={{
                        onError: () => handleAvatarError ? handleAvatarError(friend.avatar_url || friend.avatar) : handleLocalAvatarError(friend.avatar_url || friend.avatar)
                      }}
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
                  <Box 
                    sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      bgcolor: 'success.main',
                      ml: 1
                    }} 
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Friends List Drawer - Mobile */}
        <FriendsListDrawer />

        {/* Chat Area */}
        <Box sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column',
          bgcolor: '#f8f9fa'
        }}>
          {selectedFriend ? (
            <>
              {/* Chat Header - Desktop */}
              {!isMobile && (
                <Box sx={{ 
                  p: 2, 
                  borderBottom: 1, 
                  borderColor: 'divider', 
                  bgcolor: 'white',
                  display: { xs: 'none', md: 'flex' },
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
                    imgProps={{
                      onError: () => handleAvatarError ? handleAvatarError(selectedFriend.avatar_url || selectedFriend.avatar) : handleLocalAvatarError(selectedFriend.avatar_url || selectedFriend.avatar)
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
                      `${status.text} • ${messages.length} messages`}
                    </Typography>
                  </Box>
                  <Chip
                    label={status.text}
                    size="small"
                    sx={{ 
                      borderRadius: '8px',
                      backgroundColor: status.color,
                      color: 'white',
                      fontWeight: '500'
                    }}
                  />
                </Box>
              )}
              
              {/* PERMANENT PINNED MESSAGE */}
              {pinnedMessage && (
                <Card 
                  sx={{ 
                    m: { xs: 1, sm: 2 }, 
                    mb: 1,
                    p: { xs: 1.5, sm: 2 }, 
                    bgcolor: replyingTo ? 'primary.light' : 'warning.light',
                    border: '2px solid',
                    borderColor: replyingTo ? 'primary.main' : 'warning.main',
                    borderRadius: '12px',
                    position: 'relative'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        {replyingTo ? (
                          <ReplyIcon 
                            fontSize="small" 
                            sx={{ 
                              mr: 1, 
                              color: 'primary.dark'
                            }} 
                          />
                        ) : (
                          <PushPinIcon 
                            fontSize="small" 
                            sx={{ 
                              mr: 1, 
                              color: 'warning.dark',
                              transform: 'rotate(45deg)'
                            }} 
                          />
                        )}
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: replyingTo ? 'primary.dark' : 'warning.dark',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}
                        >
                          {replyingTo ? 'Replying To' : 'Pinned Message'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Avatar 
                          src={getUserAvatar(pinnedMessage.sender_id === profile?.id ? profile : selectedFriend)} 
                          sx={{ width: 24, height: 24, mr: 1 }}
                        >
                          {getUserInitials(pinnedMessage.sender_id === profile?.id ? profile.username : selectedFriend.username)}
                        </Avatar>
                        <Typography variant="body2" fontWeight="500" sx={{ color: replyingTo ? 'primary.contrastText' : 'inherit' }}>
                          {pinnedMessage.sender_id === profile?.id ? 'You' : selectedFriend.username}
                        </Typography>
                        <Typography variant="caption" sx={{ ml: 1, color: replyingTo ? 'primary.contrastText' : 'text.secondary', opacity: 0.8 }}>
                          {new Date(pinnedMessage.created_at).toLocaleTimeString()}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ lineHeight: 1.4, color: replyingTo ? 'primary.contrastText' : 'inherit' }}>
                        {pinnedMessage.content}
                      </Typography>
                      {replyingTo && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'primary.contrastText', opacity: 0.9 }}>
                          💬 You are replying to this message...
                        </Typography>
                      )}
                    </Box>
                    <IconButton 
                      size="small" 
                      onClick={handleUnpinMessage}
                      sx={{ 
                        color: replyingTo ? 'primary.contrastText' : 'warning.dark',
                        ml: 1
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Card>
              )}
              
              {/* Messages Container */}
              <Box sx={{ 
                flexGrow: 1, 
                overflow: 'auto', 
                p: { xs: 1, sm: 2 },
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
                    <ChatIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: 'grey.300', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No messages yet
                    </Typography>
                    <Typography color="text.secondary" align="center">
                      Start a conversation with {selectedFriend.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      💡 Friend messages will appear automatically in real-time
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {threadedMessages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        isMine={message.sender_id === profile?.id}
                        onUpdate={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onReply={handleReply}
                        onForward={handleForward}
                        onPin={handlePinMessage}
                        profile={profile}
                        currentFriend={selectedFriend}
                        getAvatarUrl={getAvatarUrl}
                        getUserInitials={getUserInitials}
                        isPinned={pinnedMessage && pinnedMessage.id === message.id}
                        isBeingReplied={replyingTo && replyingTo.id === message.id}
                        threadLevel={message.threadLevel || 0}
                        isThreadStart={message.isThreadStart || false}
                        hasReplies={message.replies && message.replies.length > 0}
                      />
                    ))}
                  </>
                )}
              </Box>
              
              {/* Message Input */}
              <Box sx={{ 
                p: { xs: 1, sm: 2 }, 
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
                    minWidth: { xs: '40px', sm: '48px' }, 
                    height: { xs: '40px', sm: '48px' }, 
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
              bgcolor: '#f8f9fa',
              p: 2
            }}>
              <ChatIcon sx={{ fontSize: { xs: 64, sm: 96 }, color: 'grey.300', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom align="center">
                {isMobile ? 'Tap menu to select a friend' : 'Select a friend to start chatting'}
              </Typography>
              <Typography color="text.secondary" align="center">
                {isMobile ? 'Open the menu to choose a friend' : 'Choose a friend from the list to begin your conversation'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }} align="center">
                💡 Messages update in real-time automatically
              </Typography>
              {isMobile && (
                <Button
                  variant="contained"
                  onClick={() => setMobileDrawerOpen(true)}
                  sx={{ mt: 2 }}
                >
                  Open Friends List
                </Button>
              )}
            </Box>
          )}
        </Box>
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