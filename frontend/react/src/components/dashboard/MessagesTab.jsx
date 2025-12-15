import {
  Chat as ChatIcon,
  Close as CloseIcon,
  EmojiEmotions as EmojiEmotionsIcon,
  Image as ImageIcon,
  InsertEmoticon as InsertEmoticonIcon,
  Send as SendIcon
} from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CallIcon from '@mui/icons-material/Call';
import MicIcon from '@mui/icons-material/Mic';
import SearchIcon from '@mui/icons-material/Search';
import StopIcon from '@mui/icons-material/Stop';
import VideocamIcon from '@mui/icons-material/Videocam';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
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
  sendPrivateMessage,
  uploadImage
} from '../../services/api';
import ChatMessage from '../chat/ChatMessage';
import ForwardMessageDialog from '../chat/ForwardMessageDialog';
import EmojiButton from '../EmojiButton';
import EmojiPicker from '../EmojiPicker';
import { IncomingCallDialog } from '../group/InCommingCallDialog';
import CallDialog from '../group/CallDialog';
import { useAuth } from '../../context/AuthContext';

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
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiButtonRef = useRef(null);
  const [showFriend, setShowFriend] = useState(false);

  const toggleShowFriend = () => {
    setShowFriend(prev => !prev);
  }

  const { t, i18n } = useTranslation();

  const [isRecording, setIsRecording] = useState(false);
  const [voiceSending, setVoiceSending] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const [incomingCall, setIncomingCall] = useState({
    open: false,
    username: "",
    avatar: "",
    fromUserId: null,
    call_type: ""
  });

  console.log("streams", remoteStreams);

  useEffect(() => {
    const mobileStyles = `
    @media (max-width: 599px) {
      .chat-container {
        height: calc(100vh - 80px) !important;
        min-height: 400px;
      }
      
      .messages-area {
        min-height: 200px;
        max-height: calc(100vh - 200px) !important;
        flex: 1;
        overflow-y: auto;
      }
      
      .input-area {
        padding: 8px !important;
        min-height: 60px;
        position: sticky;
        bottom: 0;
        background: white;
        border-top: 1px solid #e0e0e0;
      }
      
      /* Ensure input field is visible */
      .input-area .MuiTextField-root {
        max-height: 44px;
      }
      
      /* Make sure messages don't overflow */
      .messages-area .message-bubble {
        max-width: 85% !important;
      }
    }
    
    @media (max-width: 400px) {
      .chat-container {
        height: calc(100vh - 60px) !important;
      }
      
      .messages-area {
        max-height: calc(100vh - 180px) !important;
      }
    }
  `;

    const styleElement = document.createElement('style');
    styleElement.textContent = mobileStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioBlobRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastMessageCount = useRef(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const tempToRealIdMap = useRef({});

  const { getAvatarUrl, getUserInitials, getUserAvatar } = useAvatar();

  const getWsUrl = useCallback(() => {
    if (!selectedFriend) return null;
    const rawToken = localStorage.getItem('accessToken') || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
    return `${BASE_URI}/api/v1/ws/private/${selectedFriend.id}?token=${token}`;
  }, [selectedFriend]);

  const handleWebSocketMessage = useCallback(
    async (data) => {
      const { type } = data;
      console.log("📡 WebSocket received:", data);

      if (type === "message" && data.sender_id) {
        const isSenderBlocked = blockedUsers.some(user => user.id === data.sender_id);
        if (isSenderBlocked) {
          console.log(`⚠️ Ignoring message from blocked user ${data.sender_id}`);
          return;
        }
      }

      if (type === "user_online") {
        console.log('📱 User came online:', data.user_id);
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.add(data.user_id);
          return newSet;
        });

        // Update last seen map
        setLastSeenMap(prev => ({
          ...prev,
          [data.user_id]: data.timestamp || new Date().toISOString()
        }));

        // Show notification if this is the selected friend
        if (selectedFriend?.id === data.user_id) {
        }

        return; // Don't process further

      } else if (type === "user_offline") {
        console.log('📱 User went offline:', data.user_id);

        // Update online users set
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.user_id);
          return newSet;
        });

        // Update last seen map with offline timestamp
        const offlineTime = data.last_seen || data.timestamp || new Date().toISOString();
        setLastSeenMap(prev => ({
          ...prev,
          [data.user_id]: offlineTime
        }));

        return; // Don't process further

      } else if (type === "online_users") {
        // Received list of online users in the chat
        console.log('👥 Online users list:', data.user_ids);
        setOnlineUsers(new Set(data.user_ids || []));
        return; // Don't process further
      }

      // === REACTION HANDLING ===
      if (type === "reaction_added") {
        console.log('➕ Reaction added:', data);

        setMessages(prev => prev.map(msg => {
          if (msg.id === data.message_id) {
            const currentReactions = msg.reactions || [];
            // Check if reaction already exists
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
        console.log('➖ Reaction removed:', data);

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

      // 1. New real message from server
      if (type === "message") {
        const detectMessageType = (msgData) => {
          // Use backend message_type first
          if (msgData.message_type === "image") return "image";
          if (msgData.message_type === "voice") return "voice";
          if (msgData.message_type === "file") return "file";
          if (msgData.message_type === "text") return "text";

          const content = msgData.content || "";

          // Voice message detection for Cloudinary
          const isVoiceUrl =
            content.includes('/voice_messages/') ||
            content.match(/\.(mp3|wav|ogg|webm|m4a|aac|opus|flac|3gp)$/i) ||
            (content.includes('cloudinary.com') && content.includes('/video/upload/'));

          if (isVoiceUrl) return "voice";

          // Image detection
          const isImageUrl =
            content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
            (content.includes('cloudinary.com') && content.includes('/image/upload/'));

          return isImageUrl ? "image" : "text";
        };

        const messageType = detectMessageType(data);

        const content = data.content;

        const realMessage = {
          ...data,
          id: data.id,
          temp_id: data.temp_id || null,
          content: content,
          is_temp: false,
          message_type: messageType,
          sender: {
            id: data.sender_id,
            username: data.sender_username,
            avatar_url: getAvatarUrl(data.avatar_url),
          },
          is_read: data.is_read || false,
          read_at: data.read_at || null,
          seen_by: data.seen_by || [],
          created_at: data.created_at,
          updated_at: data.updated_at || data.created_at,
          edited: !!data.updated_at && data.updated_at !== data.created_at,
          voice_duration: data.voice_duration || 0,
          file_size: data.file_size || 0,
        };

        setMessages((prev) => {
          let updated = [...prev];

          // Replace temporary message if temp_id matches
          if (data.temp_id) {
            const tempIndex = updated.findIndex(
              (m) =>
                m.is_temp &&
                (m.temp_id === data.temp_id || m.id === data.temp_id)
            );

            if (tempIndex !== -1) {
              tempToRealIdMap.current[data.temp_id] = data.id;
              updated[tempIndex] = realMessage;
              return updated.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            }
          }

          // Fallback: if no temp_id, avoid duplicates by real ID
          const exists = updated.some((m) => m.id === data.id);
          if (!exists) {
            updated.push(realMessage);
          }

          return updated.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });

        // 2. REAL-TIME SEEN STATUS UPDATES - FIXED
      } else if (type === "new_call_message") {
        const detectMessageType = (msgData) => {
          // Use backend message_type first
          if (msgData.message_type === "image") return "image";
          if (msgData.message_type === "voice") return "voice";
          if (msgData.message_type === "file") return "file";
          if (msgData.message_type === "text") return "text";

          const content = msgData.content || "";

          // Voice message detection for Cloudinary
          const isVoiceUrl =
            content.includes('/voice_messages/') ||
            content.match(/\.(mp3|wav|ogg|webm|m4a|aac|opus|flac|3gp)$/i) ||
            (content.includes('cloudinary.com') && content.includes('/video/upload/'));

          if (isVoiceUrl) return "voice";

          // Image detection
          const isImageUrl =
            content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
            (content.includes('cloudinary.com') && content.includes('/image/upload/'));

          return isImageUrl ? "image" : "text";
        };

        const messageType = detectMessageType(data);

        const content = data.content;

        const realMessage = {
          ...data,
          id: data.id,
          temp_id: data.temp_id || null,
          content: content,
          is_temp: false,
          message_type: messageType,
          sender: {
            id: data.sender_id,
            username: data.sender_username,
            avatar_url: getAvatarUrl(data.avatar_url),
          },
          is_read: data.is_read || false,
          read_at: data.read_at || null,
          seen_by: data.seen_by || [],
          created_at: data.created_at,
          updated_at: data.updated_at || data.created_at,
          edited: !!data.updated_at && data.updated_at !== data.created_at,
          voice_duration: data.voice_duration || 0,
          file_size: data.file_size || 0,
        };

        setMessages((prev) => {
          let updated = [...prev];

          // Replace temporary message if temp_id matches
          if (data.temp_id) {
            const tempIndex = updated.findIndex(
              (m) =>
                m.is_temp &&
                (m.temp_id === data.temp_id || m.id === data.temp_id)
            );

            if (tempIndex !== -1) {
              tempToRealIdMap.current[data.temp_id] = data.id;
              updated[tempIndex] = realMessage;
              return updated.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            }
          }

          // Fallback: if no temp_id, avoid duplicates by real ID
          const exists = updated.some((m) => m.id === data.id);
          if (!exists) {
            updated.push(realMessage);
          }

          return updated.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });

      } else if (type === "read_receipt") {
        console.log("👀 REAL-TIME: Read receipt received", data);

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === data.message_id) {
              const currentSeenBy = msg.seen_by || [];
              const readerId = data.reader_id || data.user_id;

              // Check if this user already marked as seen
              const alreadySeen = currentSeenBy.some(s => s.user_id === readerId);

              if (!alreadySeen && readerId) {
                console.log(`✅ REAL-TIME: Marking message ${data.message_id} as seen by user ${readerId}`);

                // Get reader info - IMPORTANT: Use friends list or selectedFriend
                const reader = friends.find(f => f.id === readerId) || selectedFriend;

                return {
                  ...msg,
                  is_read: true,
                  read_at: data.read_at || new Date().toISOString(),
                  seen_by: [
                    ...currentSeenBy,
                    {
                      user_id: readerId,
                      username: reader?.username || 'Friend',
                      avatar_url: getUserAvatar(reader),
                      seen_at: data.read_at || new Date().toISOString(),
                    },
                  ],
                };
              }
            }
            return msg;
          })
        );

        // 3. Message updated with seen_by information
      } else if (type === "message_updated") {
        console.log("🔄 Message updated with seen info:", data);

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
              // If seen_by is provided, update it
              if (data.seen_by) {
                console.log("👀 Updating seen_by for message:", msg.id);
                return {
                  ...msg,
                  content: data.content || msg.content,
                  message_type: data.message_type || msg.message_type,
                  updated_at: data.updated_at,
                  edited: true,
                  is_read: data.is_read !== undefined ? data.is_read : msg.is_read,
                  read_at: data.read_at || msg.read_at,
                  seen_by: Array.isArray(data.seen_by) ? data.seen_by : msg.seen_by,
                };
              }

              // Regular message update
              return {
                ...msg,
                content: data.content || msg.content,
                message_type: data.message_type || msg.message_type,
                updated_at: data.updated_at,
                edited: true,
              };
            }
            return msg;
          })
        );

        // 4. Typing indicator
      } else if (type === "typing") {
        setFriendTyping(!!data.is_typing);

        // 5. Message deleted
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
        if (data.call_type === "voice") {
          setIsAudioOnlyCall(true);
        }
      }

      else if (type === "call_accepted") {
        setCallStatus("In Call");

        if (isCallerRef.current) {
          startWebRTCForCall();
        }

        return;
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

        await getLocalStream(isAudioOnlyCall);
        const pc = await getOrCreatePeer(fromUserId);

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendWsMessage({
          type: "call_answer",
          to_user: fromUserId,
          username: data.username,
          avatar: data.avatar,
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

      else if (type === "call_rejected") {

        setCallStatus("Call rejected");
        return;
      }

      else if (type === "call_ended") {

        endWebRTC();

        setCallStatus(
          data.reason === "timeout"
            ? "Call not answered"
            : "Call ended"
        );
        setIsAudioOnlyCall(false);

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
      setError(null);
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

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        const blockedUsersList = await getBlockedUsers();
        setBlockedUsers(blockedUsersList);

        // Initialize block status for all friends
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

  // Add this function to check if a specific user is blocked
  const checkIfUserIsBlocked = async (userId) => {
    try {
      const status = await checkBlockedStatus(userId);
      setBlockStatus(prev => ({
        ...prev,
        [userId]: status.is_blocked
      }));
      return status.is_blocked;
    } catch (error) {
      console.error('Error checking blocked status:', error);
      // Fallback to checking local blockedUsers list
      return blockedUsers.some(user => user.id === userId);
    }
  };

  useEffect(() => {
    if (!messagesContainerRef.current || !selectedFriend || !isConnected) return;

    const container = messagesContainerRef.current;
    let observedMessages = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        const messagesToMarkAsRead = [];

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = parseInt(entry.target.getAttribute('data-message-id'));
            const isUnread = entry.target.getAttribute('data-is-unread') === 'true';
            const isFriendMessage = entry.target.getAttribute('data-is-friend') === 'true';

            if (messageId && isUnread && isFriendMessage && !observedMessages.has(messageId)) {
              messagesToMarkAsRead.push(messageId);
              observedMessages.add(messageId);
            }
          }
        });

        // Process messages to mark as read
        if (messagesToMarkAsRead.length > 0) {
          console.log(`👁️ Auto-marking ${messagesToMarkAsRead.length} messages as read:`, messagesToMarkAsRead);
          messagesToMarkAsRead.forEach((messageId) => {
            markMessageAsRead(messageId);
          });
        }
      },
      {
        root: container,
        rootMargin: '0px 0px -100px 0px', // Trigger when 100px from bottom
        threshold: 0.8, // 80% visible
      }
    );

    const markMessageAsRead = async (messageId) => {
      try {
        console.log(`📨 SENDING read receipt for message ${messageId}`);

        // Send read receipt via WebSocket
        const success = sendWsMessage({
          type: 'read',
          message_id: messageId,
        });

        if (!success) {
          console.warn('❌ Failed to send WebSocket read receipt');
          observedMessages.delete(messageId);
          return;
        }

        // OPTIMISTIC UPDATE - Update UI immediately
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              const currentSeenBy = msg.seen_by || [];
              const alreadySeen = currentSeenBy.some(s => s.user_id === selectedFriend.id);

              if (!alreadySeen) {
                console.log(`✅ OPTIMISTIC: Marking message ${messageId} as read`);
                return {
                  ...msg,
                  is_read: true,
                  read_at: new Date().toISOString(),
                  seen_by: [
                    ...currentSeenBy,
                    {
                      user_id: selectedFriend.id,
                      username: selectedFriend.username,
                      avatar_url: getUserAvatar(selectedFriend),
                      seen_at: new Date().toISOString(),
                    },
                  ],
                };
              }
            }
            return msg;
          })
        );
      } catch (error) {
        console.error('❌ Failed to mark message as read:', error);
        // Remove from observed so it can be retried
        observedMessages.delete(messageId);
      }
    };

    // Observe all unread friend messages
    const unreadFriendMessages = container.querySelectorAll(
      `[data-message-id][data-is-unread="true"][data-is-friend="true"]`
    );

    console.log(`👀 Observing ${unreadFriendMessages.length} unread messages`);
    unreadFriendMessages.forEach((el) => {
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
      observedMessages.clear();
    };
  }, [messages, selectedFriend, isConnected, sendWsMessage, getUserAvatar]);

  useEffect(() => {
    if (selectedFriend && isConnected && messages.length > 0) {
      // Find unread messages from friend
      const unreadMessages = messages.filter(
        msg => !msg.is_temp &&
          !msg.is_read &&
          msg.sender_id === selectedFriend.id
      );

      // Mark all as read
      if (unreadMessages.length > 0) {
        console.log(`📚 Marking ${unreadMessages.length} messages as read on chat open`);

        unreadMessages.forEach(msg => {
          sendWsMessage({
            type: 'read',
            message_id: msg.id,
          });
        });

        // Optimistic update for all messages
        setMessages(prev =>
          prev.map(msg => {
            if (!msg.is_temp && !msg.is_read && msg.sender_id === selectedFriend.id) {
              const currentSeenBy = msg.seen_by || [];
              const alreadySeen = currentSeenBy.some(s => s.user_id === selectedFriend.id);

              if (!alreadySeen) {
                return {
                  ...msg,
                  is_read: true,
                  read_at: new Date().toISOString(),
                  seen_by: [
                    ...currentSeenBy,
                    {
                      user_id: selectedFriend.id,
                      username: selectedFriend.username,
                      avatar_url: getUserAvatar(selectedFriend),
                      seen_at: new Date().toISOString(),
                    },
                  ],
                };
              }
            }
            return msg;
          })
        );
      }
    }
  }, [selectedFriend, messages.length, isConnected, sendWsMessage, getUserAvatar]);

  const startRecording = async () => {
    if (!selectedFriend) {
      setError('Please select a friend first');
      return;
    }
    if (isRecording) return;

    try {
      audioBlobRef.current = null;
      setAudioUrl(null);
      setRecordingTime(0);
      setVoiceSending(false);
      setIsUploadingVoice(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1,
        }
      });

      const supportedTypes = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];
      let selectedType = 'audio/webm';
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedType = type;
          break;
        }
      }

      const options = { mimeType: selectedType, audioBitsPerSecond: 128000 };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks = [];
      let isStopped = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !isStopped) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (isStopped) return;
        isStopped = true;

        if (audioChunks.length === 0) {
          cleanupRecording();
          return;
        }

        const blob = new Blob(audioChunks, { type: selectedType });
        audioBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        cleanupStream();
        setIsRecording(false);
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError('Recording failed: ' + event.error.name);
        cleanupRecording();
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 120) {
            stopRecording();
            setError('Recording stopped automatically after 2 minutes');
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setIsRecording(false);
      setRecordingTime(0);
      audioBlobRef.current = null;
      setAudioUrl(null);

      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please check your audio device.');
      } else {
        setError('Microphone access failed: ' + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cleanupStream = () => {
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const cleanupRecording = () => {
    if (isRecording) setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    cleanupStream();
  };

  const cancelRecording = () => {
    if (isRecording) stopRecording();
    setTimeout(() => {
      audioBlobRef.current = null;
      setAudioUrl(null);
      setRecordingTime(0);
      setVoiceSending(false);
      setIsUploadingVoice(false);
    }, 100);
  };

  const quickSendVoice = () => {
    if (!isRecording || voiceSending) return;
    stopRecording();

    let attempts = 0;
    const maxAttempts = 40;
    const checkBlob = setInterval(() => {
      attempts++;
      if (audioBlobRef.current && !voiceSending) {
        clearInterval(checkBlob);
        sendVoiceMessage();
      }
      if (attempts >= maxAttempts || !audioBlobRef.current) {
        clearInterval(checkBlob);
      }
    }, 50);
  };

  const sendVoiceMessage = async () => {
    if (voiceSending || isUploadingVoice || !audioBlobRef.current || !selectedFriend) return;

    const blobToSend = audioBlobRef.current;
    audioBlobRef.current = null;
    setAudioUrl(null);

    setVoiceSending(true);
    setIsUploadingVoice(true);

    // Define tempId FIRST
    const tempId = `temp-voice-${Date.now()}-${Math.random()}`;

    // Create temp message with FULL sender info
    const tempMsg = {
      id: tempId,
      temp_id: tempId,
      content: 'Voice message...',
      message_type: 'voice',
      is_temp: true,
      is_read: false,
      created_at: new Date().toISOString(),
      voice_duration: recordingTime,
      file_size: blobToSend.size,
      sender_id: profile.id,
      sender: {
        id: profile.id,
        username: profile.username,
        avatar_url: getUserAvatar(profile),
      },
      seen_by: [],
      _uniqueId: Date.now() + Math.random(),
    };

    // Add optimistic temp message
    setMessages(prev => {
      const withoutTemp = prev.filter(msg => !msg.is_temp);
      return [...withoutTemp, tempMsg];
    });

    try {
      const formData = new FormData();

      // Use the blob directly - backend will handle format conversion
      formData.append('voice_file', blobToSend, `voice-${Date.now()}.webm`);
      formData.append('duration', recordingTime.toString());

      // Optional: send temp_id to backend for WebSocket replacement
      if (tempId) {
        formData.append('temp_id', tempId);
      }

      console.log('🎤 Sending voice message:', {
        duration: recordingTime,
        fileSize: blobToSend.size,
        fileType: blobToSend.type
      });

      const sentMessage = await apiSendVoiceMessage(selectedFriend.id, formData);

      console.log('✅ Voice message sent successfully:', sentMessage);

      // Replace temp message with real one
      setMessages(prev => {
        return prev.map(msg =>
          msg.id === tempId || msg.temp_id === tempId
            ? {
              ...sentMessage,
              is_temp: false,
              sender: {
                ...sentMessage.sender,
                avatar_url: getAvatarUrl(sentMessage.sender?.avatar_url)
              }
            }
            : msg
        );
      });

      setSuccess(t('voice_message_sent'));
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('❌ Voice message send failed:', err);
      setError(err.message || 'Failed to send voice message');

      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId && msg.temp_id !== tempId));
    } finally {
      setIsUploadingVoice(false);
      setVoiceSending(false);
      setRecordingTime(0);
    }
  };
  const handleAddReaction = async (messageId, emoji) => {
    try {
      const reaction = await addReactionToMessage(messageId, { emoji });

      // Send WebSocket update
      sendWsMessage({
        type: 'reaction_add',
        message_id: messageId,
        emoji: emoji
      });

      // Optimistic update
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

  // Remove reaction from message
  const handleRemoveReaction = async (messageId, reactionId) => {
    try {
      await removeReactionFromMessage(messageId, reactionId);

      // Send WebSocket update
      sendWsMessage({
        type: 'reaction_remove',
        message_id: messageId,
        reaction_id: reactionId
      });

      // Optimistic update
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

  // Load reactions for a message
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
      // Check if user is blocked before loading messages
      const isBlocked = blockStatus[selectedFriend.id] ||
        await checkIfUserIsBlocked(selectedFriend.id);

      if (isBlocked) {
        // Don't load messages if user is blocked
        setMessages([]);
        setError(`Cannot load messages. ${selectedFriend.username} is blocked.`);
        return;
      }

      const chatMessages = await getPrivateChat(selectedFriend.id);

      // Check if backend returned blocked status
      if (Array.isArray(chatMessages) && chatMessages.length === 0) {
        // Might be blocked, re-check status
        const recheckBlocked = await checkIfUserIsBlocked(selectedFriend.id);
        if (recheckBlocked) {
          setMessages([]);
          setError(`Cannot load messages. ${selectedFriend.username} is blocked.`);
          return;
        }
      }

      // Filter out any messages from blocked users (additional safety)
      const filteredMessages = chatMessages.filter(msg => {
        const messageSenderId = msg.sender_id;
        return !blockedUsers.some(blockedUser => blockedUser.id === messageSenderId);
      });

      const enhanced = filteredMessages.map((msg) => {
        const detectMessageType = (message) => {
          // Use backend message_type first
          if (message.message_type === 'image') return 'image';
          if (message.message_type === 'voice') return 'voice';
          if (message.message_type === 'file') return 'file';
          if (message.message_type === 'text') return 'text';

          const content = message.content || '';

          // Voice message detection
          const isVoiceUrl =
            content.includes('/voice_messages/') ||
            content.match(/\.(mp3|wav|ogg|webm|m4a|aac|opus|flac|3gp)$/i) ||
            (content.includes('cloudinary.com') && content.includes('/video/upload/'));

          if (isVoiceUrl) return "voice";

          // Image detection
          const isImageUrl =
            content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
            (content.includes('cloudinary.com') && content.includes('/image/upload/'));

          return isImageUrl ? "image" : "text";
        };

        const messageType = detectMessageType(msg);

        // Use content directly - backend provides proper Cloudinary URL
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
      setError(null); // Clear any previous errors
    } catch (err) {
      // Check if error is about blocking
      if (err.message?.includes('blocked') || err.response?.data?.detail?.includes('blocked')) {
        setError(`Cannot load messages. ${selectedFriend?.username || 'User'} is blocked.`);

        // Update blocked status
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

  const handleSelectFriend = async (friend) => {
    // Check if user is blocked - make this asynchronous
    const isBlocked = blockStatus[friend.id] || await checkIfUserIsBlocked(friend.id);

    if (isBlocked) {
      setError(`You have blocked ${friend.username}. Unblock them to chat.`);
      return;
    }

    if (selectedFriend?.id === friend?.id) return;
    if (selectedFriend) closeConnection(1000, 'Switching friends');

    setSelectedFriend(friend);
    setMessages([]);
    setNewMessage('');
    setFriendTyping(false);
    setImagePreview(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
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

  // Add this effect to fetch online status on mount and set up interval
  useEffect(() => {
    updateFriendsOnlineStatus();
  }, [updateFriendsOnlineStatus]);

  // Add this effect to handle real-time WebSocket status updates
  useEffect(() => {
    if (!isConnected || !selectedFriend) return;

    const handleStatusMessage = (data) => {
      if (data.type === 'user_online') {
        console.log('📱 User came online:', data.user_id);
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.add(data.user_id);
          return newSet;
        });

        // Show notification if this is the selected friend
        if (selectedFriend?.id === data.user_id) {
          setSuccess(`${selectedFriend.username} is now online`);
          setTimeout(() => setSuccess(''), 2000);
        }

      } else if (data.type === 'user_offline') {
        console.log('📱 User went offline:', data.user_id);
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.user_id);
          return newSet;
        });

        setLastSeenMap(prev => ({
          ...prev,
          [data.user_id]: data.last_seen || new Date().toISOString()
        }));
      } else if (data.type === 'online_users') {
        // Received list of online users in the chat
        setOnlineUsers(new Set(data.user_ids || []));
      }
    };

    const ws = new WebSocket(getWsUrl());
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'user_online' || data.type === 'user_offline' || data.type === 'online_users') {
          handleStatusMessage(data);
        }
      } catch (err) {
        console.error('Failed to parse status message:', err);
      }
    };

    return () => ws.close();
  }, [isConnected, selectedFriend, getWsUrl]);

  const sendTextMessage = async () => {
    if (selectedFriend && (blockStatus[selectedFriend.id] ||
      blockedUsers.some(user => user.id === selectedFriend.id))) {
      setError(t(`cannot_send_blocked ${selectedFriend.username}`));
      return;
    }
    const content = newMessage.trim();
    if (!content || !selectedFriend) return;

    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      sender_id: profile.id,
      receiver_id: selectedFriend.id,
      content: content,
      message_type: 'text',
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
    setNewMessage('');

    if (audioUrl) {
      setAudioUrl(null);
      setRecordingTime(0);
    }

    const payload = {
      type: 'message',
      content: content,
      message_type: 'text',
    };

    if (!sendWsMessage(payload)) {
      try {
        const sent = await sendPrivateMessage(selectedFriend.id, payload);
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== tempId)
            .concat({
              ...sent,
              is_temp: false,
              sender: {
                username: profile.username,
                avatar_url: getUserAvatar(profile),
                id: profile.id,
              },
            })
        );
      } catch (err) {
        setError(err.message || 'Failed to send');
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setNewMessage(content);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !audioUrl && !imagePreview) return;
    if (newMessage.trim()) await sendTextMessage();
    setNewMessage('');
    setAudioUrl(null);
    setImagePreview(null);
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim() && selectedFriend && isConnected) {
      handleTypingStart();
    }
  };
  const handleForwardMessage = async (message, friend) => {
    try {
      if (!message || !friend) {
        setError('Invalid message or friend');
        return;
      }

      // Determine message type
      let messageType = message.message_type;
      if (!messageType) {
        // Fallback detection
        if (message.content.includes('/voice_messages/') ||
          message.content.match(/\.(mp3|wav|ogg|webm|m4a)$/i)) {
          messageType = 'voice';
        } else if (message.content.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          messageType = 'image';
        } else {
          messageType = 'text';
        }
      }

      const payload = {
        content: message.content,
        message_type: messageType,
        is_forwarded: true,
        original_sender: message.sender?.username || profile?.username || 'Unknown',
      };

      // Add voice-specific fields if it's a voice message
      if (messageType === 'voice') {
        payload.voice_duration = message.voice_duration;
        payload.file_size = message.file_size;
      }

      setForwardDialogOpen(false);
      setForwardingMessage(null);
      setSuccess(t(`message_forwarded ${friend.username}`));
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(t('failed_forward_message'));
    }
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

  const getConnectionStatus = () => {
    const unread = messages.filter(
      (m) => !m.is_read && m.sender_id === selectedFriend?.id
    ).length;

    // Check if friend is online
    const friendIsOnline = selectedFriend && onlineUsers.has(selectedFriend.id);

    if (friendTyping) return {
      text: 'Typing...',
      color: 'info.main',
      icon: 'typing'
    };

    if (!isConnected) return {
      text: reconnectAttempts > 0 ? `Reconnecting... (${reconnectAttempts})` : 'Connecting...',
      color: 'warning.main',
      icon: 'disconnected'
    };

    if (friendIsOnline) return {
      text: `Online • ${unread} unread`,
      color: 'success.main',
      icon: 'online'
    };

    // Friend is offline
    let offlineText = 'Offline';
    if (lastSeenMap[selectedFriend?.id]) {
      const lastSeen = new Date(lastSeenMap[selectedFriend.id]);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));

      if (diffMinutes < 1) {
        offlineText = 'Just now';
      } else if (diffMinutes < 60) {
        offlineText = `${diffMinutes}m ago`;
      } else if (diffMinutes < 1440) {
        const hours = Math.floor(diffMinutes / 60);
        offlineText = `${hours}h ago`;
      } else {
        const days = Math.floor(diffMinutes / 1440);
        offlineText = `${days}d ago`;
      }
    }

    return {
      text: `Last seen ${offlineText} • ${unread} unread`,
      color: 'text.secondary',
      icon: 'offline'
    };
  };

  const status = selectedFriend ? getConnectionStatus() : { text: 'Online', color: 'success.main' };

  const handleEditMessage = async (messageId, newContent) => {
    if (!newContent.trim()) return;

    // Find message by real ID or temp_id
    const message = messages.find(
      (m) => m.id === messageId || m.temp_id === messageId
    );
    if (!message) return;

    const oldContent = message.content;

    // Get REAL message ID (even if user clicked on a temp message)
    const realMessageId = tempToRealIdMap.current[messageId] || messageId;

    // Optimistic update — show edit instantly
    setMessages((prev) =>
      prev.map((m) => {
        const matches = m.id === messageId || m.id === realMessageId || m.temp_id === messageId;
        if (matches) {
          return {
            ...m,
            content: newContent,
            updated_at: new Date().toISOString(),
            edited: true,
            // Preserve other important fields
            message_type: m.message_type,
            sender: m.sender,
            is_temp: m.is_temp,
          };
        }
        return m;
      })
    );

    try {
      // Use the REAL ID to edit
      await editMessage(realMessageId, newContent);

      setSuccess(t("message_edited"));
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error("Edit failed:", err);
      setError(t("failed_edit_message"));

      // Revert on error - more robust revert
      setMessages((prev) =>
        prev.map((m) => {
          const matches = m.id === messageId || m.id === realMessageId || m.temp_id === messageId;
          if (matches) {
            return {
              ...m,
              content: oldContent,
              updated_at: m.created_at, // Reset to original
              edited: false,
            };
          }
          return m;
        })
      );
      setTimeout(() => setError(null), 3000);
    }
  };

  useEffect(() => {
    const editedMessages = messages.filter(m => m.edited);
    if (editedMessages.length > 0) {
      console.log("📝 Currently edited messages:", editedMessages);
    }
  }, [messages]);

  const getLocalStream = async (isAudioOnly = false) => {
    if (!localStreamRef.current) {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: !isAudioOnly
      });
    }
    return localStreamRef.current;
  };

  const getOrCreatePeer = async (userId) => {
    let pc = peersRef.current[userId];
    if (pc && pc.signalingState !== "closed") return pc;

    pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

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

  const startWebRTCForCall = async () => {
    await getLocalStream(isAudioOnlyCall);

    const friendId = selectedFriend.id;
    const pc = await getOrCreatePeer(friendId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendWsMessage({
      type: "call_offer",
      to_user: friendId,
      offer
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
    await getLocalStream(true);

    sendWsMessage({ type: "call_start", call_type: "voice" });

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
    sendWsMessage({ type: "call_end" });
    setCallOpen(false);
    setCallStatus("");
    setRemoteStreams({});
    setTotalAccepted(0);
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

        {(!showFriend || !isMobile) && (
          <Box
            sx={{
              width: { xs: '100%', md: 300 },
              borderColor: 'divider',
              overflow: 'auto',
            }}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('friends')}
              </Typography>
              <Chip
                label={`${onlineUsers.size} online`}
                size="small"
                color="success"
                variant="outlined"
              />
            </Box>
            <Box>
              <TextField
                sx={{ width: "100%" }}
                id="outlined-member-search"
                label={t('search_friend')}
                variant="outlined"
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton>
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <List sx={{ mt: 2 }}>
              {friends.map((friend) => {
                const isOnline = onlineUsers.has(friend.id);
                const lastSeen = lastSeenMap[friend.id] || friend.last_seen;

                let lastSeenText = '';
                if (!isOnline && lastSeen) {
                  const lastSeenDate = new Date(lastSeen);
                  const now = new Date();
                  const diffMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

                  if (diffMinutes < 1) {
                    lastSeenText = 'just now';
                  } else if (diffMinutes < 60) {
                    lastSeenText = `${diffMinutes}m ago`;
                  } else if (diffMinutes < 1440) {
                    const hours = Math.floor(diffMinutes / 60);
                    lastSeenText = `${hours}h ago`;
                  } else {
                    const days = Math.floor(diffMinutes / 1440);
                    lastSeenText = `${days}d ago`;
                  }
                }

                return (
                  <ListItem
                    key={friend.id}
                    selected={selectedFriend?.id === friend.id}
                    onClick={() => {
                      setShowFriend(true);
                      handleSelectFriend(friend);
                    }}
                    sx={{
                      borderRadius: '12px',
                      mb: 1,
                      px: 2,
                      width: '100%',
                      backgroundColor: 'white',
                      '&:hover': { bgcolor: 'action.hover' },
                      '&.Mui-selected': {
                        bgcolor: 'primary.light',
                        color: 'primary.contrastText',
                        '& .online-indicator': {
                          borderColor: 'primary.contrastText'
                        }
                      },
                    }}
                  >
                    <ListItemAvatar sx={{ position: 'relative' }}>
                      <Avatar src={getUserAvatar(friend)}>
                        {getUserInitials(friend.username)}
                      </Avatar>
                      {isOnline && (
                        <Box
                          className="online-indicator"
                          sx={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: '#4CAF50',
                            border: '2px solid white',
                            animation: 'pulse 2s infinite'
                          }}
                        />
                      )}
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {friend.username}
                          {isOnline ? (
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{
                                color: '#4CAF50',
                                fontWeight: 500,
                                fontSize: '0.7rem'
                              }}
                            >
                              • Online
                            </Typography>
                          ) : null}
                        </Box>
                      }
                      secondary={
                        isOnline
                          ? 'Active now'
                          : lastSeenText
                            ? `Last seen ${lastSeenText}`
                            : friend.email
                      }
                      secondaryTypographyProps={{
                        sx: {
                          fontSize: '0.75rem',
                          color: isOnline ? '#4CAF50' : 'text.secondary'
                        }
                      }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
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
                    px: { xs: 0.5, md: 2 },
                    py: 1,
                    boxShadow: 1
                  }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <IconButton
                      onClick={toggleShowFriend}
                      sx={{
                        display: { xs: 'block', md: 'none' }
                      }}
                    >
                      <ArrowBackIcon />
                    </IconButton>
                    <Avatar src={getUserAvatar(selectedFriend)} />
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
                    <Chip label={status.text} size="small" sx={{ bgcolor: status.color, color: 'white', display: { xs: 'none', md: 'block' } }} />
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
                      />
                    ))
                  )}
                </Box>

                {/* Input Area */}
                <Box className="input-area" sx={{
                  p: { xs: 4, sm: 2 },
                  borderTop: 1,
                  borderColor: 'divider',
                  bgcolor: 'white',
                  display: 'flex',
                  gap: { xs: 1, sm: 1.5 },
                  alignItems: 'flex-end',
                  flexShrink: 0,
                  minHeight: { xs: '60px', sm: 'auto' }
                }}>
                  {/* Recording UI */}
                  {isRecording && (
                    <Box sx={{ position: 'absolute', bottom: '100%', left: 0, right: 0, bgcolor: 'error.main', color: 'white', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'white', animation: 'pulse 1.5s infinite' }} />
                        <Typography>Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</Typography>
                      </Box>
                      <Button variant="contained" color="inherit" size="small" startIcon={<StopIcon />} onClick={stopRecording}>
                        {t('stop')}
                      </Button>
                    </Box>
                  )}

                  {audioUrl && !isRecording && (
                    <Box sx={{ position: 'absolute', bottom: '100%', left: 0, right: 0, bgcolor: voiceSending ? 'grey.500' : 'success.main', color: 'white', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <MicIcon />
                        <Typography>{voiceSending ? 'Sending...' : `Recorded • ${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')}`}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button variant="outlined" size="small" onClick={cancelRecording} disabled={voiceSending}>{t('cancel')}</Button>
                        <Button variant="contained" size="small" onClick={sendVoiceMessage} disabled={voiceSending || isUploadingVoice} startIcon={isUploadingVoice ? <CircularProgress size={16} /> : <SendIcon />}>
                          {isUploadingVoice ? 'Sending...' : t('send')}
                        </Button>
                      </Box>
                    </Box>
                  )}

                  <IconButton onClick={isRecording ? stopRecording : startRecording} disabled={!selectedFriend || uploadingImage}
                    sx={{ color: isRecording ? 'error.main' : (audioUrl ? 'success.main' : 'primary.main') }}>
                    {isRecording ? <StopIcon /> : <MicIcon />}
                  </IconButton>

                  <input accept="image/*" style={{ display: 'none' }} id="image-upload" type="file" onChange={handleFileSelect} />
                  <label htmlFor="image-upload">
                    <IconButton component="span" disabled={!selectedFriend || uploadingImage}>
                      {uploadingImage ? <CircularProgress size={24} /> : <ImageIcon />}
                    </IconButton>
                  </label>

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
                    disabled={!selectedFriend || uploadingImage || isRecording || isUploadingVoice}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '24px',
                        maxHeight: { xs: '44px', sm: 'none' }
                      },
                      bgcolor: '#f8f9fa',
                      '& .MuiInputBase-input': {
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }
                    }}
                  />
                  <Box sx={{ position: 'relative' }}>
                    <IconButton
                      ref={emojiButtonRef}
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      disabled={!selectedFriend || uploadingImage || isRecording}
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
                  {isRecording ? (
                    <IconButton color="success" onClick={quickSendVoice} disabled={!selectedFriend || recordingTime < 1}
                      sx={{ bgcolor: 'success.main', color: 'white' }}>
                      <SendIcon />
                    </IconButton>
                  ) : audioUrl && !isRecording ? (
                    <IconButton color="primary" onClick={sendVoiceMessage} disabled={!selectedFriend || isUploadingVoice}
                      sx={{ bgcolor: 'primary.main', color: 'white' }}>
                      {isUploadingVoice ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
                    </IconButton>
                  ) : (
                    <IconButton color="primary" onClick={handleSendMessage} disabled={!selectedFriend || (!newMessage.trim() && !imagePreview)}
                      sx={{ bgcolor: 'primary.main', color: 'white' }}>
                      <SendIcon />
                    </IconButton>
                  )}

                  {imagePreview && (
                    <Box sx={{ position: 'relative' }}>
                      <img src={imagePreview} alt="Preview" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: '8px' }} />
                      <IconButton size="small" onClick={handleRemoveImagePreview}
                        sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'error.main', color: 'white' }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
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
        friends={friends.filter((f) => f.id !== selectedFriend?.id)}
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