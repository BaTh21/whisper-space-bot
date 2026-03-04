import {
  Close as CloseIcon,
  EmojiEmotions as EmojiEmotionsIcon,
  InsertEmoticon as InsertEmoticonIcon,
  Send as SendIcon
} from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CallIcon from '@mui/icons-material/Call';
import VideocamIcon from '@mui/icons-material/Videocam';
import {
  Avatar,
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  CircularProgress,
  Drawer
} from '@mui/material';
import { useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAvatar } from '../../hooks/useAvatar';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  addReactionToMessage,
  sendVoiceMessage as apiSendVoiceMessage,
  deleteImageMessage,
  deleteMessage,
  editMessage,
  getBlockedUsers,
  getPrivateChat,
  removeReactionFromMessage,
  sendImageMessage,
  uploadImage
} from '../../services/api';
import ChatMessage from '../chat/ChatMessage';
import EmojiButton from '../EmojiButton';
import EmojiPicker from '../EmojiPicker';
import { useAuth } from '../../context/AuthContext';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import VoiceRecorder from '../group/VoiceRecorder';
import GroupListComponent from '../chat/GroupListComponent';
import ModeCommentRoundedIcon from '@mui/icons-material/ModeCommentRounded';
import useTypewriter from '../../hooks/useTypewriter';

const getWebSocketBaseUrl = () => {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (!wsUrl) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return apiUrl.replace(/^http/, 'ws');
  }
  return wsUrl;
};
const BASE_URI = getWebSocketBaseUrl();

