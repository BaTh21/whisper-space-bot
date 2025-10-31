import {
  ArrowBack as ArrowBackIcon,
  Send as SendIcon
} from '@mui/icons-material';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
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
import { getGroupMembers, getGroupMessage } from '../services/api';
import { formatCambodiaTime } from '../utils/dateUtils';

const GroupChatPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
      const [messagesData, membersData] = await Promise.all([
        getGroupMessage(groupId),
        getGroupMembers(groupId)
      ]);
      
      setMessages(messagesData);
      setMembers(membersData);
      
      // Find group info from members data or create basic object
      if (membersData.length > 0) {
        setGroup({
          id: groupId,
          name: `Group ${groupId}`,
          members: membersData
        });
      }
    } catch (error) {
      console.error('Failed to fetch group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    try {
      const wsUrl = `${BASE_URI.replace(/^http/, 'ws')}/ws/group/${groupId}?token=${token}`;
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
        console.log('WebSocket connection failed, using fallback polling',error);
        // Fallback to HTTP polling if WebSocket fails
        setupPolling();
      };
    } catch (error) {
      console.log('WebSocket setup failed, using fallback polling',error);
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
    <Layout>
      <Card sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => navigate('/dashboard')}
              sx={{ mr: 2 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              {group?.name?.charAt(0) || 'G'}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" fontWeight="600">
                {group?.name || 'Group Chat'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {members.length} members
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Messages */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'grey.50' }}>
          {messages.length === 0 ? (
            <Box 
              display="flex" 
              justifyContent="center" 
              alignItems="center" 
              height="100%"
              flexDirection="column"
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No messages yet
              </Typography>
              <Typography color="text.secondary">
                Start a conversation with the group
              </Typography>
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
                    mb: 2
                  }}
                >
                  <Box sx={{ maxWidth: '70%' }}>
                    {!isOwn && (
                      <Typography variant="caption" sx={{ fontWeight: 600, ml: 1 }}>
                        {message.sender?.username || 'Unknown User'}
                      </Typography>
                    )}
                    <Box
                      sx={{
                        bgcolor: isOwn ? 'primary.main' : 'white',
                        color: isOwn ? 'white' : 'text.primary',
                        p: 2,
                        borderRadius: 2,
                        boxShadow: 1
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
                        mx: 1
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

        {/* Message Input */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              multiline
              maxRows={3}
            />
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              sx={{ minWidth: '60px' }}
            >
              <SendIcon />
            </Button>
          </Box>
        </Box>
      </Card>
    </Layout>
  );
};

export default GroupChatPage;