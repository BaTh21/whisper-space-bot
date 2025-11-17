// src/components/message/MessagesTab.jsx
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Menu as MenuIcon,
  PushPin as PushPinIcon,
  Reply as ReplyIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAvatar } from '../../hooks/useAvatar';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  deleteMessage,
  editMessage,
  getPrivateChat,
  sendPrivateMessage,
} from '../../services/api';
import ChatMessage from '../chat/ChatMessage';
import ForwardMessageDialog from '../chat/ForwardMessageDialog';

// WebSocket URL configuration
const getWebSocketBaseUrl = () => {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (!wsUrl) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return apiUrl.replace(/^http/, 'ws');
  }
  return wsUrl;
};

const BASE_URI = getWebSocketBaseUrl();

const MessagesTab = ({ friends, profile, setError, setSuccess }) => {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const lastMessageCount = useRef(0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { getAvatarUrl, getUserInitials, getUserAvatar } = useAvatar();

  /* --------------------------------------------------------------------- */
  /*                         WebSocket URL & Hook                         */
  /* --------------------------------------------------------------------- */
  const getWsUrl = useCallback(() => {
    if (!selectedFriend) return null;
    const rawToken = localStorage.getItem('accessToken') || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
    return `${BASE_URI}/api/v1/ws/private/${selectedFriend.id}?token=${token}`;
  }, [selectedFriend]);

  /* --------------------------------------------------------------------- */
  /*                         WebSocket Handlers                           */
  /* --------------------------------------------------------------------- */
  const handleWebSocketMessage = useCallback(
    (data) => {
      const { type } = data;

      if (type === 'message') {
        const incomingMsg = {
          ...data,
          is_temp: false,
          sender: {
            id: data.sender_id,
            username: data.sender_username,
            avatar_url: getAvatarUrl(data.sender_username ? null : data.sender_id),
          },
          reply_to: data.reply_to
            ? { 
                ...data.reply_to, 
                sender_username: data.reply_to.sender_username,
                is_read: data.reply_to.is_read || false,
                read_at: data.reply_to.read_at
              }
            : null,
          // Ensure these fields are properly set
          is_read: data.is_read || false,
          read_at: data.read_at,
          delivered_at: data.delivered_at
        };

        setMessages((prev) => {
          const filtered = prev.filter(
            (m) => !m.is_temp || m.content !== incomingMsg.content
          );
          if (filtered.some((m) => m.id === incomingMsg.id)) return filtered;

          return [...filtered, incomingMsg].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );
        });

      } else if (type === 'read_receipt') {
        // Update the specific message with read status
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.message_id
              ? { 
                  ...msg, 
                  is_read: true, 
                  read_at: data.read_at,
                  status: 'seen'
                }
              : msg
          )
        );
      } else if (type === 'typing') {
        setFriendTyping(data.is_typing);
      } else if (type === 'message_status_update') {
        // Handle other status updates like delivered
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.message_id
              ? { 
                  ...msg, 
                  is_read: data.is_read || msg.is_read,
                  read_at: data.read_at || msg.read_at,
                  delivered_at: data.delivered_at || msg.delivered_at,
                  status: data.status || msg.status
                }
              : msg
          )
        );
      }
    },
    [getAvatarUrl]
  );

  const handleWebSocketOpen = useCallback(() => {
    console.log('[WS] Connected');
    setError(null);
    if (messages.length === 0 && selectedFriend) loadInitialMessages();
  }, [selectedFriend, messages.length, setError]);

  const handleWebSocketClose = useCallback((event) => {
    console.log('[WS] Closed', event.code, event.reason);
    setFriendTyping(false);
  }, []);

  const handleWebSocketError = useCallback(
    (error) => {
      console.error('[WS] Error', error);
      setError('Chat connection failed');
    },
    [setError]
  );

  const handleReconnect = useCallback((attempt) => {
    console.log(`[WS] Reconnect #${attempt}`);
  }, []);

  const {
    sendMessage: sendWsMessage,
    closeConnection,
    isConnected,
    reconnectAttempts,
  } = useWebSocket(getWsUrl(), {
    onMessage: handleWebSocketMessage,
    onOpen: handleWebSocketOpen,
    onClose: handleWebSocketClose,
    onError: handleWebSocketError,
    onReconnect: handleReconnect,
    shouldReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
    debug: true,
  });

  /* --------------------------------------------------------------------- */
  /*                         Read Receipt System                          */
  /* --------------------------------------------------------------------- */
  const sendReadReceipt = useCallback((messageId) => {
    if (isConnected && messageId) {
      sendWsMessage({
        type: 'read_receipt',
        message_id: messageId,
        read_at: new Date().toISOString()
      });
    }
  }, [isConnected, sendWsMessage]);

  /* --------------------------------------------------------------------- */
  /*                         Auto-Mark as Read                            */
  /* --------------------------------------------------------------------- */
  const markMessagesAsRead = useCallback(() => {
    if (!selectedFriend || !messages.length) return;

    // Find the last message from friend that is not read
    const unreadMessages = messages.filter(
      msg => msg.sender_id === selectedFriend.id && !msg.is_read
    );

    if (unreadMessages.length > 0 && isConnected) {
      // Mark all unread messages as read
      const lastUnreadMessage = unreadMessages[unreadMessages.length - 1];
      
      // Update local state immediately for better UX
      setMessages(prev => prev.map(msg => 
        msg.sender_id === selectedFriend.id && !msg.is_read 
          ? { ...msg, is_read: true, read_at: new Date().toISOString() }
          : msg
      ));

      // Send read receipt for the last message
      sendReadReceipt(lastUnreadMessage.id);
    }
  }, [messages, selectedFriend, isConnected, sendReadReceipt]);

  /* --------------------------------------------------------------------- */
  /*                         Scroll & Read Handler                        */
  /* --------------------------------------------------------------------- */
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || !selectedFriend) return;

    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // If user is near the bottom (viewing latest messages), mark as read
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isNearBottom) {
      markMessagesAsRead();
    }
  }, [selectedFriend, markMessagesAsRead]);

  /* --------------------------------------------------------------------- */
  /*                         Auto-Mark on Message Receive                 */
  /* --------------------------------------------------------------------- */
  useEffect(() => {
    if (selectedFriend && isConnected) {
      markMessagesAsRead();
    }
  }, [messages, selectedFriend, isConnected, markMessagesAsRead]);

  /* --------------------------------------------------------------------- */
  /*                         Scroll Event Listener                        */
  /* --------------------------------------------------------------------- */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  /* --------------------------------------------------------------------- */
  /*                             Typing Indicators                         */
  /* --------------------------------------------------------------------- */
  const handleTypingStart = useCallback(() => {
    if (!isTyping && selectedFriend && isConnected) {
      setIsTyping(true);
      sendWsMessage({ type: 'typing', is_typing: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => handleTypingStop(), 3000);
  }, [isTyping, selectedFriend, isConnected, sendWsMessage]);

  const handleTypingStop = useCallback(() => {
    if (isTyping && selectedFriend && isConnected) {
      setIsTyping(false);
      sendWsMessage({ type: 'typing', is_typing: false });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isTyping, selectedFriend, isConnected, sendWsMessage]);

  /* --------------------------------------------------------------------- */
  /*                         Load Initial Messages                         */
  /* --------------------------------------------------------------------- */
  const loadInitialMessages = async () => {
    if (!selectedFriend || messages.length > 0) return;

    try {
      const chatMessages = await getPrivateChat(selectedFriend.id);
      const enhanced = chatMessages.map((msg) => ({
        ...msg,
        is_temp: false,
        sender: {
          id: msg.sender_id,
          username:
            msg.sender_id === profile?.id ? profile.username : selectedFriend.username,
          avatar_url: getUserAvatar(
            msg.sender_id === profile?.id ? profile : selectedFriend
          ),
        },
        reply_to: msg.reply_to
          ? {
              ...msg.reply_to,
              sender_username:
                msg.reply_to.sender_id === profile?.id
                  ? profile.username
                  : selectedFriend.username,
            }
          : null,
      }));

      setMessages(
        enhanced.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      );
    } catch (err) {
      setError('Failed to load messages');
      console.error(err);
    }
  };

  /* --------------------------------------------------------------------- */
  /*                           Friend Selection                            */
  /* --------------------------------------------------------------------- */
  const handleSelectFriend = (friend) => {
    if (isMobile) setMobileDrawerOpen(false);
    if (selectedFriend) closeConnection(1000, 'Switching friends');
    setSelectedFriend(friend);
    clearChatState();
  };

  const clearChatState = () => {
    setMessages([]);
    setReplyingTo(null);
    setPinnedMessage(null);
    setNewMessage('');
    setFriendTyping(false);
    setIsTyping(false);
  };

  /* --------------------------------------------------------------------- */
  /*                            Send Message                               */
  /* --------------------------------------------------------------------- */
  const handleSendMessage = async () => {
  const content = newMessage.trim();
  if (!content || !selectedFriend) return;

  const tempId = `temp-${Date.now()}`;
  const tempMsg = {
    id: tempId,
    sender_id: profile.id,
    receiver_id: selectedFriend.id,
    content,
    message_type: 'text',
    is_read: false,
    created_at: new Date().toISOString(),
    is_temp: true,
    reply_to_id: replyingTo?.id || null, // IMPORTANT: Include reply_to_id
    reply_to: replyingTo ? { // Include the full reply_to object for UI
      ...replyingTo,
      sender_username: replyingTo.sender_id === profile?.id ? profile.username : selectedFriend.username,
    } : null,
    sender: {
      username: profile.username,
      avatar_url: getUserAvatar(profile),
      id: profile.id,
    },
  };

  setMessages((prev) => [...prev, tempMsg]);
  setNewMessage('');
  setReplyingTo(null); // Clear the reply after sending
  handleTypingStop();

  const payload = {
    type: 'message',
    content,
    message_type: 'text',
    reply_to_id: replyingTo?.id || null, // IMPORTANT: Send reply_to_id to server
  };

  if (!sendWsMessage(payload)) {
    // fallback HTTP
    try {
      const sent = await sendPrivateMessage(selectedFriend.id, payload);
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== tempId)
          .concat({
            ...sent,
            is_temp: false,
            reply_to: replyingTo ? { // Include reply_to in the response
              ...replyingTo,
              sender_username: replyingTo.sender_id === profile?.id ? profile.username : selectedFriend.username,
            } : null,
            sender: {
              username: profile.username,
              avatar_url: getUserAvatar(profile),
              id: profile.id,
            },
          })
      );
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
    }
  }
};

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim() && selectedFriend && isConnected) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  /* --------------------------------------------------------------------- */
  /*                         Connection Status UI                         */
  /* --------------------------------------------------------------------- */
  const getConnectionStatus = () => {
    const unread = messages.filter(
      (m) => !m.is_read && m.sender_id === selectedFriend?.id
    ).length;

    if (friendTyping) return { text: 'Typing...', color: 'info.main' };
    if (!isConnected)
      return {
        text:
          reconnectAttempts > 0
            ? `Reconnecting... (${reconnectAttempts})`
            : 'Connecting...',
        color: 'warning.main',
      };
    return { text: `Online • ${unread} unread`, color: 'success.main' };
  };
  const status = selectedFriend
    ? getConnectionStatus()
    : { text: 'Online', color: 'success.main' };

  /* --------------------------------------------------------------------- */
  /*                         Threading Helpers                             */
  /* --------------------------------------------------------------------- */
  const organizeMessagesIntoThreads = (list) => {
    const threads = new Map();
    const roots = [];
    list.forEach((m) =>
      m.reply_to_id
        ? (threads.has(m.reply_to_id) || threads.set(m.reply_to_id, [])).get(m.reply_to_id).push(m)
        : roots.push(m)
    );
    const build = (m) => ({
      ...m,
      replies: (threads.get(m.id) || [])
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(build),
    });
    return roots.map(build).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  const flattenThreads = (threads, level = 0) => {
    let flat = [];
    threads.forEach((t) => {
      flat.push({ ...t, threadLevel: level, isThreadStart: level === 0 && t.replies.length > 0 });
      if (t.replies.length) flat = flat.concat(flattenThreads(t.replies, level + 1));
    });
    return flat;
  };
  const threadedMessages = flattenThreads(organizeMessagesIntoThreads(messages));

  /* --------------------------------------------------------------------- */
  /*                           Auto-Scroll Logic                           */
  /* --------------------------------------------------------------------- */
  const scrollToBottom = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    requestAnimationFrame(() => {
      const lastMsg = container.lastElementChild;
      if (lastMsg) {
        lastMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, []);

  // Trigger scroll on any change that can add/remove messages
  useEffect(() => {
    if (messages.length !== lastMessageCount.current) {
      lastMessageCount.current = messages.length;
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Also scroll when reply preview or pinned message changes
  useEffect(() => {
    scrollToBottom();
  }, [replyingTo, pinnedMessage, scrollToBottom]);

  // Scroll when a new friend is selected (first load)
  useEffect(() => {
    if (selectedFriend) scrollToBottom();
  }, [selectedFriend, scrollToBottom]);

  /* --------------------------------------------------------------------- */
/*                     Edit / Delete / Reply / Pin / Forward            */
/* --------------------------------------------------------------------- */
const handleEditMessage = async (messageId, newContent) => {
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return;

  const oldContent = msg.content;
  const oldUpdatedAt = msg.updated_at;

  // Optimistic UI update — show instantly
  setMessages((prev) =>
    prev.map((m) =>
      m.id === messageId
        ? { ...m, content: newContent, updated_at: new Date().toISOString() }
        : m
    )
  );

  // Block editing temp messages (still sending)
  if (String(messageId).startsWith("temp-")) {
    setError("Wait for message to send before editing");
    setTimeout(() => setError(null), 3000);

    // Revert optimistic change
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: oldContent, updated_at: oldUpdatedAt }
          : m
      )
    );
    return;
  }

  try {
    // Call API to edit real message
    const updated = await editMessage(messageId, newContent);

    // Sync with server response (exact values)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: updated.content, updated_at: updated.updated_at }
          : m
      )
    );

    setSuccess("Edited");
    setTimeout(() => setSuccess(null), 2000);
  } catch (err) {
    setError(err.message || "Failed to edit message");
    setTimeout(() => setError(null), 3000);

    // Revert on error
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: oldContent, updated_at: oldUpdatedAt }
          : m
      )
    );
  }
};


