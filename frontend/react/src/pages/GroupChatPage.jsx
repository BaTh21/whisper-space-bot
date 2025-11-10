import {
  ArrowBack as ArrowBackIcon,
  Send as SendIcon
} from '@mui/icons-material';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Toolbar,
  Typography
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getGroupMembers, getGroupMessage, getGroupById } from '../services/api';
import { formatCambodiaTime } from '../utils/dateUtils';
import GroupSideComponent from '../components/group/GroupSideComponent';
import GroupMenuDialog from '../components/dialogs/GroupMenuDialog';

const GroupChatPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const user = auth?.user;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const BASE_URI = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const token = localStorage.getItem('accessToken');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchGroupData();
    setupWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchGroupData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        getGroupMessage(groupId),
        getGroupMembers(groupId),
        getGroupById(groupId)
      ]);

      const messagesData = results[0].status === 'fulfilled' ? results[0].value : [];
      const membersData = results[1].status === 'fulfilled' ? results[1].value : [];
      const groupData = results[2].status === 'fulfilled' ? results[2].value : { id: groupId, name: `Group ${groupId}` };

      setMessages(messagesData);
      setMembers(membersData);
      setGroup({
        ...groupData,
        members: membersData
      });

    } catch (error) {
      console.error('Failed to fetch group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    try {
      const wsUrl = `${BASE_URI.replace(/^http/, 'ws')}/api/v1/ws/ws/group/${groupId}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to group chat');
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        setMessages(prev => [...prev, message]);
      };

      ws.onclose = (event) => {
        console.log('Disconnected from group chat:', event.reason);
      };

      ws.onerror = (error) => {
        console.log('WebSocket connection failed, using fallback polling', error);
        // Fallback to HTTP polling if WebSocket fails
        setupPolling();
      };
    } catch (error) {
      console.log('WebSocket setup failed, using fallback polling', error);
      setupPolling();
    }
  };

  // Add polling fallback
  const setupPolling = () => {
    const pollMessages = async () => {
      try {
        const messagesData = await getGroupMessage(groupId);
        setMessages(messagesData);
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Poll immediately and every 5 seconds
    pollMessages();
    const pollInterval = setInterval(pollMessages, 5000);

    // Store interval for cleanup
    pollingIntervalRef.current = pollInterval;
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !wsRef.current) return;

    const messageData = {
      type: 'message',
      content: newMessage,
    };

    // Add temporary message
    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender: user,
      content: newMessage,
      created_at: new Date().toISOString(),
      is_temp: true
    };
    setMessages(prev => [...prev, tempMessage]);

    // Send via WebSocket
    wsRef.current.send(JSON.stringify(messageData));
    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuccess = () => {
    fetchGroupData();
  }

  if (loading) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <>
      <AppBar
        position="static" color="default" elevation={2} onClick={() => setOpen(true)}
        sx={{
          '&:hover': { bgcolor: 'grey.200' },
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/dashboard')}
            sx={{
              mr: 2,
              '&:hover': { bgcolor: 'grey.200' },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 40, height: 40 }}>
            {group?.name?.charAt(0) || 'G'}
          </Avatar>
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <Typography variant="h6" fontWeight={600} noWrap>
              {group?.name || 'Group Chat'}
            </Typography>

            <Typography variant="caption" color="text.secondary" noWrap>
              {members.length} members
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        <GroupSideComponent />

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            ml: 3,
            overflow: 'hidden',
            borderLeft: '1px solid #dcdcdcff'
          }}
        >
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              // Hide scrollbar
              '&::-webkit-scrollbar': {
                display: 'none', // Chrome, Safari, Edge
              },
              scrollbarWidth: 'none', // Firefox
            }}
          >
            {messages.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  flexDirection: 'column',
                  color: 'text.secondary',
                }}
              >
                <Typography variant="h6" gutterBottom>
                  No messages yet
                </Typography>
                <Typography>Start a conversation with the group</Typography>
              </Box>
            ) : (
              messages.map((message) => {
                const isOwn = message.sender?.id === user?.id;

                return (
                  <Box
                    key={message.id}
                    sx={{
                      display: 'flex',
                      justifyContent: isOwn ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Box sx={{ maxWidth: '70%' }}>
                      {!isOwn && (
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 600, ml: 1 }}
                        >
                          {message.sender?.username || 'Unknown User'}
                        </Typography>
                      )}
                      <Box
                        sx={{
                          bgcolor: isOwn ? 'primary.main' : 'white',
                          color: isOwn ? 'white' : 'text.primary',
                          p: 2,
                          borderRadius: 3,
                          boxShadow: 1,
                          wordBreak: 'break-word',
                          transition: 'all 0.2s',
                          '&:hover': {
                            boxShadow: 3,
                          },
                        }}
                      >
                        <Typography variant="body2">{message.content}</Typography>
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          textAlign: isOwn ? 'right' : 'left',
                          mt: 0.5,
                          mx: 1,
                        }}
                      >
                        {formatCambodiaTime(message.created_at)}
                        {message.is_temp && ' • Sending...'}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </Box>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'white' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                multiline
                maxRows={4}
                sx={{
                  bgcolor: 'grey.100',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': {
                    border: 'none',
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                sx={{ minWidth: 60, borderRadius: 2 }}
              >
                <SendIcon />
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
      <GroupMenuDialog
        open={open}
        onClose={() => setOpen(false)}
        group={group}
        onSuccess={handleSuccess}
      />
    </>

  );
};

export default GroupChatPage;