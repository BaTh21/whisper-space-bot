import {
  Chat as ChatIcon,
  Close as CloseIcon,
  EmojiEmotions as EmojiEmotionsIcon,
  InsertEmoticon as InsertEmoticonIcon,
  Send as SendIcon
} from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CallIcon from '@mui/icons-material/Call';
import SearchIcon from '@mui/icons-material/Search';
import VideocamIcon from '@mui/icons-material/Videocam';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAvatar } from '../../hooks/useAvatar';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  addReactionToMessage,
  sendVoiceMessage as apiSendVoiceMessage,
  checkBlockedStatus,
  deleteImageMessage,
  deleteMessage,
  editMessage,
  getBlockedUsers,
  getFriendsOnlineStatus,
  getMessageReactions,
  getPrivateChat,
  removeReactionFromMessage,
  sendImageMessage,
  uploadImage
} from '../../services/api';
import ChatMessage from '../chat/ChatMessage';
import ForwardMessageDialog from '../chat/ForwardMessageDialog';
import EmojiButton from '../EmojiButton';
import EmojiPicker from '../EmojiPicker';
import { IncomingCallDialog } from '../group/InCommingCallDialog';
import CallDialog from '../group/CallDialog';
import { useAuth } from '../../context/AuthContext';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import VoiceRecorder from '../group/VoiceRecorder';

const getWebSocketBaseUrl = () => {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (!wsUrl) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return apiUrl.replace(/^http/, 'ws');
  }
  return wsUrl;
};
const BASE_URI = getWebSocketBaseUrl();