const handleDeleteMessage = async (messageId, isTemp = false) => {
  // Remove immediately from UI
  setMessages(prev => prev.filter(m => m.id !== messageId));
  
  if (pinnedMessage?.id === messageId) setPinnedMessage(null);
  if (replyingTo?.id === messageId) setReplyingTo(null);
  
  // Only call API for non-temp messages
  if (!isTemp) {
    try { 
      await deleteMessage(messageId); 
    } catch (err) { 
      console.error(err); 
      setError('Failed to delete message');
    }
  }
};

// ONLY CHANGE: Fixed Reply handler
const handleReply = (msg) => {
  console.log('🎯 REPLY: Setting reply target:', msg?.id, msg?.content);
  if (msg && msg.id) {
    setReplyingTo(msg);
    console.log('✅ REPLY: Target set successfully');
  } else {
    console.error('❌ REPLY: Invalid message received');
  }
};

const handlePinMessage = (msg) => setPinnedMessage(pinnedMessage?.id === msg.id ? null : msg);
const handleForward = (msg) => {
  setForwardingMessage(msg);
  setForwardDialogOpen(true);
};

  /* --------------------------------------------------------------------- */
  /*                         Seen Status Logic                            */
  /* --------------------------------------------------------------------- */
  // Find the last message from current user to determine if it's seen
  const lastMyMessage = messages
    .filter(msg => msg.sender_id === profile?.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  const lastMessageSeen = lastMyMessage?.is_read;

  /* --------------------------------------------------------------------- */
  /*                               Drawer UI                               */
  /* --------------------------------------------------------------------- */
  const FriendsListDrawer = () => (
    <Drawer
      variant="temporary"
      open={mobileDrawerOpen}
      onClose={() => setMobileDrawerOpen(false)}
      ModalProps={{ keepMounted: true }}
      sx={{
        display: { xs: 'block', sm: 'none' },
        '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box' },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          Friends
        </Typography>
        <List>
          {friends.map((friend) => (
            <ListItem
              key={friend.id}
              selected={selectedFriend?.id === friend.id}
              onClick={() => handleSelectFriend(friend)}
              sx={{
                borderRadius: '12px',
                mb: 1,
                px: 1.5,
                py: 1.5,
                '&:hover': { bgcolor: 'action.hover' },
                '&.Mui-selected': {
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  '& .MuiListItemText-secondary': { color: 'primary.contrastText' },
                },
              }}
            >
              <ListItemAvatar sx={{ minWidth: 44 }}>
                <Avatar src={getUserAvatar(friend)} sx={{ width: 44, height: 44 }}>
                  {getUserInitials(friend.username)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={<Typography fontWeight="500" sx={{ fontSize: '0.95rem' }}>{friend.username}</Typography>}
                secondary={<Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{friend.email}</Typography>}
              />
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main', ml: 1 }} />
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );

  /* --------------------------------------------------------------------- */
  /*                                 Render                                 */
  /* --------------------------------------------------------------------- */
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row', md: 'row' },
        height: { xs: 'calc(100vh - 120px)', sm: '75vh', md: 600 },
        borderRadius: { xs: '12px', sm: '16px', md: '8px' },
        margin: { xs: 1, sm: 2, md: 0 },
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)', md: '100%' },
        maxWidth: { sm: '900px', md: 'none' },
        mx: { sm: 'auto', md: 0 },
      }}
    >
      {/* Mobile Header */}
      {isMobile && selectedFriend && (
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
            <IconButton size="small" onClick={() => setMobileDrawerOpen(true)}>
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
          <IconButton size="small" onClick={() => setSelectedFriend(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <Box sx={{ display: 'flex', flex: 1, flexDirection: { xs: 'column', sm: 'row', md: 'row' } }}>
        {/* Sidebar – tablet & desktop */}
        {(!isMobile) && (
          <Box
            sx={{
              width: { sm: 280, md: 300 },
              borderRight: 1,
              borderColor: 'divider',
              overflow: 'auto',
              flexShrink: 0,
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{ p: 2, fontWeight: 600, fontSize: { sm: '1.1rem', md: '1.25rem' } }}
            >
              Friends
            </Typography>
            <List>
              {friends.map((friend) => (
                <ListItem
                  key={friend.id}
                  selected={selectedFriend?.id === friend.id}
                  onClick={() => handleSelectFriend(friend)}
                  sx={{
                    borderRadius: '12px',
                    mb: 1,
                    mx: 1,
                    px: { sm: 1.5, md: 2 },
                    py: { sm: 1.5, md: 1 },
                    '&:hover': { bgcolor: 'action.hover' },
                    '&.Mui-selected': {
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      '& .MuiListItemText-secondary': { color: 'primary.contrastText' },
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={getUserAvatar(friend)} sx={{ width: 40, height: 40 }}>
                      {getUserInitials(friend.username)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography fontWeight="500" sx={{ fontSize: { sm: '0.9rem', md: '1rem' } }}>{friend.username}</Typography>}
                    secondary={<Typography variant="body2" sx={{ fontSize: { sm: '0.8rem', md: '0.875rem' } }}>{friend.email}</Typography>}
                  />
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', ml: 1 }} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        <FriendsListDrawer />

        {/* Chat Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#f8f9fa',
            minHeight: 0,
            minWidth: { sm: 300, md: 400 },
          }}
        >
          {selectedFriend ? (
            <>
              {/* Tablet / Desktop Header */}
              {(!isMobile) && (
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
              )}

              {/* Pinned Message */}
              {pinnedMessage && (
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
                    <IconButton size="small" onClick={() => setPinnedMessage(null)} sx={{ p: { xs: 0.5, sm: 0.75, md: 1 }, ml: 1 }}>
                      <CloseIcon fontSize={isMobile ? 'small' : 'medium'} />
                    </IconButton>
                  </Box>
                </Card>
              )}

              {/* Messages */}
              <Box
                ref={messagesContainerRef}
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  px: { xs: 1.5, sm: 2, md: 2 },
                  py: { xs: 1, sm: 1.5, md: 2 },
                  bgcolor: '#f8f9fa',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: { xs: 0.5, sm: 0.75, md: 1 },
                }}
                onScroll={handleScroll}
              >
                {messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', mt: 4, p: 2 }}>
                    <ChatIcon sx={{ fontSize: { xs: 48, sm: 56, md: 64 }, color: 'grey.300', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}>
                      No messages yet
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
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
                        onUpdate={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onReply={handleReply}
                        onForward={handleForward}
                        onPin={handlePinMessage}
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

              {/* Reply Preview */}
              {replyingTo && (
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
                      onClick={() => setReplyingTo(null)}
                      sx={{ p: { xs: 0.5, sm: 0.75, md: 1 }, ml: 1 }}
                    >
                      <CloseIcon fontSize={isMobile ? 'small' : 'medium'} />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </>
          ) : (
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
                  onClick={() => setMobileDrawerOpen(true)}
                  sx={{ mt: 2, borderRadius: '20px', px: 3, py: 1, fontSize: '0.9rem' }}
                >
                  Open Friends List
                </Button>
              )}
            </Box>
          )}

          {/* Message Input */}
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
            <TextField
              fullWidth
              size="small"
              placeholder={
                !selectedFriend
                  ? 'Select a friend...'
                  : replyingTo
                  ? `Replying to ${replyingTo.sender_id === profile?.id ? 'you' : selectedFriend.username}...`
                  : 'Type a message...'
              }
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && selectedFriend) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              multiline
              maxRows={3}
              disabled={!selectedFriend}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '24px',
                  fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
                },
                bgcolor: '#f8f9fa',
              }}
            />
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!selectedFriend || !newMessage.trim()}
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
        </Box>
      </Box>

      <ForwardMessageDialog
        open={forwardDialogOpen}
        onClose={() => setForwardDialogOpen(false)}
        message={forwardingMessage}
        friends={friends.filter((f) => f.id !== selectedFriend?.id)}
        onForward={() => {}}
        getAvatarUrl={getAvatarUrl}
        getUserInitials={getUserInitials}
      />
    </Box>
  );
};

export default MessagesTab;