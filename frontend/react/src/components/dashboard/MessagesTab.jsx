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
  useTheme,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useAvatar } from '../../hooks/useAvatar';
import {
  deleteMessage,
  editMessage,
  getPrivateChat,
  markMessagesAsRead,
  sendPrivateMessage,
} from '../../services/api';
import ChatMessage from '../chat/ChatMessage';
import ForwardMessageDialog from '../chat/ForwardMessageDialog';

const BASE_URI = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

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
  const [isWsConnected, setIsWsConnected] = useState(false);

  const messagesContainerRef = useRef(null);
  const lastSeenCheckRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { getAvatarUrl, getUserInitials, getUserAvatar } = useAvatar();

  // === WebSocket Setup ===
  useEffect(() => {
    if (!selectedFriend) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsWsConnected(false);
      return;
    }

    const rawToken = localStorage.getItem('accessToken') || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
    const wsUrl = `${BASE_URI}/api/v1/ws/private/${selectedFriend.id}?token=${token}`;

    const connectWebSocket = () => {
      try {
        console.log('[WS] Connecting to:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WS] Connected');
          setIsWsConnected(true);
          setError(null);
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          if (messages.length === 0) {
            loadInitialMessages();
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (err) {
            console.error('[WS] Parse error:', err);
          }
        };

        ws.onclose = (event) => {
          console.log('[WS] Disconnected:', event.reason || 'Unknown');
          setIsWsConnected(false);
          wsRef.current = null;

          if (!reconnectTimeoutRef.current && selectedFriend) {
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null;
              connectWebSocket();
            }, 3000);
          }
        };

        ws.onerror = () => {
          console.error('[WS] Error');
          setError('Chat connection failed');
        };
      } catch (err) {
        console.error('[WS] Setup failed:', err);
        setError('WebSocket failed');
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedFriend?.id]);

  // === Send via WebSocket ===
  const sendWsMessage = (msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(msg));
        return true;
      } catch (err) {
        console.error('[WS] Send failed:', err);
        return false;
      }
    }
    return false;
  };

  // === Handle Incoming ===
  const handleWebSocketMessage = (data) => {
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
              sender_username:
                data.reply_to.sender_id === profile?.id
                  ? profile.username
                  : selectedFriend.username,
            }
          : null,
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingMsg.id)) return prev;
        return [...prev, incomingMsg].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
      });

      if (data.sender_id === selectedFriend.id && !data.is_read) {
        handleMarkAsRead([data.id]);
      }
    } else if (type === 'read_receipt') {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.message_id
            ? { ...msg, is_read: true, read_at: data.read_at }
            : msg
        )
      );
    }
  };

  // === Load Initial Messages (ONLY ONCE) ===
  const loadInitialMessages = async () => {
    if (!selectedFriend || messages.length > 0) return;
    setIsLoadingMessages(true);
    try {
      const chatMessages = await getPrivateChat(selectedFriend.id);
      const enhanced = chatMessages.map((msg) => ({
        ...msg,
        is_temp: false,
        sender: {
          id: msg.sender_id,
          username: msg.sender_username || (msg.sender_id === profile?.id ? profile.username : selectedFriend.username),
          avatar_url: getUserAvatar(msg.sender_id === profile?.id ? profile : selectedFriend),
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

      setMessages(enhanced.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));

      const unread = enhanced
        .filter((m) => !m.is_read && m.sender_id === selectedFriend.id)
        .map((m) => m.id);
      if (unread.length > 0) handleMarkAsRead(unread);
    } catch (err) {
      setError('Failed to load messages',err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // === Mark as Read ===
  const handleMarkAsRead = async (ids) => {
    if (!ids.length) return;
    setMessages((prev) =>
      prev.map((m) => (ids.includes(m.id) ? { ...m, is_read: true, read_at: new Date().toISOString() } : m))
    );
    try {
      await markMessagesAsRead(ids);
      ids.forEach(id => sendWsMessage({ type: 'read', message_id: id }));
    } catch (err) {
      console.error(err);
    }
  };

  // === Auto Mark Read ===
  useEffect(() => {
    if (!selectedFriend || !messages.length) return;
    const now = Date.now();
    if (lastSeenCheckRef.current && now - lastSeenCheckRef.current < 2000) return;
    lastSeenCheckRef.current = now;

    const unread = messages
      .filter(m => !m.is_read && m.sender_id === selectedFriend.id && !m.is_temp)
      .map(m => m.id);
    if (unread.length) handleMarkAsRead(unread);
  }, [messages, selectedFriend]);

  // === Friend Select ===
  const handleSelectFriend = (friend) => {
    if (isMobile) setMobileDrawerOpen(false);
    setSelectedFriend(friend);
    clearChatState();
  };

  const clearChatState = () => {
    setMessages([]);
    setReplyingTo(null);
    setPinnedMessage(null);
    setNewMessage('');
  };

  // === Send Message ===
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
      reply_to_id: replyingTo?.id || null,
      sender: { username: profile.username, avatar_url: getUserAvatar(profile), id: profile.id },
    };

    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');
    setReplyingTo(null);
    setMessageLoading(true);

    const payload = { type: "message", content, message_type: "text", reply_to_id: replyingTo?.id || null };

    if (sendWsMessage(payload)) {
      setMessageLoading(false);
      return;
    }

    try {
      const sent = await sendPrivateMessage(selectedFriend.id, payload);
      setMessages(prev =>
        prev.filter(m => m.id !== tempId).concat({
          ...sent,
          is_temp: false,
          sender: { username: profile.username, avatar_url: getUserAvatar(profile), id: profile.id },
        })
      );
    } catch (err) {
      setError(err.message);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(content);
    } finally {
      setMessageLoading(false);
    }
  };

  // === Threading ===
  const organizeMessagesIntoThreads = (list) => {
    const threads = new Map();
    const roots = [];
    list.forEach(m => m.reply_to_id ? (threads.has(m.reply_to_id) || threads.set(m.reply_to_id, [])).get(m.reply_to_id).push(m) : roots.push(m));
    const build = (m) => ({
      ...m,
      replies: (threads.get(m.id) || []).sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).map(build)
    });
    return roots.map(build).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  };

  const flattenThreads = (threads, level = 0) => {
    let flat = [];
    threads.forEach(t => {
      flat.push({ ...t, threadLevel: level, isThreadStart: level === 0 && t.replies.length > 0 });
      if (t.replies.length) flat = flat.concat(flattenThreads(t.replies, level + 1));
    });
    return flat;
  };

  const threadedMessages = flattenThreads(organizeMessagesIntoThreads(messages));

  // === AUTO SCROLL ===
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, selectedFriend, replyingTo, pinnedMessage]);

  // === Status ===
  const getConnectionStatus = () => {
    const unread = messages.filter(m => !m.is_read && m.sender_id === selectedFriend?.id).length;
    return {
      text: isWsConnected ? `Online • ${unread} unread` : 'Connecting...',
      color: isWsConnected ? 'success.main' : 'warning.main'
    };
  };
  const status = selectedFriend ? getConnectionStatus() : { text: 'Online', color: 'success.main' };

  // === Edit / Delete / Reply / Pin / Forward ===
  const handleEditMessage = async (messageId, newContent) => {
    try {
      const updated = await editMessage(messageId, newContent);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: updated.content } : m));
      setSuccess('Message updated');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to edit',err);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (pinnedMessage?.id === messageId) setPinnedMessage(null);
    if (replyingTo?.id === messageId) setReplyingTo(null);
    setMessages(prev => prev.filter(m => m.id !== messageId));
    try { await deleteMessage(messageId); } catch (err) { console.error(err); }
  };

  const handleReply = (msg) => setReplyingTo(msg);
  const handlePinMessage = (msg) => setPinnedMessage(pinnedMessage?.id === msg.id ? null : msg);
  const handleForward = (msg) => { setForwardingMessage(msg); setForwardDialogOpen(true); };

  // === Drawer ===
  const FriendsListDrawer = () => (
    <Drawer
      variant="temporary"
      open={mobileDrawerOpen}
      onClose={() => setMobileDrawerOpen(false)}
      ModalProps={{ keepMounted: true }}
      sx={{
        display: { xs: 'block', md: 'none' },
        '& .MuiDrawer-paper': { width: 300, boxSizing: 'border-box', pr: 2 },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Friends {isLoadingMessages && <CircularProgress size={16} sx={{ ml: 1 }} />}
        </Typography>
        <List>
          {friends.map((friend) => (
            <ListItem
              key={friend.id}
              selected={selectedFriend?.id === friend.id}
              onClick={() => handleSelectFriend(friend)}
              disabled={isLoadingMessages}
              sx={{
                borderRadius: '12px',
                mb: 1,
                '&:hover': { bgcolor: 'action.hover' },
                '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.contrastText' },
              }}
            >
              <ListItemAvatar>
                <Avatar src={getUserAvatar(friend)} sx={{ width: 40, height: 40 }}>
                  {getUserInitials(friend.username)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={<Typography fontWeight="500">{friend.username}</Typography>}
                secondary={friend.email}
              />
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', ml: 1 }} />
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        height: { xs: 'calc(100vh - 200px)', sm: 600 },
        borderRadius: '8px',
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Mobile Header */}
      {isMobile && selectedFriend && (
        <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => setMobileDrawerOpen(true)}><MenuIcon /></IconButton>
          <Avatar src={getUserAvatar(selectedFriend)} sx={{ width: 36, height: 36 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body1" fontWeight="600">{selectedFriend.username}</Typography>
            <Typography variant="caption" color="text.secondary">{status.text}</Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', flex: 1, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Box sx={{ width: 300, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ p: 2, fontWeight: 600 }}>
              Friends {isLoadingMessages && <CircularProgress size={16} sx={{ ml: 1 }} />}
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
                    '&:hover': { bgcolor: 'action.hover' },
                    '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.contrastText' },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={getUserAvatar(friend)} sx={{ width: 40, height: 40 }}>
                      {getUserInitials(friend.username)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography fontWeight="500">{friend.username}</Typography>}
                    secondary={friend.email}
                  />
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', ml: 1 }} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        <FriendsListDrawer />

        {/* Chat Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
          {selectedFriend ? (
            <>
              {/* Desktop Header */}
              {!isMobile && (
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'white', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar src={getUserAvatar(selectedFriend)} sx={{ width: 44, height: 44 }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight="600">{selectedFriend.username}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isLoadingMessages ? 'Connecting...' : status.text}
                    </Typography>
                  </Box>
                  <Chip label={status.text} size="small" sx={{ bgcolor: status.color, color: 'white' }} />
                </Box>
              )}

              {/* Pinned Message */}
              {pinnedMessage && (
                <Card sx={{ m: 2, mb: 1, p: 2, bgcolor: 'warning.light', border: '2px solid', borderColor: 'warning.main', borderRadius: '12px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PushPinIcon sx={{ mr: 1, color: 'warning.dark', transform: 'rotate(45deg)' }} />
                        <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 600 }}>Pinned</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Avatar src={getUserAvatar(pinnedMessage.sender_id === profile?.id ? profile : selectedFriend)} sx={{ width: 24, height: 24, mr: 1 }} />
                        <Typography variant="body2" fontWeight="500">
                          {pinnedMessage.sender_id === profile?.id ? 'You' : selectedFriend.username}
                        </Typography>
                      </Box>
                      <Typography variant="body2">{pinnedMessage.content}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setPinnedMessage(null)}><CloseIcon /></IconButton>
                  </Box>
                </Card>
              )}

              {/* Messages */}
              <Box
                ref={messagesContainerRef}
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  p: 2,
                  bgcolor: '#f8f9fa',
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1
                }}
              >
                {isLoadingMessages ? (
                  <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <CircularProgress />
                  </Box>
                ) : messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <ChatIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">No messages yet</Typography>
                    <Typography color="text.secondary">Say hello to {selectedFriend.username}!</Typography>
                  </Box>
                ) : (
                  threadedMessages.map((message, i) => {
                    const isLast = i === threadedMessages.length - 1;
                    const isMyLast = isLast && message.sender_id === profile?.id;
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
                        showSeenStatus={isMyLast && message.is_read}
                      />
                    );
                  })
                )}
              </Box>

              {/* Reply Preview */}
              {replyingTo && (
                <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'primary.light' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <ReplyIcon sx={{ mr: 1, color: 'primary.dark' }} fontSize="small" />
                        <Typography variant="caption" sx={{ color: 'primary.dark', fontWeight: 600 }}>Replying</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'primary.contrastText', fontSize: '0.8rem' }}>
                        {replyingTo.content}
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setReplyingTo(null)}><CloseIcon /></IconButton>
                  </Box>
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2 }}>
              <ChatIcon sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {isMobile ? 'Select a friend' : 'Choose a friend to start chatting'}
              </Typography>
              {isMobile && (
                <Button variant="contained" onClick={() => setMobileDrawerOpen(true)} sx={{ mt: 2 }}>
                  Open Friends
                </Button>
              )}
            </Box>
          )}

          {/* PERMANENT INPUT BOX - Always visible but conditionally disabled */}
          <Box
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'white',
              display: 'flex',
              gap: 1,
              alignItems: 'flex-end',
              flexShrink: 0
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder={
                !selectedFriend 
                  ? 'Select a friend to start chatting...' 
                  : replyingTo 
                    ? `Replying to ${replyingTo.sender_id === profile?.id ? 'you' : selectedFriend.username}...` 
                    : 'Type a message...'
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && selectedFriend) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              multiline
              maxRows={3}
              disabled={!selectedFriend || messageLoading}
              sx={{ 
                '& .MuiOutlinedInput-root': { borderRadius: '24px' }, 
                bgcolor: '#f8f9fa',
                '& .Mui-disabled': {
                  bgcolor: '#f5f5f5',
                  cursor: 'not-allowed'
                }
              }}
              autoFocus={!!replyingTo}
            />
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={!selectedFriend || !newMessage.trim() || messageLoading}
              sx={{ 
                borderRadius: '50%', 
                minWidth: 48, 
                height: 48,
                '&.Mui-disabled': {
                  bgcolor: 'grey.300',
                  cursor: 'not-allowed'
                }
              }}
            >
              {messageLoading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            </Button>
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