const MessagesTab = ({ friends, profile, setError, setSuccess, showFriend, selectedFriend, toggleGroupList }) => {
  // const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiButtonRef = useRef(null);
  // const [showFriend, setShowFriend] = useState(false);
  const { t, i18n } = useTranslation();
  const [isOnline, setIsOnline] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastSeenMap, setLastSeenMap] = useState({});

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockStatus, setBlockStatus] = useState({});

  const [callStatus, setCallStatus] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [totalAccepted, setTotalAccepted] = useState(0);
  const [isAudioOnlyCall, setIsAudioOnlyCall] = useState(false);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const remoteStreamsRef = useRef({});
  const { auth } = useAuth();
  const user = auth?.user;
  const usernamesRef = useRef({});
  const avatarRef = useRef({});
  const pendingAnswers = useRef({});
  const pendingCandidates = useRef({})
  const isCallerRef = useRef(false);
  const sentReadReceipts = useRef(new Set());
  const isConnectedRef = useRef(false);
  const sendWsMessageRef = useRef(null);

  const [incomingCall, setIncomingCall] = useState({
    open: false,
    username: "",
    avatar: "",
    fromUserId: null,
    call_type: ""
  });

  const audioBlobRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastMessageCount = useRef(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const tempToRealIdMap = useRef({});
  const cancelReply = () => setReplyTo(null);

  const { getAvatarUrl, getUserInitials, getUserAvatar } = useAvatar();

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
    setMessages([]);
    setNewMessage('');
    setFriendTyping(false);
    setImagePreview(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);

    // open socket / fetch messages here
  }, [selectedFriend]);
  // const toggleShowFriend = () => {
  //   setShowFriend(prev => !prev);
  // }

  const getWsUrl = useCallback(() => {
    if (!selectedFriend) return null;
    const rawToken = localStorage.getItem('accessToken') || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
    return `${BASE_URI}/api/v1/ws/private/${selectedFriend.id}?token=${token}`;
  }, [selectedFriend]);

  const handleWebSocketMessage = useCallback(
    async (data) => {
      const { type } = data;

      if (type === "user_online") {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.add(data.user_id);
          return newSet;
        });

        if (selectedFriend?.id === data.user_id) {
          setIsOnline(true);
        }

        setLastSeenMap(prev => ({
          ...prev,
          [data.user_id]: data.timestamp || new Date().toISOString()
        }));
        return;

      } else if (type === "user_offline") {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.user_id);
          return newSet;
        });

        if (selectedFriend.id === data.user_id) {
          setIsOnline(false);
        }

        const offlineTime = data.last_seen || data.timestamp || new Date().toISOString();
        setLastSeenMap(prev => ({
          ...prev,
          [data.user_id]: offlineTime
        }));

        return;

      } else if (type === "online_users") {
        setOnlineUsers(new Set(data.user_ids || []));
        return;
      }

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
      }

      else if (type === "message_read") {
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === data.message_id) {
              const alreadySeen = msg.seen_by?.some(s => s.user_id === data.reader_id);
              if (alreadySeen) return msg;
              return {
                ...msg,
                is_read: true,
                read_at: data.read_at,
                seen_by: [
                  ...(msg.seen_by || []),
                  {
                    user_id: data.reader_id,
                    username: data.reader_username,
                    avatar_url: data.reader_avatar || '',
                    seen_at: data.read_at
                  }
                ]
              };
            }
            return msg;
          })
        );

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

      } else if (type === "typing") {
        // toast.success("Your friend is typing");
        setFriendTyping(!!data.is_typing);

      } else if (type === "message_deleted") {
        setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
      }

      else if (type === "call_request") {
        if (data.from_user !== user.id) {
          setIncomingCall({
            open: true,
            fromUserId: data.from_user,
            username: data.sender_username,
            avatar: data.avatar_url,
            call_type: data.call_type
          });
          usernamesRef.current[data.from_user] = data.sender_username;
          avatarRef.current[data.from_user] = data.avatar;
        }
        setIsAudioOnlyCall(data.call_type === "voice");
      }

      else if (type === "call_accepted") {
        setCallStatus("In Call");

        if (isCallerRef.current) {
          startWebRTCForCall(isAudioOnlyCall);
        }
      }

      else if (type === "call_ice") {
        const { from_user, candidate } = data;
        const pc = peersRef.current[from_user];

        if (!pc) {
          if (!pendingCandidates.current[from_user]) {
            pendingCandidates.current[from_user] = [];
          }
          pendingCandidates.current[from_user].push(candidate);
          return;
        }

        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding ICE candidate", err);
        }
      }

      else if (type === "call_offer") {
        const fromUserId = data.from_user;
        usernamesRef.current[data.from_user] = data.username;
        avatarRef.current[data.from_user] = data.avatar;

        const audioOnly = data.call_type === "voice" || isAudioOnlyCall;
        setIsAudioOnlyCall(audioOnly);

        await getLocalStream(audioOnly);
        const pc = await getOrCreatePeer(fromUserId);

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendWsMessage({
          type: "call_answer",
          to_user: fromUserId,
          answer
        });
      }

      else if (type === "call_answer") {
        const fromUserId = data.from_user;
        const pc = peersRef.current[fromUserId];
        if (!pc) return;

        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

          if (pendingCandidates.current[fromUserId]) {
            for (const c of pendingCandidates.current[fromUserId]) {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            }
            delete pendingCandidates.current[fromUserId];
          }
        } else {
          pendingAnswers.current[fromUserId] = data.answer;
        }
      }

      else if (type === "call_ended") {

        endWebRTC();

        setCallStatus(
          data.reason === "timeout"
            ? "Call not answered"
            : "Call ended"
        );

        setCallOpen(false);
        setIsAudioOnlyCall(false);
        setIncomingCall({ open: false });
        setTotalAccepted(0);

        return;
      }
    },
    [
      blockedUsers,
      getAvatarUrl,
      friends,
      selectedFriend,
      getUserAvatar,
      setOnlineUsers,
      setLastSeenMap,
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

    if (messages.length === 0 && selectedFriend) {
      loadInitialMessages();
    }
  }, [sendSeenMessage, messages.length, selectedFriend]);

  const handleWebSocketClose = useCallback((event) => {
    console.log('[WS] Closed', event.code, event.reason);
    setFriendTyping(false);
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
        setBlockStatus(statusMap);
      } catch (error) {
        console.error('Error fetching blocked users:', error);
      }
    };

    fetchBlockedUsers();
  }, []);

  const checkIfUserIsBlocked = async (userId) => {
    try {
      const status = await checkBlockedStatus(userId);
      setBlockStatus(prev => ({
        ...prev,
        [userId]: status.is_blocked
      }));
      return status.is_blocked;
    } catch (error) {
      return blockedUsers.some(user => user.id === userId);
    }
  };

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

    const formData = new FormData();
    formData.append('voice_file', blobToSend, 'voice.webm');
    formData.append('duration', Math.max(recordingTime, 1).toString());

    try {
      await apiSendVoiceMessage(selectedFriend.id, formData);
    } catch (err) {
      console.error(err.response?.data || err);
      setError(err.response?.data?.message || 'Failed to send voice');
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

  const loadMessageReactions = async (messageId) => {
    try {
      const response = await getMessageReactions(messageId);
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            reactions: response.reactions || []
          };
        }
        return msg;
      }));
    } catch (err) {
      console.error('Failed to load reactions:', err);
    }
  };

  const handleImageUpload = async (file) => {
    if (!selectedFriend) return;

    const tempId = `temp-img-${Date.now()}`;
    try {
      setUploadingImage(true);
      const result = await uploadImage(selectedFriend.id, file);
      const { url } = result;

      const tempMsg = {
        id: tempId,
        sender_id: profile.id,
        receiver_id: selectedFriend.id,
        content: url,
        message_type: 'image',
        is_read: false,
        created_at: new Date().toISOString(),
        is_temp: true,
        sender: {
          username: profile.username,
          avatar_url: getUserAvatar(profile),
          id: profile.id,
        },
      };

      setMessages((prev) => [...prev, tempMsg]);
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
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('image_too_large_5mb'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
    handleImageUpload(file);
  };

  const handleRemoveImagePreview = () => setImagePreview(null);

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

    setMessages(prev => prev.filter(m => m.id !== id));

    if (!isTemp) {
      try {
        if (isImage) {
          await deleteImageMessage(id);
        } else {
          await deleteMessage(id);
        }
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

  const loadInitialMessages = async () => {
    if (!selectedFriend || messages.length > 0) return;

    try {
      const isBlocked = blockStatus[selectedFriend.id] ||
        await checkIfUserIsBlocked(selectedFriend.id);

      if (isBlocked) {
        setMessages([]);
        setError(`Cannot load messages. ${selectedFriend.username} is blocked.`);
        return;
      }

      const chatMessages = await getPrivateChat(selectedFriend.id);

      if (Array.isArray(chatMessages) && chatMessages.length === 0) {
        const recheckBlocked = await checkIfUserIsBlocked(selectedFriend.id);
        if (recheckBlocked) {
          setMessages([]);
          setError(`Cannot load messages. ${selectedFriend.username} is blocked.`);
          return;
        }
      }

      const filteredMessages = chatMessages.filter(msg => {
        const messageSenderId = msg.sender_id;
        return !blockedUsers.some(blockedUser => blockedUser.id === messageSenderId);
      });

      const enhanced = filteredMessages.map((msg) => {
        const detectMessageType = (message) => {
          if (message.message_type === 'image') return 'image';
          if (message.message_type === 'voice') return 'voice';
          if (message.message_type === 'file') return 'file';
          if (message.message_type === 'text') return 'text';
          if (message.message_type === 'system') return 'system';

          const content = message.content || '';

          const isVoiceUrl =
            content.includes('/voice_messages/') ||
            content.match(/\.(mp3|wav|ogg|webm|m4a|aac|opus|flac|3gp)$/i) ||
            (content.includes('cloudinary.com') && content.includes('/video/upload/'));

          if (isVoiceUrl) return "voice";

          const isImageUrl =
            content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
            (content.includes('cloudinary.com') && content.includes('/image/upload/'));

          return isImageUrl ? "image" : "text";
        };

        const messageType = detectMessageType(msg);

        const content = msg.content;

        const sender = {
          id: msg.sender_id,
          username: msg.sender_id === profile?.id ? profile.username : selectedFriend.username,
          avatar_url: getUserAvatar(msg.sender_id === profile?.id ? profile : selectedFriend),
        };

        const seen_by = msg.seen_by && Array.isArray(msg.seen_by)
          ? msg.seen_by.map(s => ({
            user_id: s.user_id || s.userId,
            username: s.username,
            avatar_url: s.avatar_url || s.avatarUrl,
            seen_at: s.seen_at || s.seenAt,
          }))
          : msg.is_read
            ? [{
              user_id: msg.receiver_id === profile?.id ? selectedFriend.id : profile.id,
              username: msg.receiver_id === profile?.id ? selectedFriend.username : profile.username,
              avatar_url: msg.receiver_id === profile?.id ? getUserAvatar(selectedFriend) : getUserAvatar(profile),
              seen_at: msg.read_at || new Date().toISOString(),
            }]
            : [];

        return {
          ...msg,
          content,
          is_temp: false,
          message_type: messageType,
          sender,
          is_read: msg.is_read || false,
          read_at: msg.read_at || null,
          seen_by,
          voice_duration: msg.voice_duration || 0,
          file_size: msg.file_size || 0,
        };
      });

      setMessages(enhanced.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      setError(null);
    } catch (err) {
      if (err.message?.includes('blocked') || err.response?.data?.detail?.includes('blocked')) {
        setError(`Cannot load messages. ${selectedFriend?.username || 'User'} is blocked.`);

        if (selectedFriend) {
          setBlockStatus(prev => ({
            ...prev,
            [selectedFriend.id]: true
          }));
        }
      } else if (err.response?.status === 403 && err.response?.data?.detail?.includes('Not friends')) {
        setError(`You are not friends with ${selectedFriend?.username || 'this user'}.`);
      } else {
        setError(t('failed_load_messages'));
      }
      console.error(err);
    }
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

  const updateFriendsOnlineStatus = useCallback(async () => {
    try {
      const response = await getFriendsOnlineStatus();
      const friendsList = response.friends || [];

      const onlineIds = new Set();
      const lastSeenData = {};

      friendsList.forEach(friend => {
        if (friend.is_online) {
          onlineIds.add(friend.user_id);
        }
        if (friend.last_seen) {
          lastSeenData[friend.user_id] = friend.last_seen;
        }
      });

      setOnlineUsers(onlineIds);
      setLastSeenMap(lastSeenData);

    } catch (err) {
      console.error('Failed to fetch online status:', err);
    }
  }, []);

  useEffect(() => {
    updateFriendsOnlineStatus();
  }, [updateFriendsOnlineStatus]);

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

      if (imagePreview && selectedFriend) {
        const file = imagePreviewFileRef.current;
        if (file) await handleImageUpload(file);
      }

      setNewMessage('');
      setAudioUrl(null);
      setImagePreview(null);
      setReplyTo(null);

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

  const handleForwardMessage = async (message, selectedFriends) => {

    sendWsMessage({
      type: "forward",
      message_id: message.id,
      target_user_ids: selectedFriends.map(f => f.id),
    });

  };

  const handleForward = (msg) => {
    setForwardingMessage(msg);
    setForwardDialogOpen(true);
  };

  const scrollToBottom = useCallback(() => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    if (messages.length !== lastMessageCount.current) {
      lastMessageCount.current = messages.length;
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (selectedFriend) scrollToBottom();
  }, [selectedFriend, scrollToBottom]);

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

  const getLocalStream = async (isAudioOnly = false) => {
    if (!localStreamRef.current) {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isAudioOnly ? false : { facingMode: "user" }
      });
    }
    return localStreamRef.current;
  };

  const getOrCreatePeer = async (userId) => {
    if (!localStreamRef.current) {
      throw new Error("Local stream must exist before creating PeerConnection");
    }

    let pc = peersRef.current[userId];
    if (pc && pc.signalingState !== "closed") return pc;

    pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (event) => {
      let stream = remoteStreamsRef.current[userId];

      if (!stream) {
        stream = new MediaStream();
        remoteStreamsRef.current[userId] = stream;
      }

      stream.addTrack(event.track);

      setRemoteStreams({ ...remoteStreamsRef.current });

      setTotalAccepted(Object.keys(remoteStreamsRef.current).length);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendWsMessage({
          type: "call_ice",
          to_user: userId,
          candidate: e.candidate
        });
      }
    };

    peersRef.current[userId] = pc;
    return pc;
  };

  const startWebRTCForCall = async (isAudioOnlyCall) => {
    await getLocalStream(isAudioOnlyCall);

    const friendId = selectedFriend.id;
    const pc = await getOrCreatePeer(friendId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendWsMessage({
      type: "call_offer",
      to_user: friendId,
      offer,
      call_type: isAudioOnlyCall ? "voice" : "video"
    });
  };

  const endWebRTC = () => {
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    remoteStreamsRef.current = {};
    setRemoteStreams({});
  };

  const handleStartCall = async () => {
    isCallerRef.current = true;
    await getLocalStream();

    sendWsMessage({
      type: "call_start",
      call_type: "video",
      to_user: selectedFriend.id
    });

    setIsAudioOnlyCall(false);
    setCallStatus("Calling...");
    setCallOpen(true);
  };

  const handleStartVoiceCall = async () => {
    isCallerRef.current = true;

    await getLocalStream(true);

    sendWsMessage({ type: "call_start", call_type: "voice", to_user: selectedFriend.id });

    setIsAudioOnlyCall(true);
    setCallStatus("Calling...");
    setCallOpen(true);
  };

  const handleAcceptCall = async () => {
    isCallerRef.current = false;
    setIncomingCall(prev => ({ ...prev, open: false }));

    await getLocalStream(isAudioOnlyCall);
    await getOrCreatePeer(incomingCall.fromUserId);

    sendWsMessage({
      type: "call_accept",
      to_user: incomingCall.fromUserId
    });

    setCallOpen(true);
    setCallStatus("In Call");
  };

  const handleRejectCall = () => {
    setIncomingCall(prev => ({ ...prev, open: false }));

    sendWsMessage({
      type: "call_reject",
      to_user: incomingCall.fromUserId
    });
  };

  const handleCallEnd = () => {
    sendWsMessage(
      {
        type: "call_end"
      });
    endWebRTC();
    setCallOpen(false);
    setCallStatus("Call ended");
    setRemoteStreams({});
    setTotalAccepted(0);
    setIsAudioOnlyCall(false);
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

        {showFriend && (
          <Box
            sx={{
              width: '100%',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#f8f9fa',
              overflow: 'hidden',
              border: 1,
              borderColor: 'grey.300'
            }}>
            {selectedFriend && (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    px: { xs: 2, md: 3 },
                    py: { xs: 1, md: 2 },
                    boxShadow: 1,
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
                      src={getUserAvatar(selectedFriend)}
                      sx={{
                        width: { xs: 38, md: 44 },
                        height: { xs: 38, md: 44 },
                        border: 1,
                        borderColor: 'divider',
                        p: 0.25
                      }}
                    >
                      {getUserInitials(selectedFriend.username)}
                    </Avatar>
                    <Box sx={{ ml: 1 }}>
                      <Typography variant="h6" fontWeight="600">{selectedFriend.username}</Typography>
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
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: 'green',
                        borderRadius: 1,
                        px: { xs: 0.75, md: 1.5 },
                        py: { xs: 0, md: 0.5 },
                        mr: { xs: 0, md: 1 },
                        gap: { xs: 0, sm: 1 }
                      }}
                    >
                      <Typography
                        sx={{
                          color: 'white',
                          fontSize: { xs: 12, md: 14 },
                          display: { xs: 'block', sm: 'block' }
                        }}
                      >
                        {isOnline ? 'Active' : 'Offline'}
                      </Typography>
                    </Box>
                    <CallIcon
                      sx={{
                        fontSize: { xs: 22, md: 26 },
                        color: 'primary.main',
                        transition: 'transform 1s',
                        '&:hover': {
                          scale: 1.1
                        }
                      }}
                      onClick={handleStartVoiceCall}
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
                      onClick={handleStartCall}
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
                    '&::-webkit-scrollbar': { display: 'none' },
                    scrollbarWidth: 'none',
                  }}
                >
                  {messages.length === 0 ? (
                    <Box sx={{ textAlign: 'center', mt: 16 }}>
                      <ChatIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">{t('no_message_yet')}</Typography>
                      <Typography color="text.secondary">{t('say_hello')} {selectedFriend.username}!</Typography>
                    </Box>
                  ) : (
                    messages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        isMine={message.sender_id === profile?.id}
                        onUpdate={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onForward={handleForward}
                        onAddReaction={handleAddReaction}
                        onRemoveReaction={handleRemoveReaction}
                        onLoadReactions={loadMessageReactions}
                        profile={profile}
                        currentFriend={selectedFriend}
                        getAvatarUrl={getAvatarUrl}
                        getUserInitials={getUserInitials}
                        onCallBack={handleStartCall}
                        onReply={() => { handleReply(message) }}
                        userId={user.id}
                      />
                    ))
                  )}
                </Box>

                {/* Input Area */}
                <Box className="input-area" sx={{
                  p: { xs: 1, sm: 2 },
                  borderTop: 1,
                  borderColor: 'divider',
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
                        width: { xs: '100%', md: 400, lg: '75%' }
                      }}
                    >
                      <Box>
                        <Typography variant="caption" fontWeight={600}>
                          Replying to {replyTo.sender.username}
                        </Typography>
                        <Typography variant="body2" noWrap>
                          {replyTo.message_type === 'voice'
                            ? '🎤 Voice message'
                            : replyTo.message_type === 'image'
                              ? '🖼️ Photo'
                              : replyTo.content}
                        </Typography>
                      </Box>

                      <IconButton size="small" onClick={cancelReply}>
                        <CloseIcon />
                      </IconButton>
                    </Box>
                  )}

                  <input accept="image/*" style={{ display: 'none' }} id="image-upload" type="file" onChange={handleFileSelect} />
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
                            setShowEmojiPicker(false);
                          }}
                          onClose={() => setShowEmojiPicker(false)}
                          anchorEl={emojiButtonRef.current}
                          placement="top-start"
                        />
                      )}
                    </Box>
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
                    <Button variant="contained" color="primary" onClick={handleSendMessage} disabled={!selectedFriend || (!newMessage.trim() && !imagePreview)}
                      sx={{ minWidth: 30, borderRadius: 2, py: 1, px: 1.5 }}
                    >
                      <SendIcon />
                    </Button>
                  )}

                  {imagePreview && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 72,
                        left: 0,
                        right: 0,
                        bgcolor: 'white',
                        p: 2,
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        boxShadow: 6,
                        zIndex: 10
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography fontWeight={600}>Image Preview</Typography>
                        <IconButton onClick={handleRemoveImagePreview}>
                          <CloseIcon />
                        </IconButton>
                      </Box>

                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <img
                          src={imagePreview}
                          alt="Preview"
                          style={{
                            maxWidth: { xs: 100, md: '80%' },
                            maxHeight: 200,
                            borderRadius: 12
                          }}
                        />
                      </Box>
                    </Box>
                  )}

                </Box>
              </>
            )}
          </Box>
        )}
      </Box>

      <ForwardMessageDialog
        open={forwardDialogOpen}
        onClose={() => setForwardDialogOpen(false)}
        message={forwardingMessage}
        friends={friends}
        onForward={handleForwardMessage}
        getAvatarUrl={getAvatarUrl}
        getUserInitials={getUserInitials}
      />

      <IncomingCallDialog
        open={incomingCall.open}
        username={incomingCall.username}
        avatar={incomingCall.avatar}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />

      <CallDialog
        open={callOpen}
        remoteStreams={remoteStreams}
        usernames={usernamesRef.current}
        avatars={avatarRef.current}
        onLocal={localStreamRef.current}
        onCancel={handleCallEnd}
        status={callStatus}
        peersRef={peersRef}
        totalAccepted={totalAccepted}
        isAudioOnly={isAudioOnlyCall}
      />

    </Box>
  );
};

export default MessagesTab;