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
  Typography,
  Drawer
} from '@mui/material';
import { useEffect, useRef, useState, useCallback } from 'react';
import GroupMenuDialog from '../components/dialogs/GroupMenuDialog';
import GroupSideComponent from '../components/group/GroupSideComponent';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getGroupMembers, getGroupMessage, getGroupById, uploadFileMessage, editGroupFileMessage } from '../services/api';
import { formatCambodiaTime } from '../utils/dateUtils';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import ImageDialog from '../components/dialogs/ImageDialog';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import ReplyIcon from '@mui/icons-material/Reply';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SeenMessageListDialog from '../components/dialogs/SeenMessageListDialog';
import GroupListComponent from '../components/chat/GroupListComponent';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import CallIcon from '@mui/icons-material/Call';
import VideocamIcon from '@mui/icons-material/Videocam';

const GroupChatPage = ({ groupId }) => {

  const { auth } = useAuth();
  const user = auth?.user;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const WS_BASE_URI = import.meta.env.VITE_WS_URL;
  const token = localStorage.getItem('accessToken');
  const [open, setOpen] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [secondAnchorEl, setSecondAnchorEl] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [file, setFile] = useState(null);
  const [openImage, setOpenImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const activeMessage = messages.find((m) => m.id === activeMessageId);
  const [replyTo, setReplyTo] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [seenMessages, setSeenMessages] = useState(new Set());
  const messagesContainerRef = useRef(null);
  const [openSeenMessage, setOpenSeenMessage] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const messagesRef = useRef([]);
  const [openListMember, setOpenListMember] = useState(false);
  const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const toggleListMember = () => {
    console.log("toggle open")
    setOpenListMember(prev => !prev);
  }

  const toggleDrawer = () => {
    setOpenDrawer(prev => !prev);
  };

  const DrawerBox = (
    <Box
      sx={{
        width: 350
      }}
      role="presentation"
    >
      <GroupListComponent
        onClose={() => setOpenDrawer(false)}
        message={selectedMessage}
        onForward={(msg, groupIds) => {
          handleForwardMessage(msg, groupIds);
          setOpenDrawer(false);
        }}
      />
    </Box>
  )

  const sendSeenEvent = (messageId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: "seen",
          message_id: messageId,
        })
      );
    }
  };

  const handleForwardMessage = (message, targetGroupIds) => {
    if (!wsRef.current || !targetGroupIds?.length) return;

    const forwardPayload = {
      action: 'forward_to_groups',
      message_id: message.id,
      group_ids: targetGroupIds
    };

    wsRef.current.send(JSON.stringify(forwardPayload));
  };


  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollButton(scrollTop + clientHeight < scrollHeight - 50);
  };

  const scrollToBottom = () => {
    const container = messagesEndRef.current;
    if (container) {
      const scrollContainer = container.parentElement;

      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const autoScrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    const handle = requestAnimationFrame(() => autoScrollToBottom());
    return () => cancelAnimationFrame(handle);
  }, [messages]);


  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const openSecondMenu = (event, messageId) => {
    setSecondAnchorEl(event.currentTarget);
    setActiveMessageId(messageId);
  };

  const closeSecondMenu = () => {
    setSecondAnchorEl(null);
    setActiveMessageId(null);
  };

  const handleSave = () => {
    onEdit(editingMessageId, editedContent);
    setEditingMessageId(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
  };

  const onEdit = (messageId, content) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const editPayload = {
      action: "edit",
      message_id: messageId,
      new_content: content,
    };

    wsRef.current.send(JSON.stringify(editPayload));
    setEditingMessageId(null);
  };

  const onDelete = async (message) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const payload = {
      action: "delete",
      message_id: message.id
    };

    try {
      wsRef.current.send(JSON.stringify(payload));

      setMessages(prev => prev.filter(msg => msg.id !== message.id));
    } catch (err) {
      console.error("Failed to send delete via WS:", err);
    }
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const onScroll = () => markVisibleMessagesAsSeen();
    container.addEventListener("scroll", onScroll);

    markVisibleMessagesAsSeen();

    return () => container.removeEventListener("scroll", onScroll);
  }, [messages, seenMessages]);

  useEffect(() => {
    fetchGroupData();
    setupWebSocket();

    return () => {
      wsRef.current?.close();
    };
  }, [groupId]);

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

      messagesData.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

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

  const markVisibleMessagesAsSeen = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.querySelectorAll("[data-message-id]").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
        const id = Number(el.dataset.messageId);
        setMessages(prev => {
          const msg = prev.find(m => m.id === id);
          if (msg && msg.sender?.id !== user?.id && !seenMessages.has(id)) {
            setSeenMessages(prevSet => new Set(prevSet).add(id));
            sendSeenEvent(id);
          }
          return prev;
        });
      }
    });
  }, [seenMessages, user]);

  const handleWSMessage = (event, groupId) => {
    const data = JSON.parse(event.data);
    data.group_id = groupId;
    console.log('WS received:', data);

    switch (data.action) {
      case "seen":
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id !== data.message_id) return msg;

            const seenBy = new Set(msg.seen_by || []);
            seenBy.add(data.user_id);

            return { ...msg, seen_by: Array.from(seenBy) };
          })
        );
        break;

      case "edit":
        setMessages(prev =>
          prev.map(msg =>
            msg.id === data.message_id
              ? { ...msg, content: data.new_content, updated_at: data.updated_at }
              : msg
          )
        );
        break;

      case "delete":
        setMessages(prev => prev.filter(msg => msg.id !== data.message_id));
        break;

      case "file_upload":
        setMessages(prev => {
          const updated = [...prev];

          if (data.temp_id) {
            const tempIndex = updated.findIndex(msg => msg.id === data.temp_id);
            if (tempIndex !== -1) {
              updated[tempIndex] = {
                ...updated[tempIndex],
                id: data.id,
                file_url: data.file_url,
                created_at: data.created_at,
                is_temp: false,
                uploading: false,
                progress: 100
              };
              return updated;
            }
          }

          if (updated.some(msg => msg.id === data.id)) {
            return updated;
          }

          updated.push({
            ...data,
            is_temp: false,
            uploading: false,
            progress: 100
          });

          return updated;
        });
        break;

      case "file_update":
        setMessages(prev =>
          prev.map(msg =>
            msg.id === data.message_id
              ? { ...msg, file_url: data.file_url, updated_at: data.updated_at, uploading: false, progress: 100 }
              : msg
          )
        );
        break;

      case "new_message":
        setMessages(prev => {
          const updated = [...prev];

          if (data.temp_id) {
            const idx = updated.findIndex(msg => msg.id === data.temp_id);
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                ...data,
                is_temp: false
              };
              return updated;
            }
          }
          if (!updated.some(msg => msg.id === data.id)) {
            updated.push(data);
          }

          return updated;
        });
        break;

      case "forwarded":
        console.log(`Message ${data.message_id} forwarded to groups:`, data.forwarded_to);
        break;

      default:
        setMessages((prev) => {
          const updated = [...prev];

          if (data.temp_id) {
            const tempIndex = updated.findIndex(msg => msg.id === data.temp_id);
            if (tempIndex !== -1) {
              updated[tempIndex] = { ...updated[tempIndex], ...data, is_temp: false };
              return updated;
            }
          }

          if (updated.some(msg => msg.id === data.id)) {
            return updated;
          }

          updated.push(data);
          return updated;
        });

        break;
    }

    autoScrollToBottom();
    markVisibleMessagesAsSeen();
  };

  const setupWebSocket = () => {
    const wsUrl = `${WS_BASE_URI}/api/v1/ws/group/${groupId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => console.log('Connected to group chat');

    markVisibleMessagesAsSeen();

    ws.onmessage = handleWSMessage;

    ws.onclose = (event) => {
      console.log('Disconnected from group chat:', event.reason);
    };

    ws.onerror = (error) => {
      console.log('WebSocket error', error);
    };
  };

  const handleSendMessage = () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected yet!");
      return;
    }

    const tempId = generateTempId();
    const tempMessage = {
      id: tempId,
      sender: user,
      content: trimmedMessage,
      created_at: new Date().toISOString(),
      is_temp: true,
      reply_to_message: replyTo || null,
    };

    setMessages((prev) => [...prev, tempMessage]);

    const payload = {
      action: "message",
      content: trimmedMessage,
      temp_id: tempId,
      reply_to: replyTo?.id || null,
    };

    try {
      wsRef.current.send(JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to send message via WS:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...msg, is_temp: false, failed: true } : msg
        )
      );
    }

    setNewMessage("");
    setReplyTo(null);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
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

    const tempId = generateTempId();
    const tempMessage = {
      id: tempId,
      file_url: URL.createObjectURL(file),
      sender: user,
      created_at: new Date().toISOString(),
      is_temp: true,
      uploading: true,
      progress: 0,
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      const data = await uploadFileMessage(groupId, file);

      const uploadFilePayload = {
        action: "file_upload",
        file_url: data.file_url,
        temp_id: tempId,
        message_id: data.id
      }

      wsRef.current.send(JSON.stringify(uploadFilePayload));
    } catch (err) {
      console.error("Failed to send file_upload via WS:", err);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId ? { ...msg, uploading: false, failed: true } : msg
        )
      );
    }
  };

  const updateFileMessage = async (messageId, newFile) => {
    if (!newFile) return;

    const tempId = generateTempId();
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
      const data = await editGroupFileMessage(messageId, newFile);

      wsRef.current.send(JSON.stringify({
        action: "file_update",
        message_id: messageId,
        file_url: data.file_url,
        temp_id: tempId
      }));
    } catch (err) {
      console.error("Failed to send file_update via WS:", err);
      setMessages(prev =>
        prev.map(msg =>
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
    <Box
      sx={{
        width: '100%',
        border: '1px solid #dcdcdcff',
      }}
    >
      <AppBar
        position="static"
        color="default"
        elevation={2}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alightItems: 'center',
          '&:hover': { bgcolor: 'grey.200' },
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={toggleListMember}
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
            onClick={() => setOpen(true)}
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
          <Box sx={{
            display: 'flex',
            gap: 2,
            alightItems: 'center'
          }}>
            <CallIcon sx={{ fontSize: 24, color: 'primary.main' }} />
            <VideocamIcon
              sx={{ fontSize: 26, color: 'primary.main' }}
            />
          </Box>
        </Toolbar>
      </AppBar>


      <Box sx={{ display: 'flex', height: '80vh' }}>
        <GroupSideComponent
          groupId={groupId}
        />
        <Drawer
          anchor='right'
          open={openDrawer}
          onClose={toggleDrawer}>
          {DrawerBox}
        </Drawer>

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            // ml: 3,
            overflow: 'hidden',
            borderLeft: '1px solid #dcdcdcff',
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
            ref={messagesContainerRef}
            onScroll={handleScroll}
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
                .sort((a, b) => new Date(a.created_at || a.temp_created_at) - new Date(b.created_at || b.temp_created_at))
                .map((message) => {
                  const isEditing = editingMessageId === message.id;
                  const messageKey = message.id ?? message.temp_id;

                  const isForwarded = !!message?.forwarded_by;

                  // const isOwn = isForwarded
                  //   ? message?.forwarded_by?.id === user?.id
                  //   : message.sender?.id === user?.id;

                  const isOwn = message.sender?.id === user?.id;

                  
                  return (
                    <Box
                      key={messageKey}
                      data-message-id={messageKey}
                      sx={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end',
                        mb: 1,
                      }}
                    >
                      {!isOwn && message.sender?.username && (
                        <Avatar
                          src={message.sender.avatar_url}
                          alt={message.sender.username || 'User'}
                          sx={{ width: 32, height: 32, mr: 1 }}
                        >
                          {message.sender.username?.charAt(0) || 'U'}
                        </Avatar>
                      )}

                      <Box sx={{ maxWidth: '70%', position: 'relative' }}>
                        {!isOwn && (
                          <Typography variant="caption" sx={{ fontWeight: 600, ml: 1 }}>
                            {message.sender?.username}
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
                            <Box
                              sx={{
                                bgcolor: "#e8f0fe",
                                borderRadius: 1,
                              }}
                            >
                              {isForwarded && (
                                <Box
                                  sx={{
                                    bgcolor: "#e8f0fe",
                                    px: 2,
                                    py: 1,
                                    borderLeft: "3px solid #1a73e8",
                                    borderRadius: 1,
                                    // mb: 1
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    Forwarded from {message?.forwarded_by?.id !== user?.id ?
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          gap: 0.2,
                                          alightItems: 'center'
                                        }}
                                      >
                                        <Avatar
                                          src={message?.forwarded_by?.avatar_url}
                                          alt={message?.forwarded_by?.username || "author image"}
                                          sx={{
                                            width: 14,
                                            height: 14,
                                            mt: 0.3
                                          }}
                                        >{message?.forwarded_by?.avatar_url?.charAt(0) || "U"}</Avatar>
                                        {message?.forwarded_by?.username}
                                      </Box>
                                      :
                                      (" you")}
                                  </Typography>

                                  {/* <Typography
                                    variant="caption"
                                    sx={{ color: "text.secondary", ml: 1 }}
                                  >
                                    by 
                                  </Typography> */}
                                </Box>
                              )}

                              {message.parent_message && (
                                <Box
                                  sx={{
                                    bgcolor: "#e8f0fe",
                                    py: 1,
                                    px: 3,
                                    // borderLeft: "3px solid #1976d2",
                                    borderRadius: 1,
                                    // mb: 1,
                                    display: 'flex',
                                    gap: 1,
                                  }}
                                >
                                  <Typography variant="body2" sx={{ fontSize: 12, mt: 0.3 }}>
                                    Reply to
                                  </Typography>
                                  <Box>
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                      {message.parent_message.sender?.username}
                                    </Typography>

                                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                      {message.parent_message.content}
                                    </Typography>

                                    {message.parent_message.file_url && (
                                      <Box
                                        sx={{
                                          position: 'relative',
                                          display: 'inline-block',
                                          width: '100%',
                                          maxWidth: 70,
                                          borderRadius: 2,
                                          overflow: 'hidden',
                                        }}
                                      >
                                        <Box
                                          component="img"
                                          src={message.parent_message.file_url}
                                          onClick={(e) => openSecondMenu(e, message.id)}
                                          alt="upload"
                                          sx={{
                                            width: '100%',
                                            opacity: message.uploading ? 0.6 : 1,
                                            filter: message.failed ? 'grayscale(100%)' : 'none',
                                          }}
                                        />
                                      </Box>
                                    )}

                                  </Box>
                                </Box>
                              )}

                              {message.file_url && (
                                <Box
                                  sx={{
                                    position: 'relative',
                                    display: 'inline-block',
                                    width: '100%',
                                    maxWidth: 200,
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={message.file_url}
                                    onClick={(e) => openSecondMenu(e, message.id)}
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
                                  onClick={(e) => openSecondMenu(e, message.id)}
                                >
                                  {message.content}
                                </Typography>
                              )}

                            </Box>
                          )}
                        </Box>

                        {(isOwn || message.sender?.username) && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', textAlign: isOwn ? 'right' : 'left', mt: 0.5, mx: 1 }}
                            >
                              {message.updated_at
                                ? `edited at: ${formatCambodiaTime(message.updated_at)}`
                                : formatCambodiaTime(message.created_at)
                              }
                              {message.is_temp && ' • Sending...'}
                            </Typography>
                            <Box sx={{ mt: 0.5 }}>
                              {message.seen_by?.length > 0 ? (
                                <DoneAllIcon
                                  fontSize="12"
                                  color="green"
                                  sx={{
                                    color: 'green',
                                    transition: 'transform 0.2s',
                                    '&:hover': { transform: 'scale(1.3)' }
                                  }}
                                  onClick={() => {
                                    setSelectedMessageId(message.id);
                                    setOpenSeenMessage(true);
                                  }}
                                />
                              ) : (
                                <CheckIcon fontSize="12" />
                              )}
                            </Box>
                          </Box>

                        )}

                      </Box>

                      <Menu
                        anchorEl={secondAnchorEl}
                        open={Boolean(secondAnchorEl)}
                        onClose={closeSecondMenu}
                      >
                        {activeMessage &&
                          [
                            <MenuItem
                              key="reply"
                              onClick={() => {
                                setReplyTo(activeMessage);
                                closeSecondMenu();
                              }}
                            >
                              <ReplyIcon /> Reply
                            </MenuItem>,

                            <MenuItem
                              key="forward"
                              onClick={() => {
                                setSelectedMessage(activeMessage);
                                toggleDrawer();
                                closeSecondMenu();
                              }}
                            >
                              <ShortcutIcon /> Forward
                            </MenuItem>,

                            activeMessage.content && activeMessage.sender?.id === user?.id
                              ? (
                                <MenuItem
                                  key="edit"
                                  onClick={() => {
                                    setEditingMessageId(activeMessage.id);
                                    setEditedContent(activeMessage.content);
                                    closeSecondMenu();
                                  }}
                                >
                                  <EditIcon /> Edit
                                </MenuItem>
                              )
                              : null,

                            activeMessage.file_url
                              ? [
                                <MenuItem
                                  key="view-img"
                                  onClick={() => {
                                    setSelectedImage(activeMessage.file_url);
                                    setOpenImage(true);
                                    closeSecondMenu();
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
                                    closeSecondMenu();
                                  }}
                                >
                                  <SaveAltIcon /> Save Image
                                </MenuItem>,

                                activeMessage.sender?.id === user?.id
                                  ? (
                                    <MenuItem
                                      key="replace-img"
                                      onClick={() => {
                                        const input = document.createElement("input");
                                        input.type = "file";
                                        input.accept = "image/*";
                                        input.onchange = (e) => {
                                          if (e.target.files[0])
                                            updateFileMessage(activeMessage.id, e.target.files[0]);
                                        };
                                        input.click();
                                        closeSecondMenu();
                                      }}
                                    >
                                      <PhotoCameraIcon /> Replace Image
                                    </MenuItem>
                                  )
                                  : null,
                              ]
                              : null,

                            (activeMessage.sender?.id === user?.id ||
                              activeMessage.forwarded_by?.id === user?.id) ? (
                              <MenuItem
                                key="delete"
                                onClick={() => {
                                  onDelete(activeMessage);
                                  closeSecondMenu();
                                }}
                              >
                                <DeleteIcon /> Delete
                              </MenuItem>
                            ) : null,
                          ].flat().filter(Boolean)}
                      </Menu>
                    </Box>
                  );
                })
            )}

            {showScrollButton && (
              <IconButton
                onClick={scrollToBottom}
                variant="contained"
                sx={{
                  position: 'fixed',
                  bottom: 80,
                  right: 16,
                  backgroundColor: 'primary.main'
                }}
              >
                <ArrowDownwardIcon sx={{ color: 'white' }} />
              </IconButton>

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
                  <label htmlFor="file-upload" >
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
                    <KeyboardVoiceIcon />
                  </IconButton>
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

      </Box >
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

      <SeenMessageListDialog
        open={openSeenMessage}
        onClose={() => setOpenSeenMessage(false)}
        messageId={selectedMessageId}
      />
    </Box >

  );
};

export default GroupChatPage;