const MessagesTab = ({ friends, profile, isError, setError, setSuccess, showFriend, selectedFriend, toggleGroupList, chats, currentChatId, currentChatType }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiButtonRef = useRef(null);
  const { t } = useTranslation();
  const [showTextbox, setShowTextbox] = useState(false);
  const messageRefs = useRef({});

  const LIMIT = 30;

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const [blockedUsers, setBlockedUsers] = useState([]);

  const { auth } = useAuth();
  const user = auth?.user;
  const sentReadReceipts = useRef(new Set());
  const isConnectedRef = useRef(false);
  const sendWsMessageRef = useRef(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const loadingMoreRef = useRef(false);
  const initialScrollDone = useRef(false);
  const selectedFileRef = useRef(null);
  const fileInputRef = useRef(null);

  const audioBlobRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const tempToRealIdMap = useRef({});
  const cancelReply = () => setReplyTo(null);

  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState("");

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

  const { getAvatarUrl, getUserAvatar } = useAvatar();

  const handleReply = (message) => {
    setReplyTo({
      id: message.id,
      content: message.content,
      sender: message.sender,
      message_type: message.message_type,
      voice_duration: message.voice_duration,
      file_size: message.file_size,
    });
  };

  useEffect(() => {
    if (!selectedFriend) return;

    sentReadReceipts.current = new Set();
    initialScrollDone.current = false;

    setMessages([]);
    setNewMessage('');
    setImagePreview(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);

    loadInitialMessages();

  }, [selectedFriend]);

  const scrollToBottomIfNeeded = useCallback((behavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;

    if (isNearBottom || initialScrollDone.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    }
  }, []);

  const getWsUrl = useCallback(() => {
    if (!selectedFriend) return null;
    const rawToken = localStorage.getItem('accessToken') || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
    return `${BASE_URI}/api/v1/ws/private/${selectedFriend.id}?token=${token}`;
  }, [selectedFriend]);

  const handleWebSocketMessage = useCallback(
    async (data) => {
      const { type } = data;

      if (type === "reaction_added") {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.message_id) {
            const currentReactions = msg.reactions || [];
            const exists = currentReactions.some(r => r.id === data.reaction.id);
            if (!exists) {
              return {
                ...msg,
                reactions: [...currentReactions, data.reaction]
              };
            }
          }
          return msg;
        }));
        return;

      } else if (type === "reaction_removed") {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.message_id) {
            const currentReactions = msg.reactions || [];
            return {
              ...msg,
              reactions: currentReactions.filter(r => r.id !== data.reaction_id)
            };
          }
          return msg;
        }));
        return;
      }

      else if (type === "message") {
        const detectMessageType = (msgData) => {
          if (msgData.message_type === "system") return "system";
          if (msgData.message_type === "image") return "image";
          if (msgData.message_type === "voice") return "voice";
          if (msgData.message_type === "file") return "file";
          if (msgData.message_type === "text") return "text";

          const content = msgData.content || "";

          const isVoiceUrl =
            content.includes("/voice_messages/") ||
            content.match(/\.(mp3|wav|ogg|webm|m4a|aac|opus|flac|3gp)$/i) ||
            (content.includes("cloudinary.com") && content.includes("/video/upload/"));
          if (isVoiceUrl) return "voice";

          const isImageUrl =
            content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
            (content.includes("cloudinary.com") && content.includes("/image/upload/"));
          return isImageUrl ? "image" : "text";
        };

        if (data.temp_id) {
          console.log("Temp message received from server:", data);
        }

        const messageType = detectMessageType(data);

        const realMessage = {
          id: data.id,
          temp_id: data.temp_id || null,
          content: data.content,
          is_temp: false,
          message_type: messageType,
          sender_id: data.sender_id,
          sender: {
            id: data.sender_id,
            username: data.sender_username,
            avatar_url: getAvatarUrl(data.avatar_url),
          },
          sender_username: data.sender_username,
          sender_avatar_url: getAvatarUrl(data.avatar_url),
          is_read: data.is_read || false,
          read_at: data.read_at || null,
          seen_by: data.seen_by || [],
          created_at: data.created_at,
          edited_at: data.edited_at || null,
          voice_duration: data.voice_duration || 0,
          file_size: data.file_size || 0,

          reply_to_id: data.reply_to_id || null,
          reply_preview: data.reply_preview || null,
          reply_to: data.reply_to || null,
          is_forwarded: data.is_forwarded || null,
          original_sender: data.original_sender || null,
          original_sender_avatar: data.original_sender_avatar || null
        };

        setMessages((prev) => {
          const updated = [...prev];
          if (data.temp_id) {
            const tempIndex = updated.findIndex(m => m.is_temp && m.temp_id === data.temp_id);
            if (tempIndex !== -1) {
              tempToRealIdMap.current[data.temp_id] = data.id;
              const prevTempMsg = updated[tempIndex];
              updated[tempIndex] = {
                ...realMessage,
                seen_by: prevTempMsg.seen_by || realMessage.seen_by || [],
              };
            }
          }

          if (!updated.some((m) => m.id === data.id)) {
            updated.push(realMessage);
          }
          return updated.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });

        if (data.sender_id !== user.id) {
          sendReadReceipt(data.id);
        }

        requestAnimationFrame(() => {
          scrollToBottomIfNeeded('smooth');
        });
      }

      else if (type === "new_call_message") {
        const realMessage = {
          id: data.message_id,
          content: data.content,
          message_type: "system",
          is_temp: false,
          temp_id: null,
          sender_id: data.sender_id,
          sender: {
            id: data.sender.id,
            username: data.sender.username,
            avatar_url: getAvatarUrl(data.sender.avatar_url),
          },
          created_at: data.created_at,
          edited_at: data.edited_at,
          edited: false,
          is_read: true,
          read_at: new Date().toISOString(),
          seen_by: [],
        };

        setMessages(prev => {
          const exists = prev.some(m => m.id === data.message_id);
          if (!exists) {
            return [...prev, realMessage].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );
          }
          return prev;
        });

        if (data.sender_id !== user.id) {
          sendReadReceipt(data.id);
        }

        requestAnimationFrame(() => {
          scrollToBottomIfNeeded('smooth');
        });

      } else if (type === "message_updated") {
        setMessages((prev) =>
          prev.map((msg) => {
            const messageIdsToCheck = [
              msg.id,
              msg.temp_id,
              tempToRealIdMap.current[msg.id],
              tempToRealIdMap.current[msg.temp_id]
            ].filter(Boolean);

            const matches =
              messageIdsToCheck.includes(data.message_id) ||
              messageIdsToCheck.includes(data.id) ||
              msg.id === data.message_id ||
              msg.id === data.id;

            if (matches) {
              if (data.seen_by) {
                return {
                  ...msg,
                  content: data.content || msg.content,
                  message_type: data.message_type || msg.message_type,
                  edited_at: data.edited_at,
                  edited: true,
                  is_read: data.is_read !== undefined ? data.is_read : msg.is_read,
                  read_at: data.read_at || msg.read_at,
                  seen_by: Array.isArray(data.seen_by) ? data.seen_by : msg.seen_by,
                };
              }

              return {
                ...msg,
                content: data.content || msg.content,
                message_type: data.message_type || msg.message_type,
                edited_at: data.edited_at,
                edited: true,
              };
            }
            return msg;
          })
        );

      } else if (type === "message_deleted") {
        setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
      }
    },
    [
      blockedUsers,
      getAvatarUrl,
      friends,
      selectedFriend,
      getUserAvatar,
      setSuccess
    ]
  );

  const sendReadReceipt = useCallback((messageId, senderId) => {
    if (!isConnectedRef.current) return;
    if (!sendWsMessageRef.current) return;

    sendWsMessageRef.current({
      type: "read_message",
      message_id: messageId,
      user_id: senderId
    });
  }, []);

  const sendSeenMessage = useCallback(() => {
    if (!selectedFriend || !isConnectedRef.current) return;

    messages.forEach((msg) => {
      if (msg.sender_id !== user.id && !msg.is_read) {
        sendReadReceipt(msg.id, msg.sender_id);
      }
    });
  }, [messages, selectedFriend, sendReadReceipt, user.id]);

  const handleWebSocketOpen = useCallback(() => {
    console.log('[WS] Connected');
    setError(null);
    isConnectedRef.current = true;

    if (selectedFriend && messages.length > 0) {
      const unread = messages.filter(
        m => m.sender_id !== user.id && !m.is_read && m.id && !m.is_temp
      );
      unread.forEach(m => {
        if (!sentReadReceipts.current.has(m.id)) {
          sendWsMessageRef.current?.({
            type: "read_message",
            message_id: m.id,
          });
          sentReadReceipts.current.add(m.id);
        }
      });
    }
  }, [sendSeenMessage, messages.length, selectedFriend]);

  const handleWebSocketClose = useCallback((event) => {
    console.log('[WS] Closed', event.code, event.reason);
  }, []);

  const handleWebSocketError = useCallback((error) => {
    console.error('[WS] Error', error);
  }, []);

  const handleReconnect = useCallback((attempt) => {
    console.log(`[WS] Reconnect attempt #${attempt}`);
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
  });

  useEffect(() => {
    sendWsMessageRef.current = sendWsMessage;
  }, [sendWsMessage]);

  useEffect(() => {
    if (!selectedFriend || !isConnected || !sendWsMessageRef.current) return;

    const unreadMessages = messages.filter(
      msg => msg.sender_id !== user.id && !msg.is_read && msg.id && !msg.is_temp
    );

    unreadMessages.forEach(msg => {
      if (!sentReadReceipts.current.has(msg.id)) {
        sendWsMessageRef.current({
          type: "read_message",
          message_id: msg.id
        });
        sentReadReceipts.current.add(msg.id);
      }
    });
  }, [messages, selectedFriend, isConnected, user.id]);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        const blockedUsersList = await getBlockedUsers();
        setBlockedUsers(blockedUsersList);

        const statusMap = {};
        blockedUsersList.forEach(user => {
          statusMap[user.id] = true;
        });
      } catch (error) {
        console.error('Error fetching blocked users:', error);
      }
    };

    fetchBlockedUsers();
  }, []);

  const handleVoiceConfirm = (blob) => {
    if (!blob || !selectedFriend) return;

    audioBlobRef.current = blob;

    sendVoiceMessage();
  };

  const sendVoiceMessage = async () => {
    if (!audioBlobRef.current || audioBlobRef.current.size === 0) {
      setError('Empty voice recording');
      return;
    }

    const blobToSend = audioBlobRef.current;
    audioBlobRef.current = null;

    const tempId = `temp-voice-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      temp_id: tempId,
      sender_id: profile.id,
      receiver_id: selectedFriend.id,
      content: URL.createObjectURL(blobToSend),
      message_type: 'voice',
      is_read: false,
      is_temp: true,
      voice_duration: Math.max(recordingTime, 1),
      sender: {
        id: profile.id,
        username: profile.username,
        avatar_url: getUserAvatar(profile),
      },
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMsg]);
    requestAnimationFrame(() => {
      scrollToBottomIfNeeded('smooth');
    });

    const formData = new FormData();
    formData.append('voice_file', blobToSend, 'voice.webm');
    formData.append('duration', tempMsg.voice_duration.toString());
    formData.append('temp_id', tempId); // send temp_id to server

    try {
      const sentMessage = await apiSendVoiceMessage(selectedFriend.id, formData);

      setMessages((prev) =>
        prev.map((m) =>
          m.temp_id === tempId
            ? {
              ...sentMessage,
              is_temp: false,
              sender: {
                id: profile.id,
                username: profile.username,
                avatar_url: getUserAvatar(profile),
              },
            }
            : m
        )
      );
    } catch (err) {
      console.error(err.response?.data || err);
      setError(err.response?.data?.message || 'Failed to send voice');

      setMessages((prev) => prev.filter((m) => m.temp_id !== tempId));
    }
  };

  const handleAddReaction = async (messageId, emoji) => {
    try {
      const reaction = await addReactionToMessage(messageId, { emoji });

      sendWsMessage({
        type: 'reaction_add',
        message_id: messageId,
        emoji: emoji
      });

      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const currentReactions = msg.reactions || [];
          return {
            ...msg,
            reactions: [...currentReactions, reaction]
          };
        }
        return msg;
      }));

    } catch (err) {
      console.error('Failed to add reaction:', err);
      setError(t('failed_add_reaction'));
    }
  };

  const handleRemoveReaction = async (messageId, reactionId) => {
    try {
      await removeReactionFromMessage(messageId, reactionId);

      sendWsMessage({
        type: 'reaction_remove',
        message_id: messageId,
        reaction_id: reactionId
      });

      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const currentReactions = msg.reactions || [];
          return {
            ...msg,
            reactions: currentReactions.filter(r => r.id !== reactionId)
          };
        }
        return msg;
      }));

    } catch (err) {
      console.error('Failed to remove reaction:', err);
      setError(t('failed_remove_reaction'));
    }
  };

  const handleImageUpload = async (file) => {
    if (!selectedFriend) return;

    const tempId = `temp-img-${Date.now()}`;
    try {
      setUploadingImage(true);
      const result = await uploadImage(selectedFriend.id, file);
      const { url } = result;

      setImagePreview(null);

      const payload = {
        type: 'message',
        content: url,
        message_type: 'image',
      };

      if (!sendWsMessage(payload)) {
        const sentMessage = await sendImageMessage(selectedFriend.id, url);
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== tempId)
            .concat({
              ...sentMessage,
              is_temp: false,
              message_type: 'image',
              sender: {
                username: profile.username,
                avatar_url: getUserAvatar(profile),
                id: profile.id,
              },
            })
        );
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(t('failed_upload_image'));
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('select_image_file'));
      setError(true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('image_too_large_5mb'));
      setError(true);
      return;
    }

    selectedFileRef.current = file;

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveImagePreview = () => {
    setImagePreview(null);
    selectedFileRef.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const handleDeleteMessage = (messageId, isTemp = false) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    setMessageToDelete({ id: messageId, isTemp, message });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!messageToDelete) return;
    setIsDeleting(true);
    const { id, isTemp, message } = messageToDelete;
    const isImage = message.message_type === 'image';

    if (!isTemp) {
      try {
        if (isImage) {
          await deleteImageMessage(id);
        } else {
          await deleteMessage(id);
        }
        setMessages(prev => prev.filter(m => m.id !== id));
        setSuccess(isImage ? t('image_deleted') : t('message_deleted'));
        setTimeout(() => setSuccess(null), 2000);
      } catch (err) {
        setError(t('failed_delete_message'));
        setMessages(prev => [...prev, message]);
      }
    }
    setIsDeleting(false);
    setDeleteConfirmOpen(false);
    setMessageToDelete(null);
  };

  const handleTypingStart = useCallback(() => {
    if (!selectedFriend || !isConnected) return;
    sendWsMessage({ type: 'typing', is_typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendWsMessage({ type: 'typing', is_typing: false });
    }, 3000);
  }, [selectedFriend, isConnected, sendWsMessage]);

  const buildSeenBy = (msg) => {
    if (msg.seen_by && Array.isArray(msg.seen_by)) {
      return msg.seen_by.map(s => ({
        user_id: s.user_id || s.userId,
        username: s.username,
        avatar_url: s.avatar_url || s.avatarUrl,
        seen_at: s.seen_at || s.seenAt,
      }));
    }

    if (msg.is_read) {
      const otherUserId = msg.receiver_id === profile?.id ? selectedFriend.id : profile.id;
      return [{
        user_id: otherUserId,
        username: msg.receiver_id === profile?.id ? selectedFriend.username : profile.username,
        avatar_url: msg.receiver_id === profile?.id ? getUserAvatar(selectedFriend) : getUserAvatar(profile),
        seen_at: msg.read_at || new Date().toISOString(),
      }];
    }

    return [];
  };

  const detectMessageType = (msgData) => {
    if (msgData.message_type === "system") return "system";
    if (msgData.message_type === "image") return "image";
    if (msgData.message_type === "voice") return "voice";
    if (msgData.message_type === "file") return "file";
    if (msgData.message_type === "text") return "text";

    const content = msgData.content || "";

    const isVoiceUrl =
      content.includes("/voice_messages/") ||
      content.match(/\.(mp3|wav|ogg|webm|m4a|aac|opus|flac|3gp)$/i) ||
      (content.includes("cloudinary.com") && content.includes("/video/upload/"));
    if (isVoiceUrl) return "voice";

    const isImageUrl =
      content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
      (content.includes("cloudinary.com") && content.includes("/image/upload/"));
    return isImageUrl ? "image" : "text";
  };

  const loadInitialMessages = async () => {
    if (!selectedFriend) return;

    setLoadingInitial(true);
    setHasMore(true);

    try {
      const data = await getPrivateChat(selectedFriend.id, LIMIT, 0);

      if (data.length < LIMIT) setHasMore(false);

      const enhanced = enhanceMessages(data);

      setMessages(
        enhanced.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      );

      setPage(1);

      requestAnimationFrame(() => scrollToBottom(true));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInitial(false);
    }
  };

  const dedupeMessages = (messages) => {
    const map = new Map();
    messages.forEach(msg => {
      map.set(msg.id, msg);
    });
    return Array.from(map.values());
  };

  const loadMoreMessages = async () => {
    if (!selectedFriend || loadingMoreRef.current || !hasMore) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const prevScrollHeight = container.scrollHeight;

    setLoadingMore(true);
    loadingMoreRef.current = true;

    try {
      const data = await getPrivateChat(selectedFriend.id, LIMIT, page * LIMIT);

      if (data.length < LIMIT) setHasMore(false);

      const enhanced = enhanceMessages(data);

      setMessages(prev => {
        const merged = dedupeMessages([...enhanced, ...prev])
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // old → new
        return merged;
      });

      setPage(prev => prev + 1);

      requestAnimationFrame(() => {
        const newScrollHeight = container.scrollHeight;
        container.scrollTop = newScrollHeight - prevScrollHeight;
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container || loadingMoreRef.current || !hasMore) return;

    if (container.scrollTop < 50) {
      loadMoreMessages();
    }
  };

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (!messages.length) return;
    if (initialScrollDone.current) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
        initialScrollDone.current = true;
      });
    });
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingMoreRef.current, page]);

  const enhanceMessages = (chatMessages) => {
    return chatMessages
      .filter(msg => !blockedUsers.some(u => u.id === msg.sender_id))
      .map(msg => {
        const messageType = detectMessageType(msg);
        const sender = {
          id: msg.sender_id,
          username: msg.sender_id === profile.id ? profile.username : selectedFriend.username,
          avatar_url: getUserAvatar(msg.sender_id === profile.id ? profile : selectedFriend),
        };
        const seen_by = buildSeenBy(msg);
        return { ...msg, sender, seen_by, message_type: messageType, is_temp: false };
      });
  };

  <EmojiButton
    onSelect={(emoji) => setNewMessage(prev => prev + emoji)}
    disabled={!selectedFriend || uploadingImage || isRecording}
    placement="top-start"
    width={340}
    height={400}
    buttonProps={{
      sx: { color: 'primary.main' }
    }}
  />

  const sendTextMessage = async () => {
    if (!newMessage.trim() || !selectedFriend) return;

    const tempId = `temp-${Date.now()}`;

    const tempMsg = {
      id: tempId,
      temp_id: tempId,
      sender_id: profile.id,
      receiver_id: selectedFriend.id,
      content: newMessage.trim(),
      message_type: 'text',
      reply_to_id: replyTo?.id || null,
      reply_preview: replyTo
        ? {
          id: replyTo.id,
          sender_username: replyTo.sender?.username,
          content:
            replyTo.message_type === 'voice'
              ? '🎤 Voice message'
              : replyTo.message_type === 'image'
                ? '🖼️ Photo'
                : replyTo.content,
          message_type: replyTo.message_type,
        }
        : null,
      is_temp: true,
      created_at: new Date().toISOString(),
      sender: {
        id: profile.id,
        username: profile.username,
        avatar_url: getUserAvatar(profile),
      },
    };

    setNewMessage('');
    setReplyTo(null);

    const payload = {
      type: 'message',
      content: tempMsg.content,
      message_type: 'text',
      temp_id: tempId,
      reply_to_id: replyTo?.id || undefined,
    };

    sendWsMessage(payload);

    requestAnimationFrame(() => {
      scrollToBottomIfNeeded('smooth');
    });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !audioUrl && !imagePreview) return;

    try {
      if (newMessage.trim()) {
        await sendTextMessage();
      }

      if (audioBlobRef.current) {
        await sendVoiceMessage();
      }

      if (selectedFileRef.current) {
        await handleImageUpload(selectedFileRef.current);

        selectedFileRef.current = null;
        return;
      }

      setNewMessage('');
      setAudioUrl(null);
      setImagePreview(null);
      setReplyTo(null);
      setError(false);

    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err.message || t('failed_send_message'));
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim() && selectedFriend && isConnected) {
      handleTypingStart();
    }
  };

  const handleForwardMessage = (message, targets) => {

    sendWsMessage({
      type: "forward",
      message_id: message.id,
      targets: {
        users: targets.users || [],
        groups: targets.groups || []
      }
    })
  };

  const scrollToBottom = (smooth = true) => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  const handleEditMessage = async (messageId, newContent) => {
    if (!newContent.trim()) return;

    const message = messages.find(
      (m) => m.id === messageId || m.temp_id === messageId
    );
    if (!message) return;

    const oldContent = message.content;

    const realMessageId = tempToRealIdMap.current[messageId] || messageId;

    setMessages((prev) =>
      prev.map((m) => {
        const matches = m.id === messageId || m.id === realMessageId || m.temp_id === messageId;
        if (matches) {
          return {
            ...m,
            content: newContent,
            edited_at: new Date().toISOString(),
            edited: true,
            message_type: m.message_type,
            sender: m.sender,
            is_temp: m.is_temp,
          };
        }
        return m;
      })
    );

    try {
      await editMessage(realMessageId, newContent);

      setSuccess(t("message_edited"));
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error("Edit failed:", err);
      setError(t("failed_edit_message"));

      setMessages((prev) =>
        prev.map((m) => {
          const matches = m.id === messageId || m.id === realMessageId || m.temp_id === messageId;
          if (matches) {
            return {
              ...m,
              content: oldContent,
              edited_at: m.created_at,
              edited: false,
            };
          }
          return m;
        })
      );
      setTimeout(() => setError(null), 3000);
    }
  };

  const animatedText = useTypewriter('Connecting...', 120, 1000);

  if (loadingInitial) {
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
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        height: '88vh',
        overflow: 'auto',
        borderColor: 'divider',
        bgcolor: 'transparent',
        mx: { sm: 'auto', md: 0 },
        position: 'relative'
      }}
    >
      {/* Delete Confirmation */}
      {deleteConfirmOpen && messageToDelete && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <Box
            sx={{
              bgcolor: 'white',
              borderRadius: '12px',
              p: 3,
              maxWidth: 400,
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" gutterBottom>
              {t('delete')} {messageToDelete.message.message_type === 'image' ? 'Image' : 'Message'}?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('irreversible_action')}.
            </Typography>
            {messageToDelete.message.message_type === 'image' && (
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <img
                  src={messageToDelete.message.content}
                  alt="To be deleted"
                  style={{ maxWidth: '100%', maxHeight: 150, borderRadius: '8px' }}
                />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                onClick={() => setDeleteConfirmOpen(false)}
                variant="outlined"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={confirmDelete}
                variant="contained"
                color="error"
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : t('delete')}
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 3, width: '100%', height: '88vh' }}>

        <Drawer
          anchor='right'
          open={openDrawer}
          onClose={toggleDrawer}>
          {DrawerBox}
        </Drawer>

        {showFriend && (
          <Box
            sx={{
              width: '100%',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: isError ? '#ff8b8911' : '#f8f9fa',
              overflow: 'hidden',
              border: 1,
              borderColor: isError ? 'error.main' : 'divider',
            }}>
            {selectedFriend && (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    px: { xs: 2, md: 3 },
                    py: { xs: 1.25 },
                    boxShadow: '0px 2px 4px rgba(0,0,0,0.12)',
                    '&:hover': { bgcolor: 'grey.200' },
                  }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <IconButton
                      edge="start"
                      color="inherit"
                      onClick={toggleGroupList}
                      sx={{
                        display: { xs: 'block', md: 'none' }
                      }}
                    >
                      <ArrowBackIcon />
                    </IconButton>
                    <Avatar
                      src={getUserAvatar(selectedFriend.avatar)}
                      sx={{
                        width: { xs: 38, md: 44 },
                        height: { xs: 38, md: 44 },
                        border: 1,
                        borderColor: 'divider',
                        p: 0.25
                      }}
                    >
                      {selectedFriend.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ ml: 1 }}>
                      <Typography variant="h6" fontWeight="600">{selectedFriend.name}</Typography>
                      <Typography sx={{ display: { xs: 'block', md: 'none' } }} variant="caption" color="text.secondary">{status.text}</Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
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
                    // onClick={handleStartCall}
                    />
                  </Box>
                </Box>

                <Box
                  ref={messagesContainerRef}
                  className="messages-area"
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    px: { xs: 1, sm: 2 },
                    py: { xs: 1, sm: 2 },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    minHeight: { xs: '200px', sm: 'auto' },
                    // '&::-webkit-scrollbar': { display: 'none' },
                    // scrollbarWidth: 'none',
                  }}
                >
                  {loadingMore && (
                    <Box display="flex" justifyContent="center" alignItems="center" mt={2}>
                      <CircularProgress />
                    </Box>
                  )}
                  {messages.length === 0 ? (
                    <Box sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '100%',
                      flexDirection: 'column',
                      color: 'text.secondary',
                    }}>
                      <ModeCommentRoundedIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">{t('no_message_yet')}</Typography>
                      <Typography color="text.secondary">{t('say_hello')} {selectedFriend.name}!</Typography>
                    </Box>
                  ) : (
                    messages.map((message) => (
                      <Box
                        key={message.id}
                        data-message-id={message.id}
                        ref={(el) => {
                          if (el) messageRefs.current[message.id] = el;
                        }}
                        sx={{ flexShrink: 0 }}
                      >
                        <ChatMessage
                          message={message}
                          isMine={message.sender_id === profile?.id}
                          onUpdate={handleEditMessage}
                          onDelete={handleDeleteMessage}
                          onForward={() => {
                            setSelectedMessage(message);
                            toggleDrawer();
                          }}
                          onAddReaction={handleAddReaction}
                          onRemoveReaction={handleRemoveReaction}
                          profile={profile}
                          onReply={() => handleReply(message)}
                          userId={user.id}
                        />
                      </Box>
                    ))
                  )}
                </Box>

                {imagePreview && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      border: "1px solid #ddd",
                      borderRadius: 2,
                      p: 1,
                      mb: 1,
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        alignItems: "center",
                      }}
                    >
                      <img
                        src={imagePreview}
                        alt="Preview"
                        style={{
                          width: 60, height: 60, objectFit: "cover", borderRadius: 6
                        }}
                      />
                      <Typography fontWeight={600}>
                        {selectedFileRef.current ? selectedFileRef.current.name : ""}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <IconButton onClick={handleRemoveImagePreview}>
                        <CloseIcon />
                      </IconButton>
                    </Box>
                  </Box>
                )}

                <Box
                  className="input-area"
                  sx={{
                    p: { xs: 1, sm: 2 },
                    borderTop: 1,
                    borderColor: isError ? 'error.main' : 'divider',
                    bgcolor: 'white',
                    display: 'flex',
                    alightItems: 'center',
                    gap: { xs: 0.5, sm: 1.5 },
                    flexShrink: 0,
                    minHeight: { xs: '60px', sm: 'auto' }
                  }}>

                  {replyTo && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 64,
                        right: 0,
                        p: 1,
                        mb: 1,
                        bgcolor: "grey.200",
                        borderRadius: 2,
                        borderLeft: "4px solid #1976d2",
                        display: 'flex',
                        justifyContent: 'space-between',
                        alightItems: 'center',
                        width: '100%'
                      }}
                    >
                      <Box>
                        <Typography variant="caption" fontWeight={600}>
                          Replying to {replyTo.sender.username}
                        </Typography>
                        <Typography variant="body2" noWrap>
                          {replyTo.message_type === 'voice'
                            ? 'Voice message'
                            : replyTo.message_type === 'image'
                              ? 'Photo'
                              : replyTo.content}
                        </Typography>
                      </Box>

                      <IconButton size="small" onClick={cancelReply}>
                        <CloseIcon />
                      </IconButton>
                    </Box>
                  )}

                  {!showTextbox && (
                    <>
                      <input accept="image/*" style={{ display: 'none' }} id="image-upload" type="file" ref={fileInputRef} onChange={handleFileSelect} />
                      <label htmlFor="image-upload">
                        <Button
                          variant='contained'
                          sx={{ minWidth: 30, borderRadius: 2, py: 1.2, px: 1 }}
                          component="span"
                          disabled={!selectedFriend || uploadingImage}>
                          {uploadingImage ? <AttachFileIcon /> : <AttachFileIcon />}
                        </Button>
                      </label>

                      <VoiceRecorder
                        onConfirm={handleVoiceConfirm}
                        onRecordingChange={setIsRecording}
                      />

                      {!isRecording && (
                        <Box sx={{ position: 'relative' }}>
                          <IconButton
                            ref={emojiButtonRef}
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            disabled={!selectedFriend || uploadingImage || isRecording}
                            sx={{
                              fontSize: 50,
                              color: 'orange'
                            }}
                          >
                            {showEmojiPicker ? <EmojiEmotionsIcon /> : <InsertEmoticonIcon />}
                          </IconButton>

                          {showEmojiPicker && (
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
                      )}
                    </>
                  )}

                  {!isRecording && (
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={!selectedFriend ? t('select_friend') : t('type_message')}
                      value={newMessage}
                      onChange={handleInputChange}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && selectedFriend && !isRecording) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      onFocus={() => setShowTextbox(true)}
                      onBlur={() => setShowTextbox(false)}
                      multiline
                      maxRows={3}
                      disabled={!selectedFriend || uploadingImage || isRecording}
                      sx={{
                        bgcolor: 'grey.100',
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      }}
                    />
                  )}

                  {!isRecording && (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleSendMessage}
                      disabled={!selectedFriend || (!newMessage.trim() && !imagePreview)}
                      sx={{ minWidth: 30, borderRadius: 2, py: 1, px: 1.5 }}
                    >
                      <SendIcon />
                    </Button>
                  )}

                </Box>
              </>
            )}
          </Box>
        )}
      </Box>

    </Box>
  );
};

export default MessagesTab;