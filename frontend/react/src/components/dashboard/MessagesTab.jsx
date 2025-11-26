import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Menu as MenuIcon,
  Send as SendIcon
} from '@mui/icons-material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import {
  Avatar,
  Box,
  Button,
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
  useTheme
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAvatar } from '../../hooks/useAvatar';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  sendVoiceMessage as apiSendVoiceMessage,
  deleteImageMessage,
  deleteMessage,
  editMessage,
  getPrivateChat,
  sendImageMessage,
  sendPrivateMessage,
  uploadImage
} from '../../services/api';
import ChatMessage from '../chat/ChatMessage';
import ForwardMessageDialog from '../chat/ForwardMessageDialog';

const getWebSocketBaseUrl = () => {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (!wsUrl) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return apiUrl.replace(/^http/, 'ws');
  }
  return wsUrl;
};
const BASE_URI = getWebSocketBaseUrl();

const convertWebmToMp3Url = (webmUrl) => {
  if (webmUrl.includes('cloudinary.com') && webmUrl.includes('.webm')) {
    return webmUrl
      .replace('/upload/', '/upload/f_mp3,fl_attachment/')
      .replace('.webm', '.mp3');
  }
  return webmUrl;
};

const ensureMp3VoiceUrl = (message) => {
  if (message.message_type === 'voice' && message.content.includes('.webm')) {
    return convertWebmToMp3Url(message.content);
  }
  return message.content;
};

