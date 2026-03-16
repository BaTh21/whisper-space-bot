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
  Drawer,
  Tooltip
} from '@mui/material';
import {
  EmojiEmotions as EmojiEmotionsIcon,
  InsertEmoticon as InsertEmoticonIcon,
} from '@mui/icons-material';
import { useEffect, useRef, useState, useCallback } from 'react';
import GroupMenuDialog from '../components/dialogs/GroupMenuDialog';
import { useAuth } from '../context/AuthContext';
import { getGroupMembers, getGroupMessage, getGroupById, uploadFileMessage, editGroupFileMessage, uploadVoiceMessage } from '../services/api';
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
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SeenMessageListDialog from '../components/dialogs/SeenMessageListDialog';
import GroupListComponent from '../components/chat/GroupListComponent';
import CallIcon from '@mui/icons-material/Call';
import VideocamIcon from '@mui/icons-material/Videocam';
import { VoiceMessagePlayer } from '../components/group/VoiceMessagePlayer';
import VoiceRecorder from '../components/group/VoiceRecorder';
import EmojiPicker from '../components/EmojiPicker';
import ModeCommentRoundedIcon from '@mui/icons-material/ModeCommentRounded';
import useTypewriter from '../hooks/useTypewriter';
import DeleteDialog from '../components/dialogs/DeleteDialog';
import EmojiButton from '../components/EmojiButton';
import { useGroupWebsocket } from '../hooks/useGroupWebsocket';
import AutorenewIcon from '@mui/icons-material/Autorenew';

