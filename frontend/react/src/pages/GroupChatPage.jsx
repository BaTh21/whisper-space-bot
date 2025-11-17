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
import ImageDialog from '../components/dialogs/ImageDialog';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import ReplyIcon from '@mui/icons-material/Reply';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';

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
  const [openImage, setOpenImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const activeMessage = messages.find((m) => m.id === activeMessageId);
  const [replyTo, setReplyTo] = useState(null);

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

        if (message.sender?.id === user?.id && message.reply_to_message) {
          setReplyTo(null);
        }
        
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
      reply_to: replyTo ? replyTo?.id : null
    };

    // Add temporary message
    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender: user,
      content: newMessage,
      created_at: new Date().toISOString(),
      is_temp: true,

      reply_to_message: replyTo || null
    };
    setMessages(prev => [...prev, tempMessage]);

    wsRef.current.send(JSON.stringify(messageData));
    setNewMessage('');
    setReplyTo(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReply = (message) => {
    setReplyTo(message);
    closeMenu();
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

    try {
      const uploadedMessage = await uploadFileMessage(groupId, file, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
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
            // ml: 3,
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
                              {message.reply_to_message && (
                                <Box
                                  sx={{
                                    bgcolor: "#f0f0f0",
                                    p: 1,
                                    borderLeft: "3px solid #1976d2",
                                    borderRadius: 1,
                                    mb: 1,
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    {message.reply_to_message.sender?.username}
                                  </Typography>

                                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                    {message.reply_to_message.content}
                                  </Typography>
                                </Box>
                              )}

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
                                    onClick={(e) => openMenu(e, message.id)}
                                    alt="upload"
                                    sx={{
                                      width: '100%',
                                      opacity: message.uploading ? 0.6 : 1,
                                      filter: message.failed ? 'grayscale(100%)' : 'none',
                                    }}
                                  />
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
                                  onClick={(e) => openMenu(e, message.id)}
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

                      {isOwn ? (
                        <>

                          <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl) && activeMessage?.sender?.id === user?.id}
                            onClose={closeMenu}
                          >
                            {/* TEXT options */}
                            {activeMessage && activeMessage.sender?.id === user?.id && !activeMessage.file_url && [
                              <MenuItem
                                key="edit"
                                onClick={() => {
                                  setEditingMessageId(activeMessage.id);
                                  setEditedContent(activeMessage.content);
                                  closeMenu();
                                }}
                              >
                                <EditIcon /> Edit
                              </MenuItem>,

                              <MenuItem
                                key="delete"
                                onClick={() => {
                                  onDelete(activeMessage.id);
                                  closeMenu();
                                }}
                              >
                                <DeleteIcon /> Delete
                              </MenuItem>,
                            ]}

                            {/* IMAGE options */}
                            {activeMessage && activeMessage.sender?.id === user?.id && activeMessage.file_url && [
                              <MenuItem
                                key="view-img"
                                onClick={() => {
                                  setSelectedImage(activeMessage.file_url);
                                  setOpenImage(true);
                                  closeMenu();
                                }}
                              >
                                <RemoveRedEyeIcon /> View Image
                              </MenuItem>,

                              <MenuItem
                                key="save-img"
                                onClick={async () => {
                                  const response = await fetch(activeMessage.file_url);
                                  const blob = await response.blob();
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = activeMessage.file_url.split("/").pop();
                                  a.click();
                                  URL.revokeObjectURL(url);
                                  closeMenu();
                                }}
                              >
                                <SaveAltIcon /> Save Image
                              </MenuItem>,

                              <MenuItem
                                key="replace-img"
                                onClick={() => {
                                  const input = document.createElement("input");
                                  input.type = "file";
                                  input.accept = "image/*";
                                  input.onchange = (e) => {
                                    if (e.target.files[0]) updateFileMessage(activeMessage.id, e.target.files[0]);
                                  };
                                  input.click();
                                  closeMenu();
                                }}
                              >
                                <PhotoCameraIcon /> Replace Image
                              </MenuItem>,

                              <MenuItem
                                key="delete-img"
                                onClick={() => {
                                  onDelete(activeMessage.id);
                                  closeMenu();
                                }}
                              >
                                <DeleteIcon /> Delete Image
                              </MenuItem>,
                            ]}
                          </Menu>
                        </>

                      ) : (
                        /* === MENU FOR OTHER USERS' MESSAGES === */
                        <>

                          <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl) && activeMessage?.sender?.id !== user?.id}
                            onClose={closeMenu}
                            sx={{ backgroundColor: 'transparent' }}
                          >
                            {activeMessage && activeMessage.sender?.id !== user?.id && activeMessage.file_url && [
                              <MenuItem
                                key="view-img"
                                onClick={() => {
                                  setSelectedImage(activeMessage.file_url);
                                  setOpenImage(true);
                                  closeMenu();
                                }}
                              >
                                <RemoveRedEyeIcon /> View Image
                              </MenuItem>,

                              <MenuItem
                                key="save-img"
                                onClick={async () => {
                                  const response = await fetch(activeMessage.file_url);
                                  const blob = await response.blob();
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = activeMessage.file_url.split("/").pop();
                                  a.click();
                                  URL.revokeObjectURL(url);
                                  closeMenu();
                                }}
                              >
                                <SaveAltIcon /> Save Image
                              </MenuItem>,
                            ]}

                            <MenuItem
                              key="reply"
                              onClick={() => {
                                setReplyTo(activeMessage);
                                // closeMenu();
                              }}
                            >
                              <ReplyIcon /> Reply
                            </MenuItem>

                            <MenuItem
                              key="forward"
                              onClick={() => {
                                setForwardMessage(activeMessage);
                                closeMenu();
                              }}
                            >
                              <ShortcutIcon /> Forward
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


              <Box
                sx={{
                  width: '100%'
                }}
              >
                {replyTo && (
                  <Box
                    sx={{
                      p: 1,
                      mb: 1,
                      bgcolor: "grey.200",
                      borderRadius: 2,
                      borderLeft: "4px solid #1976d2",
                      display: 'flex',
                      justifyContent: 'space-between',
                      alightItems: 'center'
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: "bold" }}>
                        Replying to {replyTo.sender?.username}
                      </Typography>

                      <Typography variant="body2" noWrap>
                        {replyTo.content}
                      </Typography>
                    </Box>

                    <Button
                      size="small"
                      onClick={() => setReplyTo(null)}
                      sx={{ textTransform: "none" }}
                    >
                      Cancel reply
                    </Button>
                  </Box>
                )}

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    id="file-upload"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <label htmlFor="file-upload">
                    <IconButton
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        borderRadius: 2,
                        '&:hover': {
                          bgcolor: '#1E90FF'
                        }
                      }}
                      component="span">
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
                    sx={{ minWidth: 30, borderRadius: 2, py: 1, px: 1.5 }}
                  >
                    <SendIcon />
                  </Button>
                </Box>
              </Box>

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

      <ImageDialog
        open={openImage}
        onClose={() => setOpenImage(false)}
        imgUrl={selectedImage}
      />
    </>

  );
};

export default GroupChatPage;