const MessagesTab = ({ friends, profile, setError, setSuccess }) => {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [currentSelectedFriend, setCurrentSSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);

  // VOICE STATES
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSending, setVoiceSending] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);

  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioBlobRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastMessageCount = useRef(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tempToRealIdMap = useRef({});

  const { getAvatarUrl, getUserInitials, getUserAvatar } = useAvatar();

  /* --------------------------------------------------------------------- */
  /* WebSocket URL & Hook */
  /* --------------------------------------------------------------------- */
  const getWsUrl = useCallback(() => {
    if (!selectedFriend) return null;
    const rawToken = localStorage.getItem('accessToken') || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
    return `${BASE_URI}/api/v1/ws/private/${selectedFriend.id}?token=${token}`;
  }, [selectedFriend]);

  /* --------------------------------------------------------------------- */
  /* WebSocket Handlers */
  /* --------------------------------------------------------------------- */
  const handleWebSocketMessage = useCallback(
    (data) => {
      const { type } = data;
      console.log("📡 WebSocket received:", data);

      // 1. New real message from server
      if (type === "message") {
        const detectMessageType = (msgData) => {
          if (msgData.message_type === "image") return "image";
          if (msgData.message_type === "voice") return "voice";
          const content = msgData.content || "";
          const isVoiceUrl =
            content.match(/\.mp3$/i) ||
            content.includes("/voice_messages/") ||
            content.includes(".webm");
          if (isVoiceUrl) return "voice";
          const isImageUrl =
            content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
            content.includes("cloudinary.com") ||
            content.startsWith("data:image/");
          return isImageUrl ? "image" : "text";
        };

        const messageType = detectMessageType(data);
        let content = data.content;
        if (messageType === "voice" && content.includes(".webm")) {
          content = convertWebmToMp3Url(content);
        }

        const realMessage = {
          ...data,
          id: data.id,
          temp_id: data.temp_id || null,
          content,
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
          voice_duration: data.voice_duration || data.duration || 0,
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
    },
    [getAvatarUrl, friends, selectedFriend, getUserAvatar]
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

  /* --------------------------------------------------------------------- */
  /* Enhanced Auto-Seen Observer */
  /* --------------------------------------------------------------------- */
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

  /* --------------------------------------------------------------------- */
  /* Mark All Messages as Read on Chat Open */
  /* --------------------------------------------------------------------- */
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

  /* --------------------------------------------------------------------- */
  /* Voice Recording Logic */
  /* --------------------------------------------------------------------- */
  const isProcessingRef = useRef(false);

  const startRecording = async () => {
    if (!selectedFriend) {
      setError('Please select a friend first');
      return;
    }
    if (isRecording) return;

    try {
      audioBlobRef.current = null;
      setAudioUrl(null);
      setAudioBlob(null);
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
      setAudioBlob(null);
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
    setAudioBlob(null);

    setVoiceSending(true);
    setIsUploadingVoice(true);

    // Define tempId FIRST
    const tempId = `temp-voice-${Date.now()}-${Math.random()}`;

    // Now create temp message with FULL sender info (this fixes the avatar!)
    const tempMsg = {
      id: tempId,
      temp_id: tempId, // Important for WebSocket replacement
      content: 'Voice message...',
      message_type: 'voice',
      is_temp: true,
      is_read: false,
      created_at: new Date().toISOString(),
      voice_duration: recordingTime,
      sender_id: profile.id,
      sender: {
        id: profile.id,
        username: profile.username,
        avatar_url: getUserAvatar(profile), // This was missing → avatar not showing!
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
      formData.append('voice_file', blobToSend, 'voice-message.webm'); // or .mp3
      formData.append('duration', recordingTime.toString());

      // Optional: send tempId to backend so it can echo it back
      // formData.append('temp_id', tempId);

      const sentMessage = await apiSendVoiceMessage(selectedFriend.id, formData);

      // Replace temp message with real one
      setMessages(prev => {
        return prev.map(msg =>
          msg.id === tempId || msg.temp_id === tempId
            ? { ...sentMessage, is_temp: false, sender: { ...sentMessage.sender, avatar_url: getAvatarUrl(sentMessage.sender?.avatar_url) } }
            : msg
        );
      });

      setSuccess('Voice message sent!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Send failed:', err);
      setError('Failed to send voice message');
      setMessages(prev => prev.filter(msg => msg.id !== tempId && msg.temp_id !== tempId));
    } finally {
      setIsUploadingVoice(false);
      setVoiceSending(false);
      setRecordingTime(0);
    }
  };

  /* --------------------------------------------------------------------- */
  /* Image Upload & Deletion */
  /* --------------------------------------------------------------------- */
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
      setError('Failed to upload image');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
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
        setSuccess(isImage ? 'Image deleted' : 'Message deleted');
        setTimeout(() => setSuccess(null), 2000);
      } catch (err) {
        setError('Failed to delete message');
        setMessages(prev => [...prev, message]);
      }
    }
    setDeleteConfirmOpen(false);
    setMessageToDelete(null);
  };

  /* --------------------------------------------------------------------- */
  /* Typing Indicators */
  /* --------------------------------------------------------------------- */
  const handleTypingStart = useCallback(() => {
    if (!selectedFriend || !isConnected) return;
    sendWsMessage({ type: 'typing', is_typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendWsMessage({ type: 'typing', is_typing: false });
    }, 3000);
  }, [selectedFriend, isConnected, sendWsMessage]);

  /* --------------------------------------------------------------------- */
  /* Load Initial Messages */
  /* --------------------------------------------------------------------- */
  const loadInitialMessages = async () => {
    if (!selectedFriend || messages.length > 0) return;
    try {
      const chatMessages = await getPrivateChat(selectedFriend.id);
      const enhanced = chatMessages.map((msg) => {
        const detectMessageType = (message) => {
          if (message.message_type === 'image') return 'image';
          if (message.message_type === 'voice') return 'voice';
          const content = message.content || '';
          const isVoiceUrl =
            content.match(/\.mp3$/i) ||
            (content.includes('/voice_messages/') && (content.match(/\.mp3$/i) || content.includes('.webm')));
          if (isVoiceUrl) return "voice";
          const isImageUrl =
            content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
            (content.includes('cloudinary.com') && !content.includes('/voice_messages/')) ||
            content.startsWith('data:image/');
          return isImageUrl ? "image" : "text";
        };

        const messageType = detectMessageType(msg);
        let content = msg.content;
        if (messageType === 'voice') {
          content = ensureMp3VoiceUrl({ ...msg, message_type: messageType });
        }

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
        };
      });

      setMessages(enhanced.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    } catch (err) {
      setError('Failed to load messages');
      console.error(err);
    }
  };

  /* --------------------------------------------------------------------- */
  /* Friend Selection */
  /* --------------------------------------------------------------------- */
  const handleSelectFriend = (friend) => {
    if (isMobile) setMobileDrawerOpen(false);
    if (selectedFriend?.id === friend?.id) return;
    if (selectedFriend) closeConnection(1000, 'Switching friends');
    setSelectedFriend(friend);
    setMessages([]);
    setNewMessage('');
    setFriendTyping(false);
    setImagePreview(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
    setCurrentSSelectedFriend(friend);
  };

  /* --------------------------------------------------------------------- */
  /* Send Message */
  /* --------------------------------------------------------------------- */
  const sendTextMessage = async () => {
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
      setAudioBlob(null);
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
    setAudioBlob(null);
    setImagePreview(null);
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim() && selectedFriend && isConnected) {
      handleTypingStart();
    }
  };

  /* --------------------------------------------------------------------- */
  /* Forward Message Handler */
  /* --------------------------------------------------------------------- */
  const handleForwardMessage = async (message, friend) => {
    try {
      if (!message || !friend) {
        setError('Invalid message or friend');
        return;
      }

      const isVoiceMessage = message.message_type === 'voice' ||
        message.content.includes('voice_messages') ||
        message.content.match(/\.(mp3|mp4|wav|m4a|ogg|aac|flac)$/i);

      const isImageMessage = !isVoiceMessage && (
        message.message_type === 'image' ||
        message.content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)
      );

      let payload = {
        content: message.content,
        message_type: isVoiceMessage ? 'voice' : (isImageMessage ? 'image' : 'text'),
        is_forwarded: true,
        original_sender: message.sender?.username || profile?.username || 'Unknown',
      };

      let sentMessage;
      if (isVoiceMessage && payload.message_type === 'voice') {
        try {
          sentMessage = await sendPrivateMessage(friend.id, payload);
        } catch (voiceError) {
          payload.message_type = 'file';
          sentMessage = await sendPrivateMessage(friend.id, payload);
        }
      } else {
        sentMessage = await sendPrivateMessage(friend.id, payload);
      }

      setForwardDialogOpen(false);
      setForwardingMessage(null);
      setSuccess(`Message forwarded to ${friend.username}`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Failed to forward message');
    }
  };

  const handleForward = (msg) => {
    setForwardingMessage(msg);
    setForwardDialogOpen(true);
  };

  /* --------------------------------------------------------------------- */
  /* Auto-Scroll & Connection Status */
  /* --------------------------------------------------------------------- */
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
    if (friendTyping) return { text: 'Typing...', color: 'info.main' };
    if (!isConnected)
      return {
        text: reconnectAttempts > 0 ? `Reconnecting... (${reconnectAttempts})` : 'Connecting...',
        color: 'warning.main',
      };
    return { text: `Online • ${unread} unread`, color: 'success.main' };
  };

  const status = selectedFriend ? getConnectionStatus() : { text: 'Online', color: 'success.main' };

  /* --------------------------------------------------------------------- */
  /* Edit Message */
  /* --------------------------------------------------------------------- */
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

      setSuccess("Message edited successfully");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error("Edit failed:", err);
      setError("Failed to edit message");

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

  /* --------------------------------------------------------------------- */
  /* Render */
  /* --------------------------------------------------------------------- */
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        height: { xs: 'calc(100vh - 120px)', sm: '75vh', md: 600 },
        borderRadius: { xs: '12px', sm: '16px' },
        margin: { xs: 1, sm: 2, md: 0 },
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)', md: '100%' },
        maxWidth: { sm: '900px', md: 'none' },
        mx: { sm: 'auto', md: 0 },
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
              Delete {messageToDelete.message.message_type === 'image' ? 'Image' : 'Message'}?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              This action cannot be undone.
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
              <Button onClick={() => setDeleteConfirmOpen(false)} variant="outlined">
                Cancel
              </Button>
              <Button onClick={confirmDelete} variant="contained" color="error">
                Delete
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Mobile Header */}
      {isMobile && selectedFriend && (
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton size="small" onClick={() => setMobileDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Avatar src={getUserAvatar(selectedFriend)} sx={{ width: 36, height: 36 }} />
            <Box>
              <Typography variant="body1" fontWeight="600">{selectedFriend.username}</Typography>
              <Typography variant="caption" color={status.color}>{status.text}</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setSelectedFriend(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <Box sx={{ display: 'flex', flex: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
        {/* Sidebar */}
        {(!isMobile) && (
          <Box sx={{ width: { sm: 280, md: 300 }, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ p: 2, fontWeight: 600 }}>
              Friends
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
                    px: 2,
                    py: 1.5,
                    '&:hover': { bgcolor: 'action.hover' },
                    '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.contrastText' },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={getUserAvatar(friend)}>{getUserInitials(friend.username)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={friend.username} secondary={friend.email} />
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', ml: 1 }} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        <Drawer
          variant="temporary"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: 280 } }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Friends</Typography>
            <List>
              {friends.map((friend) => (
                <ListItem key={friend.id} selected={selectedFriend?.id === friend.id} onClick={() => handleSelectFriend(friend)}>
                  <ListItemAvatar>
                    <Avatar src={getUserAvatar(friend)}>{getUserInitials(friend.username)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={friend.username} secondary={friend.email} />
                </ListItem>
              ))}
            </List>
          </Box>
        </Drawer>

        {/* Chat Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
          {selectedFriend ? (
            <>
              {(!isMobile) && (
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'white', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar src={getUserAvatar(selectedFriend)} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight="600">{selectedFriend.username}</Typography>
                    <Typography variant="caption" color="text.secondary">{status.text}</Typography>
                  </Box>
                  <Chip label={status.text} size="small" sx={{ bgcolor: status.color, color: 'white' }} />
                </Box>
              )}

              <Box
                ref={messagesContainerRef}
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  px: 2,
                  py: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <ChatIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">No messages yet</Typography>
                    <Typography color="text.secondary">Say hello to {selectedFriend.username}!</Typography>
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
                      profile={profile}
                      currentFriend={selectedFriend}
                      getAvatarUrl={getAvatarUrl}
                      getUserInitials={getUserInitials}
                    />
                  ))
                )}
              </Box>

              {/* Input Area */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'white', display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
                {/* Recording UI */}
                {isRecording && (
                  <Box sx={{ position: 'absolute', bottom: '100%', left: 0, right: 0, bgcolor: 'error.main', color: 'white', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'white', animation: 'pulse 1.5s infinite' }} />
                      <Typography>Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</Typography>
                    </Box>
                    <Button variant="contained" color="inherit" size="small" startIcon={<StopIcon />} onClick={stopRecording}>
                      Stop
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
                      <Button variant="outlined" size="small" onClick={cancelRecording} disabled={voiceSending}>Cancel</Button>
                      <Button variant="contained" size="small" onClick={sendVoiceMessage} disabled={voiceSending || isUploadingVoice} startIcon={isUploadingVoice ? <CircularProgress size={16} /> : <SendIcon />}>
                        {isUploadingVoice ? 'Sending...' : 'Send'}
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
                  placeholder={!selectedFriend ? 'Select a friend...' : 'Type a message...'}
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
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '24px' }, bgcolor: '#f8f9fa' }}
                />

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
          ) : (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <ChatIcon sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {isMobile ? 'Select a friend' : 'Choose a friend to start chatting'}
              </Typography>
              {isMobile && (
                <Button variant="contained" onClick={() => setMobileDrawerOpen(true)} sx={{ mt: 2 }}>
                  Open Friends List
                </Button>
              )}
            </Box>
          )}
        </Box>
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
    </Box>
  );
};

export default MessagesTab;