const GroupChatPage = ({ groupId, toggleGroupList, chats, setError, currentChatId, currentChatType }) => {

  const { auth } = useAuth();
  const user = auth?.user;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
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
  const messagesContainerRef = useRef(null);
  const [openSeenMessage, setOpenSeenMessage] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const messagesRef = useRef([]);
  const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const [recording, setRecording] = useState(false);
  const [showTextbox, setShowTextbox] = useState(false);
  const emojiButtonRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const firstLoadRef = useRef(true);
  const canLoadMoreRef = useRef(false);
  const userHasScrolledRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const [isError, setIsError] = useState(false);

  const LIMIT = 30;
  const pageRef = useRef(0);

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fileInputRef = useRef(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const ALLOWED_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif"
  ];

  const mergeMessages = (existingMessages, newMessages) => {
    const allMessages = [...newMessages, ...existingMessages];
    const map = new Map();

    allMessages.forEach(msg => {
      const id = msg.id ?? msg.temp_id;
      if (!map.has(id)) map.set(id, msg);
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.created_at || a.temp_created_at) - new Date(b.created_at || b.temp_created_at)
    );
  };

  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    setLoadingMore(true);

    const prevScrollHeight = container.scrollHeight;

    try {
      const offset = pageRef.current * LIMIT;
      const data = await getGroupMessage(groupId, LIMIT, offset);

      if (data.length < LIMIT) setHasMore(false);

      setMessages(prev => {
        const merged = mergeMessages(prev, data);

        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight;
        });

        return merged;
      });

      pageRef.current += 1;

    } catch (err) {
      console.error("Failed to load more messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, groupId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (firstLoadRef.current) {
      container.scrollTop = container.scrollHeight;
      firstLoadRef.current = false;
    }
  }, [messages]);

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
        onForward={(msg, targets) => {
          handleForwardMessage(msg, targets);
          setOpenDrawer(false);
        }}
        chats={chats}
        currentChatId={currentChatId}
        currentChatType={currentChatType}
      />
    </Box>
  )

  const handleForwardMessage = (message, targets) => {
    if (
      !wsRef.current ||
      (!targets?.users?.length && !targets?.groups?.length)
    ) return;

    sendWs(({
      action: "forward",
      message_id: message.id,
      targets: {
        users: targets.users || [],
        groups: targets.groups || []
      }
    }));
  };

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    const end = messagesEndRef.current;

    if (container && end) {
      requestAnimationFrame(() => {
        end.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    const isNearBottom = distanceFromBottom < 150;

    if (isNearBottom || firstLoadRef.current) {
      scrollToBottom();
    }
  }, [messages]);


  useEffect(() => {
    firstLoadRef.current = true;
    canLoadMoreRef.current = false;
    userHasScrolledRef.current = false;
    lastScrollTopRef.current = 0;
  }, [groupId]);

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

    sendWs(editPayload);
    setEditingMessageId(null);
  };

  const onDelete = async (activeMessageId) => {
    if (!activeMessageId) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const payload = {
      action: "delete",
      message_id: activeMessageId,
    };

    try {
      setDeleting(true);
      closeSecondMenu();
      sendWs(payload);
      setMessages(prev => prev.filter(msg => msg.id !== activeMessageId));
    } catch (err) {
      console.error("Failed to send delete via WS:", err);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
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

      pageRef.current = Math.ceil(messagesData.length / LIMIT);
      setHasMore(messagesData.length >= LIMIT);

    } catch (error) {
      console.error('Failed to fetch group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (!loadingMore && hasMore && container.scrollTop <= 50) {
      loadMoreMessages();
    }
  }, [loadingMore, hasMore, loadMoreMessages]);

  const handleWSMessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log('WS received:', data);

    switch (data.action) {

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

          requestAnimationFrame(scrollToBottom);
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
          if (prev.some(msg => msg.id === data.id)) return prev;
          requestAnimationFrame(scrollToBottom);
          return [...prev, data];
        });
        break;

      case "message":
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
          requestAnimationFrame(scrollToBottom);
          return updated;
        });
        break;

      default:
        break;
    }

  };

  const wsRef = useGroupWebsocket({ groupId, token, WS_BASE_URI });

  useEffect(() => {
    if (!wsRef.current) return;

    const handleMessage = (event) => {
      JSON.parse(event.data);
      handleWSMessage(event);
    };

    wsRef.current.addEventListener("message", handleMessage);

    return () => {
      wsRef.current?.removeEventListener("message", handleMessage);
    };
  }, [wsRef, handleWSMessage]);

  const sendWs = (payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.warn("WebSocket not connected yet!");
    }
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

    requestAnimationFrame(scrollToBottom);

    const payload = {
      action: "message",
      content: trimmedMessage,
      temp_id: tempId,
      reply_to: replyTo?.id || null,
    };

    try {
      sendWs(payload);
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
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileExt = "." + selectedFile.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      setIsError(true);
      setError("Invalid file type");
      e.target.value = "";
      return;
    }

    setFile({
      raw: selectedFile,
      preview: URL.createObjectURL(selectedFile),
    });
  };

  const handleRemoveFile = () => {
    if (file?.preview) URL.revokeObjectURL(file.preview);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadFileMessage = async (groupId) => {
    if (!file?.raw) return;

    const tempId = generateTempId();
    const tempMessage = {
      id: tempId,
      file_url: file.preview,
      sender: user,
      created_at: new Date().toISOString(),
      is_temp: true,
      uploading: true,
      progress: 0,
    };

    setMessages(prev => [...prev, tempMessage]);
    requestAnimationFrame(scrollToBottom);

    try {
      await uploadFileMessage(groupId, file.raw, tempId);

    } catch (err) {
      console.error("Failed to send file_upload via WS:", err);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId ? { ...msg, uploading: false, failed: true } : msg
        )
      );
    } finally {
      handleRemoveFile();
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
      await editGroupFileMessage(messageId, newFile, tempId);

    } catch (err) {
      console.error("Failed to send file_update via WS:", err);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, uploading: false, failed: true } : msg
        )
      );
    } finally {
      setFile(null);
    }
  };

  const handleUploadVoiceMessage = async (voiceFile) => {
    if (!voiceFile) return;

    const tempId = generateTempId();

    const tempMessage = {
      id: tempId,
      voice_url: URL.createObjectURL(voiceFile),
      sender: user,
      created_at: new Date().toISOString(),
      is_temp: true,
      uploading: true,
      progress: 0
    };

    setMessages((prev) => [...prev, tempMessage]);
    requestAnimationFrame(scrollToBottom);

    try {
      await uploadVoiceMessage(groupId, voiceFile, tempId);
    } catch (err) {
      console.error("Failed to upload voice message:", err);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId ? { ...msg, uploading: false, failed: true } : msg
        )
      )
    }
  };

  const animatedText = useTypewriter('Connecting...', 120, 1000);

  // if (loading || !wsConnected) {
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '80%',
          flexDirection: 'column',
          color: 'text.secondary',
        }}
      >
        <CircularProgress />
        <Typography mt={1}>
          {animatedText}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        border: 1,
        borderColor: isError ? 'error.main' : 'divider'
      }}
    >
      <AppBar
        position="static"
        color="default"
        elevation={2}
        sx={{
          bgcolor: isError ? '#ff8b8911' : 'inherit',
          '&:hover': { bgcolor: 'grey.200' },
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: { xs: 1, sm: 2 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              edge="start"
              color="inherit"
              onClick={toggleGroupList}
              sx={{
                '&:hover': { bgcolor: 'grey.200' },
                display: { xs: 'block', md: 'none' }
              }}
            >
              <ArrowBackIcon />
            </IconButton>

            <Avatar
              sx={{
                width: { xs: 38, md: 44 },
                height: { xs: 38, md: 44 },
                border: 1,
                borderColor: 'divider',
                fontSize: 28
              }}
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

            <Box sx={{ flexGrow: 1, overflow: 'hidden', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="h6" fontWeight={600} noWrap>
                {group?.name || 'Group Chat'}
              </Typography>

              <Typography variant="caption" color="text.secondary" noWrap>
                {members.length} members
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              gap: { xs: 1, sm: 2 },
              alignItems: 'center',
            }}
          >
            <CallIcon
              sx={{
                fontSize: { xs: 22, md: 26 },
                color: 'primary.main',
                transition: 'transform 1s',
                '&:hover': {
                  scale: 1.1
                }
              }}
            // onClick={handleStartVoiceCall}
            />
            <VideocamIcon
              sx={{
                fontSize: { xs: 24, md: 30 },
                color: 'primary.main',
                transition: 'transform 1s',
                '&:hover': {
                  scale: 1.1
                }
              }}
            // onClick={handleStartGroupCall}
            />
          </Box>
        </Toolbar>
      </AppBar>


      <Box
        sx={{
          display: 'flex',
          height: '80vh',
          bgcolor: isError ? '#ff8b8911' : 'inherit',
        }}>

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
            overflow: 'hidden',
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
            }}
            ref={messagesContainerRef}
            onScroll={handleScroll}
          >

            {loadingMore && (
              <Box display="flex" justifyContent="center" alignItems="center" mt={2}>
                <CircularProgress />
              </Box>
            )}

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
                <ModeCommentRoundedIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No messages yet
                </Typography>
                <Typography>Start a conversation with the group</Typography>
              </Box>
            ) : (
              messages
                .filter(Boolean)
                .slice()
                .sort((a, b) => new Date(a.created_at || a.temp_created_at) - new Date(b.created_at || b.temp_created_at))
                .map((message) => {
                  const isEditing = editingMessageId === message.id;
                  const messageKey = message.id ?? message.temp_id ?? `temp-${Math.random()}`;

                  const isForwarded = !!message.forwarded_by;

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
                          sx={{ width: 25, height: 25, mr: 1, fontSize: 14 }}
                        >
                          {message.sender.username?.charAt(0).toUpperCase() || 'P'}
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
                            <Box
                              sx={{
                                alignItems: 'center',
                                gap: 1,
                                p: 1,
                                borderRadius: 3,
                                // bgcolor: 'primary.main',
                                boxShadow: 2,
                              }}
                            >
                              <TextField
                                fullWidth
                                size="small"
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                placeholder="Edit message…"
                                variant="outlined"
                                multiline
                                maxRows={4}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    fontSize: '0.95rem',
                                    borderRadius: 2,
                                    bgcolor: 'grey.50',
                                    '& fieldset': {
                                      borderColor: 'divider',
                                    },
                                    '&:hover fieldset': {
                                      borderColor: 'text.secondary',
                                    },
                                    '&.Mui-focused fieldset': {
                                      borderColor: 'primary.main',
                                      borderWidth: 1,
                                    },
                                  },
                                }}
                              />
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  mt: 1
                                }}
                              >

                                <EmojiButton
                                  onSelect={(emoji) => setEditedContent((prev) => prev + emoji)}
                                  placement="bottom-start"
                                  size="small"
                                  width={300}
                                  height={350}
                                />

                                <Box sx={{ display: 'flex', gap: 0.5 }}>

                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={handleCancelEdit}
                                    sx={{
                                      color: 'black',
                                      opacity: 0.85,
                                      '&:hover': {
                                        opacity: 1,
                                        bgcolor: 'rgba(255,255,255,0.12)',
                                      },
                                    }}
                                  >
                                    Cancel
                                  </Button>

                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={handleSave}
                                    sx={{
                                      bgcolor: 'primary.main',
                                      color: 'primary.contrastText',
                                      '&:hover': {
                                        bgcolor: 'primary.dark',
                                      },
                                    }}
                                  >
                                    Save
                                  </Button>
                                </Box>
                              </Box>
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
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    Forwarded from {message.forwarded_by.id !== user?.id ?
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          gap: 0.2,
                                          alightItems: 'center'
                                        }}
                                      >
                                        <Avatar
                                          src={message.forwarded_by.avatar_url}
                                          alt={message.forwarded_by.username || "author image"}
                                          sx={{
                                            width: 14,
                                            height: 14,
                                            mt: 0.3,
                                            fontSize: 8
                                          }}
                                        >{message.forwarded_by.username.charAt(0).toUpperCase() || "P"}</Avatar>
                                        {message.forwarded_by.username}
                                      </Box>
                                      :
                                      (" you")}
                                  </Typography>
                                </Box>
                              )}

                              {message.parent_message && (
                                <Box
                                  sx={{
                                    bgcolor: "#e8f0fe",
                                    py: 1,
                                    px: 3,
                                    borderRadius: 1,
                                    display: 'flex',
                                    gap: 1,
                                    maxHeight: '10vh',
                                    maxWidth: 250,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Typography variant="body2" sx={{ fontSize: 12, mt: 0.3 }}>
                                    Reply to
                                  </Typography>
                                  <Box
                                    sx={{
                                      opacity: 0.6,
                                    }}
                                  >
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                      {message.parent_message.sender?.username}
                                    </Typography>

                                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                      {message.parent_message.content}
                                    </Typography>

                                    {message.parent_message.call_content && (
                                      <Box
                                        sx={{
                                          bgcolor: isOwn ? 'primary.main' : 'white',
                                          color: isOwn ? 'white' : 'text.primary',
                                          p: 2,
                                          borderRadius: 3,
                                          boxShadow: 1,
                                          wordBreak: 'break-word',
                                          transition: 'all 0.2s',
                                          textOverflow: 'ellipsis',
                                        }}
                                      >
                                        <Typography
                                          variant="body2"
                                          onClick={(e) => openSecondMenu(e, message.id)}
                                        >
                                          {message.parent_message.call_content}
                                        </Typography>

                                        <Button
                                          variant="outlined"
                                          color={isOwn ? 'white' : 'text.primary'}
                                          sx={{
                                            width: '100%',
                                            borderRadius: 3,
                                            boxShadow: 1,
                                            wordBreak: 'break-word',
                                            transition: 'all 0.2s',
                                            mt: 1
                                          }}
                                          disabled={true}
                                        >
                                          Join Now
                                        </Button>
                                      </Box>
                                    )}

                                    {message.parent_message.voice_url && (
                                      <Box
                                        sx={{
                                          display: "flex",
                                          justifyContent: isOwn ? "flex-end" : "flex-start",
                                          width: { xs: 150 },
                                          mb: 1,
                                        }}
                                        onClick={(e) => openSecondMenu(e, message.id)}
                                      >
                                        <VoiceMessagePlayer url={message.parent_message.voice_url} isOwn={isOwn} />
                                      </Box>
                                    )}

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

                              {message.voice_url && (
                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: isOwn ? "flex-end" : "flex-start",
                                    width: { md: 300, xs: 150 },
                                    mb: 1,
                                  }}
                                  onClick={(e) => openSecondMenu(e, message.id)}
                                >
                                  <VoiceMessagePlayer url={message.voice_url} isOwn={isOwn} />
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

                              {message.call_content && (
                                <Box
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
                                  <Typography
                                    variant="body2"
                                    onClick={(e) => openSecondMenu(e, message.id)}
                                  >
                                    {message.call_content}
                                  </Typography>

                                  <Button
                                    variant="outlined"
                                    color={isOwn ? 'white' : 'text.primary'}
                                    sx={{
                                      width: '100%',
                                      borderRadius: 3,
                                      boxShadow: 1,
                                      wordBreak: 'break-word',
                                      transition: 'all 0.2s',
                                      mt: 1
                                    }}
                                    disabled={message.updated_at}
                                    onClick={() => !message.updated_at && handleJoinCall()}
                                  >
                                    Join Now
                                  </Button>
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
                                    textAlign: isOwn ? 'right' : 'left'
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
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: isOwn ? 'end' : 'start' }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', textAlign: isOwn ? 'right' : 'left', mt: 0.5, mx: 1 }}
                            >
                              {message.call_content && message.updated_at ? (
                                `ended at: ${formatCambodiaTime(message.updated_at)}`
                              ) : message.updated_at ? (
                                `edited at: ${formatCambodiaTime(message.updated_at)}`
                              ) : (
                                formatCambodiaTime(message.created_at)
                              )}
                              {message.is_temp && ' • Sending...'}
                            </Typography>
                            <Box sx={{ mt: 0.5 }}>
                              {message.seen_by?.length > 0 ? (
                                <Tooltip title={message.seen_by.map(s => s.user?.username).join(', ') || 'Seen'}>
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
                                </Tooltip>
                              ) : (
                                <CheckIcon fontSize="12" />
                              )}
                            </Box>
                          </Box>

                        )}

                      </Box>

                    </Box>
                  );
                })
            )}

            <Menu
              anchorEl={secondAnchorEl}
              open={Boolean(secondAnchorEl)}
              onClose={closeSecondMenu}
              PaperProps={{
                sx: {
                  borderRadius: '12px',
                  zIndex: 9999
                }
              }}
              sx={{
                boxShadow: 0
              }}
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
                    <ReplyIcon sx={{ mr: 1.5 }} /> Reply
                  </MenuItem>,

                  !activeMessage.call_content
                    ? (
                      <MenuItem
                        key="forward"
                        onClick={() => {
                          setSelectedMessage(activeMessage);
                          toggleDrawer();
                          closeSecondMenu();
                        }}
                      >
                        <ShortcutIcon sx={{ mr: 1.5 }} /> Forward
                      </MenuItem>
                    )
                    : null,

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
                        <EditIcon sx={{ mr: 1.5 }} /> Edit
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
                        <RemoveRedEyeIcon sx={{ mr: 1.5 }} /> View Image
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
                        <SaveAltIcon sx={{ mr: 1.5 }} /> Save Image
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
                            <AutorenewIcon sx={{ mr: 1.5 }} /> Replace Image
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
                        setActiveMessageId(activeMessage.id);
                        setDeleteOpen(true);
                      }}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon sx={{ mr: 1.5 }} /> Delete
                    </MenuItem>
                  ) : null,
                ].flat().filter(Boolean)}
            </Menu>

            <div ref={messagesEndRef} />
          </Box>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'white' }}>
            {file && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  border: "1px solid #ddd",
                  borderRadius: 2,
                  p: 1,
                  mb: 1
                }}
              >
                {file.raw.type.startsWith("image/") ? (
                  <img
                    src={file.preview}
                    alt="preview"
                    style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6 }}
                  />
                ) : (
                  <AttachFileIcon />
                )}

                <Typography variant="caption" sx={{ flexGrow: 1 }}>
                  {file.raw.name}
                </Typography>

                <IconButton
                  size="small"
                  color="error"
                  onClick={handleRemoveFile}
                >
                  ✕
                </IconButton>
              </Box>
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
                  {!showTextbox && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        width: recording ? '100%' : 150
                      }}
                    >
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.gif"
                        id="file-upload"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleFileChange}
                      />
                      <label htmlFor="file-upload" >
                        <IconButton
                          sx={{
                            bgcolor: 'primary.main',
                            color: 'white',
                            borderRadius: 2,
                            '&:hover': {
                              bgcolor: '#213e57ff'
                            }
                          }}
                          component="span">
                          <AttachFileIcon />
                        </IconButton>
                      </label>
                      <VoiceRecorder
                        onConfirm={(blob) => {
                          handleUploadVoiceMessage(blob);
                        }}
                        onRecordingChange={setRecording}
                      />
                      <Box sx={{ position: 'relative' }}>
                        <IconButton
                          ref={emojiButtonRef}
                          onClick={() => setShowEmojiPicker(true)}
                          disabled={recording}
                          sx={{
                            fontSize: 50,
                            color: 'orange'
                          }}
                        >
                          {showEmojiPicker ? <EmojiEmotionsIcon /> : <InsertEmoticonIcon />}
                        </IconButton>

                        {(showEmojiPicker) && (
                          <EmojiPicker
                            onSelect={(emoji) => {
                              setNewMessage(prev => prev + emoji);
                            }}
                            onClose={() => setShowEmojiPicker(false)}
                            anchorEl={emojiButtonRef.current}
                            placement="top-start"
                          />
                        )}
                      </Box>
                    </Box>
                  )}

                  {(!recording || showTextbox) && (
                    <>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Aa..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        multiline
                        maxRows={4}
                        onFocus={() => setShowTextbox(true)}
                        onBlur={() => setShowTextbox(false)}
                        sx={{
                          bgcolor: 'grey.100',
                          borderRadius: 2,
                          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                        }}
                      />

                      <Button
                        variant="contained"
                        onClick={() => {
                          if (file) handleUploadFileMessage(groupId);
                          if (newMessage.trim()) handleSendMessage();
                        }}
                        disabled={!newMessage.trim() && !file}
                        sx={{ minWidth: 30, borderRadius: 2, py: 1, px: 1.5 }}
                      >
                        <SendIcon />
                      </Button>
                    </>
                  )}
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
        members={members}
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

      <DeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete a message"
        description="Are you sure want to delete this message?"
        onConfirm={
          activeMessageId
            ? () => onDelete(activeMessageId)
            : undefined
        }
        tag={`${deleting ? ('Deleting') : ('Delete')}`}
      />

    </Box >

  );
};

export default GroupChatPage;