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
  Menu, MenuItem,
  TextField,
  Toolbar,
  Typography
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GroupMenuDialog from '../components/dialogs/GroupMenuDialog';
import GroupSideComponent from '../components/group/GroupSideComponent';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getGroupMembers, getGroupMessage, getGroupById, updateMessageById, deleteMessageById, uploadFileMessage, editGroupFileMessage } from '../services/api';
import { formatCambodiaTime } from '../utils/dateUtils';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

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
  const BASE_URI = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('accessToken');
  const [open, setOpen] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const openMenu = (event, messageId) => {
    setAnchorEl(event.currentTarget);
    setActiveMessageId(messageId);
  };

  const closeMenu = () => {
    setAnchorEl(null);
    setActiveMessageId(null);
  };

  const handleSave = () => {
    onEdit(editingMessageId, editedContent);
    setEditingMessageId(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
  };

  const onEdit = async (messageId, content) => {
    try {
      await updateMessageById(messageId, { content });
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, content } : msg))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const onDelete = async (messageId) => {
    try {
      await deleteMessageById(messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (err) {
      console.error(err);
    }
  };


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
      const wsUrl = `${BASE_URI}/api/v1/ws/group/${groupId}?token=${token}`;
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

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadFileMessage = async (groupId, file) => {
    if (!file) return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      file_url: URL.createObjectURL(file),
      sender: user,
      created_at: new Date().toISOString(),
      is_temp: true,
      uploading: true,
      progress: 0,
    };

    // Add temporary message to chat
    setMessages((prev) => [...prev, tempMessage]);
    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadedMessage = await uploadFileMessage(groupId, file, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadProgress(percent);
          // Update temp message progress
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempId ? { ...msg, progress: percent } : msg
            )
          );
        }
      });

      // Replace temp message with the real one
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? uploadedMessage : msg))
      );
    } catch (error) {
      console.error("Upload error", error);
      // Mark temp message as failed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...msg, uploading: false, failed: true } : msg
        )
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setFile(null);
    }
  };

  const updateFileMessage = async (messageId, newFile) => {
    if (!newFile) return;

    const tempId = `updating-${Date.now()}`;
    const tempPreviewUrl = URL.createObjectURL(newFile);

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
            ...msg,
            temp_id: tempId,
            file_url: tempPreviewUrl,
            uploading: true,
            progress: 0,
            failed: false,
          }
          : msg
      )
    );
    setUploading(true);
    setUploadProgress(0);

    try {
      const updatedMessage = await editGroupFileMessage(messageId, newFile);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
              ...updatedMessage,
              uploading: false,
              progress: 100,
            }
            : msg
        )
      );
    } catch (error) {
      console.error("Update file error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, uploading: false, failed: true } : msg
        )
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
    <>
      <AppBar
        position="static"
        color="default"
        elevation={2}
        onClick={() => setOpen(true)}
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

          <Avatar
            sx={{ mr: 2, bgcolor: 'primary.main', width: 40, height: 40 }}
            src={
              group?.images?.length
                ? group.images.reduce((latest, img) =>
                  new Date(img.created_at) > new Date(latest.created_at) ? img : latest
                ).url
                : undefined
            }
          >
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
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
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
              messages
                .slice()
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                .map((message) => {
                  const isOwn = message.sender?.id === user?.id;
                  const isEditing = editingMessageId === message.id;

                  return (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end',
                        mb: 1,
                      }}
                    >
                      {!isOwn && (
                        <Avatar
                          src={message.sender?.avatar_url}
                          alt={message.sender?.username || 'User'}
                          sx={{ width: 32, height: 32, mr: 1 }}
                        >
                          {message.sender?.username?.charAt(0) || 'U'}
                        </Avatar>
                      )}

                      <Box sx={{ maxWidth: '70%', position: 'relative' }}>
                        {!isOwn && (
                          <Typography variant="caption" sx={{ fontWeight: 600, ml: 1 }}>
                            {message.sender?.username || 'Unknown User'}
                          </Typography>
                        )}

                        <Box>
                          {isEditing ? (
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', backgroundColor: 'primary.main', p: 1, borderRadius: 3 }}>
                              <TextField
                                fullWidth
                                size="small"
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                variant="outlined"
                                placeholder="Edit message..."
                                InputProps={{
                                  sx: {
                                    color: 'white',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'rgba(255,255,255,0.6)',
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'white',
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'white',
                                    },
                                  },
                                }}
                                InputLabelProps={{ sx: { color: 'white' } }}
                              />
                              <Button size="small" variant="contained" color="secondary" onClick={handleSave}>
                                Save
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={handleCancelEdit}
                                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: 'white' } }}
                              >
                                Cancel
                              </Button>
                            </Box>
                          ) : (
                            <>
                              {message.file_url && (
                                <Box
                                  sx={{
                                    position: 'relative',
                                    display: 'inline-block',
                                    width: '100%',
                                    maxWidth: 300,
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={message.file_url}
                                    alt="upload"
                                    sx={{
                                      width: '100%',
                                      opacity: message.uploading ? 0.6 : 1,
                                      filter: message.failed ? 'grayscale(100%)' : 'none',
                                    }}
                                  />
                                  {message.uploading && (
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        width: `${message.progress || 0}%`,
                                        height: 4,
                                        bgcolor: 'primary.main',
                                        transition: 'width 0.2s ease',
                                      }}
                                    />
                                  )}
                                  {message.failed && (
                                    <Typography
                                      variant="caption"
                                      color="error"
                                      sx={{
                                        position: 'absolute',
                                        bottom: 8,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        bgcolor: 'rgba(255,255,255,0.7)',
                                        px: 1,
                                        borderRadius: 1,
                                      }}
                                    >
                                      Upload failed
                                    </Typography>
                                  )}
                                </Box>
                              )}

                              {message.content && (
                                <Typography
                                  variant="body2"
                                  sx={{
                                    bgcolor: isOwn ? 'primary.main' : 'white',
                                    color: isOwn ? 'white' : 'text.primary',
                                    p: 2,
                                    borderRadius: 3,
                                    boxShadow: 1,
                                    wordBreak: 'break-word',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  {message.content}
                                </Typography>
                              )}

                            </>
                          )}
                        </Box>


                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', textAlign: isOwn ? 'right' : 'left', mt: 0.5, mx: 1 }}
                        >
                          {formatCambodiaTime(message.created_at)}
                          {message.is_temp && ' • Sending...'}
                        </Typography>
                      </Box>

                      {isOwn && (
                        <>
                          <IconButton
                            size="small"
                            onClick={(e) => openMenu(e, message.id)}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>

                          <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl) && activeMessageId === message.id}
                            onClose={closeMenu}
                          >
                            {message.file_url && (
                              <MenuItem
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = async (e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      await updateFileMessage(message.id, file);
                                    }
                                  };
                                  input.click();
                                  closeMenu();
                                }}
                              >
                                <PhotoCameraIcon fontSize="small" sx={{ mr: 1 }} /> Replace Image
                              </MenuItem>
                            )}

                            {message.content && (
                              <MenuItem
                                onClick={() => {
                                  setEditedContent(message.content);
                                  setEditingMessageId(message.id);
                                  closeMenu();
                                }}
                              >
                                <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit Message
                              </MenuItem>
                            )}

                            <MenuItem
                              onClick={() => {
                                onDelete(message.id);
                                closeMenu();
                              }}
                            >
                              <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
                            </MenuItem>
                          </Menu>


                        </>
                      )}
                    </Box>
                  );
                })
            )}

            <div ref={messagesEndRef} />
          </Box>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'white' }}>
            {file && (
              <Typography variant="caption" sx={{ mt: 1 }}>
                Selected file: {file.name}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>

              <input
                type="file"
                accept="image/*"
                id="file-upload"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload">
                <IconButton sx={{ bgcolor: 'grey', color: 'white' }} component="span">
                  <AttachFileIcon />
                </IconButton>
              </label>

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
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                }}
              />

              <Button
                variant="contained"
                onClick={() => {
                  if (file) {
                    handleUploadFileMessage(groupId, file);
                  }
                  if (newMessage.trim()) {
                    handleSendMessage();
                  }
                }}
                disabled={!newMessage.trim() && !file}
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