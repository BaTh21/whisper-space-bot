import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Menu as MenuIcon,
  PushPin as PushPinIcon,
  Reply as ReplyIcon,
  Send as SendIcon
} from '@mui/icons-material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import {
  Avatar,
  Box,
  Button,
  Card,
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
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAvatar } from '../../hooks/useAvatar';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  sendVoiceMessage as apiSendVoiceMessage, deleteImageMessage,
  deleteMessage,
  editMessage,
  getPrivateChat,
  sendImageMessage,
  sendPrivateMessage,
  uploadImage
} from '../../services/api';

import ChatMessage from '../chat/ChatMessage';
import ForwardMessageDialog from '../chat/ForwardMessageDialog';

// WebSocket URL configuration
const getWebSocketBaseUrl = () => {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (!wsUrl) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return apiUrl.replace(/^http/, 'ws');
  }
  return wsUrl;
};

const BASE_URI = getWebSocketBaseUrl();

// Utility functions for audio handling
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
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState(null);
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
  const [isTyping, setIsTyping] = useState(false);
  const lastMessageCount = useRef(0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { getAvatarUrl, getUserInitials, getUserAvatar } = useAvatar();

  /* --------------------------------------------------------------------- */
  /*                         WebSocket URL & Hook                         */
  /* --------------------------------------------------------------------- */
  const getWsUrl = useCallback(() => {
    if (!selectedFriend) return null;
    const rawToken = localStorage.getItem('accessToken') || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
    return `${BASE_URI}/api/v1/ws/private/${selectedFriend.id}?token=${token}`;
  }, [selectedFriend]);

  /* --------------------------------------------------------------------- */
  /*                         WebSocket Handlers                           */
  /* --------------------------------------------------------------------- */
  const handleWebSocketMessage = useCallback(
    (data) => {
      const { type } = data;

      // ————————————————————————————————
      // 1. NEW MESSAGE (incoming OR your confirmed message)
      // ————————————————————————————————
      if (type === "message") {
        const detectMessageType = (msgData) => {
          if (msgData.message_type === "image") return "image";
          if (msgData.message_type === "voice") return "voice";

          const content = msgData.content || "";
          const isVoiceUrl =
            content.match(/\.mp3$/i) ||
            (content.includes("/voice_messages/") &&
              (content.match(/\.mp3$/i) || content.includes(".webm")));

          if (isVoiceUrl) return "voice";

          const isImageUrl =
            content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
            (content.includes("cloudinary.com") &&
              !content.includes("/voice_messages/")) ||
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
          content,
          is_temp: false,
          message_type: messageType,
          sender: {
            id: data.sender_id,
            username: data.sender_username,
            avatar_url: getAvatarUrl(data.avatar_url),
          },
          reply_to: data.reply_to
            ? { ...data.reply_to, sender_username: data.reply_to.sender_username }
            : null,
          is_read: data.is_read || false,
          read_at: data.read_at,
          seen_by: data.seen_by || [],
        };

        setMessages((prev) => {
          // ———————————————————————————————————
          // STEP 3 — Replace temp messages using temp_id
          // ———————————————————————————————————
          const tempMatch = prev.find(
            (m) => m.is_temp && m.temp_id && m.temp_id === data.temp_id
          );

          if (tempMatch) {
            return prev.map((m) =>
              m.temp_id === data.temp_id ? realMessage : m
            );
          }

          // Avoid duplicates
          if (prev.some((m) => m.id === realMessage.id)) return prev;

          return [...prev, realMessage].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );
        });

        // ————————————————————————————————
        // 2. READ RECEIPT / MESSAGE UPDATED
        // ————————————————————————————————
      } else if (type === "read_receipt" || type === "message_updated") {
        // STEP 2 — FIX fallback for seen_by / reader info
        const safeSeenBy =
          data.seen_by && Array.isArray(data.seen_by)
            ? data.seen_by
            : [
              {
                user_id: data.reader_id || data.read_by || selectedFriend?.id,
                username:
                  data.reader_username || selectedFriend?.username || "Unknown",
                avatar_url:
                  data.reader_avatar_url || selectedFriend?.avatar_url || null,
                seen_at: data.read_at || new Date().toISOString(),
              },
            ];

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.message_id
              ? {
                ...msg,
                is_temp: false,
                is_read: true,
                read_at: data.read_at || new Date().toISOString(),
                seen_by: safeSeenBy,
              }
              : msg
          )
        );

        // ————————————————————————————————
        // 3. TYPING INDICATOR
        // ————————————————————————————————
      } else if (type === "typing") {
        setFriendTyping(data.is_typing);

        // ————————————————————————————————
        // 4. STATUS UPDATE
        // ————————————————————————————————
      } else if (type === 'message_updated' || type === 'read_receipt') {
        if (!data.message_id) return; // safety check

        // ✅ Ensure seen_by is always an array
        const safeSeenBy =
          Array.isArray(data.seen_by) && data.seen_by.length > 0
            ? data.seen_by
            : [
              {
                user_id: data.reader_id || selectedFriend?.id,
                username: data.reader_username || selectedFriend?.username,
                avatar_url: data.reader_avatar_url || getUserAvatar(selectedFriend),
                seen_at: data.read_at || new Date().toISOString(),
              },
            ];

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== data.message_id) return msg;

            // ✅ Merge existing seen_by with new updates to prevent duplicates
            const existingSeenIds = msg.seen_by?.map((s) => s.user_id) || [];
            const mergedSeenBy = [
              ...msg.seen_by?.filter((s) => existingSeenIds.includes(s.user_id)) || [],
              ...safeSeenBy.filter((s) => !existingSeenIds.includes(s.user_id)),
            ];

            return {
              ...msg,
              is_temp: false,
              is_read: true,
              read_at: data.read_at || new Date().toISOString(),
              seen_by: mergedSeenBy,
            };
          })
        );

        // ————————————————————————————————
        // 5. MESSAGE DELETED
        // ————————————————————————————————
      } else if (type === "message_deleted") {
        setMessages((prev) => prev.filter((msg) => msg.id !== data.message_id));
        if (pinnedMessage?.id === data.message_id) setPinnedMessage(null);
        if (replyingTo?.id === data.message_id) setReplyingTo(null);
      }
    },
    [getAvatarUrl, pinnedMessage, replyingTo, selectedFriend]
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
      setError('Chat connection failed');
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
  /*                 Intersection Observer for Auto-Seen                  */
  /* --------------------------------------------------------------------- */
  useEffect(() => {
    if (!messagesContainerRef.current || !selectedFriend) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = parseInt(entry.target.getAttribute('data-message-id'));
            const isUnread = entry.target.getAttribute('data-is-unread') === 'true';

            if (messageId && isUnread && isConnected) {
              // 1️⃣ Send WS read receipt
              sendWsMessage({
                type: 'read',
                message_id: messageId,
              });

              // 2️⃣ Update local state instantly
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === messageId
                    ? {
                      ...msg,
                      is_read: true,
                      read_at: new Date().toISOString(),
                      seen_by: [
                        ...msg.seen_by.filter((s) => s.user_id !== selectedFriend.id),
                        {
                          user_id: selectedFriend.id,
                          username: selectedFriend.username,
                          avatar_url: getUserAvatar(selectedFriend),
                          seen_at: new Date().toISOString(),
                        },
                      ],
                    }
                    : msg
                )
              );
            }
          }
        });
      },
      {
        root: messagesContainerRef.current,
        rootMargin: '0px',
        threshold: 0.8, // 80% visible
      }
    );

    // Observe all unread messages
    const unreadMessageElements = messagesContainerRef.current.querySelectorAll(
      '[data-message-id][data-is-unread="true"]'
    );

    unreadMessageElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [messages, selectedFriend, isConnected, sendWsMessage]);



  /* --------------------------------------------------------------------- */
  /*                         Voice Recording Logic                        */
  /* --------------------------------------------------------------------- */

  // Add this ref to track if we're already processing
  const isProcessingRef = useRef(false);

  const startRecording = async () => {
    if (!selectedFriend) {
      setError('Please select a friend first');
      return;
    }

    // Prevent multiple starts but allow new recordings after previous ones
    if (isRecording) {
      console.log('⚠️ Already recording, please wait');
      return;
    }

    try {
      // Reset previous recording state - ALLOW NEW RECORDINGS
      audioBlobRef.current = null;
      setAudioUrl(null);
      setAudioBlob(null);
      setRecordingTime(0);
      setVoiceSending(false);
      setIsUploadingVoice(false);

      // Clear any existing intervals
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

      // Try different MIME types in order of preference
      const supportedTypes = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];

      let selectedType = 'audio/webm';
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          console.log(`✅ Using recording format: ${type}`);
          selectedType = type;
          break;
        }
      }

      const options = {
        mimeType: selectedType,
        audioBitsPerSecond: 128000
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks = [];
      let isStopped = false; // Track if we've already stopped

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !isStopped) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (isStopped) return; // Prevent multiple executions
        isStopped = true;

        if (audioChunks.length === 0) {
          console.log('No audio data recorded');
          cleanupRecording();
          return;
        }

        const blob = new Blob(audioChunks, { type: selectedType });
        console.log('Recording stopped, blob created:', blob.size);

        // Store in ref - READY FOR SENDING
        audioBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Clean up stream but keep recording state
        cleanupStream();

        // Reset recording flag but keep the blob for sending
        setIsRecording(false);
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError('Recording failed: ' + event.error.name);
        cleanupRecording();
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);

      // Set up recording timer
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
      console.error('Error starting recording:', err);
      // Reset all states on error
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
      console.log('🛑 Stopping recording...');

      // Stop media recorder
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Clear interval immediately
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      console.log('✅ Recording stopped');
    }
  };

  const cleanupStream = () => {
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => {
        track.stop();
      });
    }
  };

  const cleanupRecording = () => {
    console.log('🧹 Cleaning up recording...');

    // Stop recording if active
    if (isRecording) {
      setIsRecording(false);
    }

    // Clear interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Clean up stream
    cleanupStream();

    console.log('✅ Recording cleanup complete');
  };

  const cancelRecording = () => {
    console.log('❌ Canceling current recording...');

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    // Reset current recording but allow new ones
    setTimeout(() => {
      audioBlobRef.current = null;
      setAudioUrl(null);
      setAudioBlob(null);
      setRecordingTime(0);
      setVoiceSending(false);
      setIsUploadingVoice(false);

      console.log('✅ Recording canceled - ready for new recording');
    }, 100);
  };

  // FIXED: Quick send function
  const quickSendVoice = () => {
    if (!isRecording || voiceSending) {
      console.log('🚫 Quick send blocked');
      return;
    }

    console.log('⚡ Quick send triggered');
    stopRecording();

    // Use a more reliable approach with timeout
    let attempts = 0;
    const maxAttempts = 40; // 2 seconds max

    const checkBlob = setInterval(() => {
      attempts++;

      if (audioBlobRef.current && !voiceSending) {
        clearInterval(checkBlob);
        console.log('✅ Blob ready, sending voice message');
        sendVoiceMessage();
      }

      // Safety timeout - prevent multiple calls
      if (attempts >= maxAttempts || !audioBlobRef.current) {
        clearInterval(checkBlob);
        console.log('❌ Quick send timeout');
      }
    }, 50);
  };
  // FIXED: Send voice message function
  const sendVoiceMessage = async () => {
    console.log('🔊 sendVoiceMessage called');

    // Prevent multiple sends
    if (voiceSending || isUploadingVoice || !audioBlobRef.current || !selectedFriend) {
      console.log('🚫 Send blocked');
      return;
    }

    const blobToSend = audioBlobRef.current;

    // **CLEAR IMMEDIATELY** - Prevent duplicate sends
    audioBlobRef.current = null;
    setAudioUrl(null);
    setAudioBlob(null);

    // **LOCK UI**
    setVoiceSending(true);
    setIsUploadingVoice(true);

    const tempId = `temp-voice-${Date.now()}`;
    console.log('🆔 Temporary message ID:', tempId);

    // **ADD TEMP MESSAGE - ONLY ONCE**
    const tempMsg = {
      id: tempId,
      content: 'Voice message...',
      message_type: 'voice',
      is_temp: true,
      created_at: new Date().toISOString(),
      voice_duration: recordingTime,
      sender_id: profile.id,
      // Add unique identifier to prevent duplicates
      _uniqueId: Date.now() + Math.random()
    };

    // **USE FUNCTIONAL UPDATE TO PREVENT DUPLICATES**
    setMessages(prev => {
      // Remove any existing temp messages first
      const withoutTemp = prev.filter(msg => !msg.is_temp);
      // Then add the new temp message
      return [...withoutTemp, tempMsg];
    });

    try {
      const formData = new FormData();
      formData.append('voice_file', blobToSend, 'voice-message.mp3');
      formData.append('duration', recordingTime.toString());
      if (replyingTo?.id) formData.append('reply_to_id', replyingTo.id);

      console.log('📤 Uploading voice file...');
      const sentMessage = await apiSendVoiceMessage(selectedFriend.id, formData);
      console.log('✅ Voice sent successfully');

      // **REPLACE TEMP MESSAGE - ENSURES ONLY ONE MESSAGE**
      setMessages(prev => {
        // Remove ALL temp messages (in case multiple exist)
        const withoutAnyTemp = prev.filter(msg => !msg.is_temp);
        // Add the real message
        return [...withoutAnyTemp, { ...sentMessage, is_temp: false }];
      });

      setSuccess('Voice message sent!');

      // Clear success message after 2 seconds
      setTimeout(() => {
        setSuccess('');
      }, 2000);

    } catch (err) {
      console.error('❌ Send failed:', err);
      setError('Failed to send voice message');

      // **REMOVE THE SPECIFIC TEMP MESSAGE ON ERROR**
      setMessages(prev => prev.filter(msg => msg.id !== tempId));

    } finally {
      // Cleanup
      setIsUploadingVoice(false);
      setVoiceSending(false);
      setRecordingTime(0);

      console.log('✅ Send process completed');
    }
  };

  useEffect(() => {
    // Function to remove duplicate messages
    const removeDuplicateMessages = () => {
      setMessages(prev => {
        const seenIds = new Set();
        const uniqueMessages = [];

        for (const message of prev) {
          if (!seenIds.has(message.id)) {
            seenIds.add(message.id);
            uniqueMessages.push(message);
          } else {
            console.log('🔄 Removing duplicate message:', message.id);
          }
        }

        // Only update if duplicates were found
        if (uniqueMessages.length !== prev.length) {
          console.log(`🔧 Removed ${prev.length - uniqueMessages.length} duplicates`);
          return uniqueMessages;
        }

        return prev;
      });
    };

    // Run deduplication when messages change
    removeDuplicateMessages();
  }, [messages]);

  /* --------------------------------------------------------------------- */
  /*                         Auto-Seen Messages Logic                     */
  /* --------------------------------------------------------------------- */
  useEffect(() => {
    const markMessagesAsSeen = () => {
      if (!selectedFriend || !messages.length || !isConnected) return;

      const unreadMessages = messages.filter(
        msg =>
          msg.sender_id === selectedFriend.id &&
          !msg.is_read &&
          !msg.is_temp
      );

      if (unreadMessages.length === 0) return;

      // Mark messages as read via WebSocket
      unreadMessages.forEach(message => {
        sendWsMessage({
          type: 'read',
          message_id: message.id
        });
      });

      // Update local state immediately
      setMessages(prev => prev.map(msg =>
        unreadMessages.some(unread => unread.id === msg.id)
          ? { ...msg, is_read: true, read_at: new Date().toISOString() }
          : msg
      ));
    };

    // Mark as seen when:
    // 1. Chat is opened
    // 2. New messages arrive from friend
    // 3. User scrolls to bottom
    markMessagesAsSeen();
  }, [messages, selectedFriend, isConnected, sendWsMessage]);

  /* --------------------------------------------------------------------- */
  /*                         Image Upload & Deletion                      */
  /* --------------------------------------------------------------------- */
  const handleImageUpload = async (file) => {
    if (!selectedFriend) return;

    const tempId = `temp-img-${Date.now()}`;

    try {
      setUploadingImage(true);

      console.log('Starting image upload...');

      const result = await uploadImage(selectedFriend.id, file);
      console.log('Upload result:', result);

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

      console.log('Temp message created:', tempMsg);

      setMessages((prev) => [...prev, tempMsg]);
      setImagePreview(null);

      const payload = {
        type: 'message',
        content: url,
        message_type: 'image',
      };

      console.log('WebSocket payload:', payload);

      if (sendWsMessage(payload)) {
        console.log('Message sent via WebSocket');
      } else {
        console.log('WebSocket failed, using HTTP fallback...');
        try {
          const sentMessage = await sendImageMessage(selectedFriend.id, url);
          console.log('HTTP response:', sentMessage);

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
        } catch (httpError) {
          console.error('HTTP fallback failed:', httpError);
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload image: ' + (err.message || 'Unknown error'));
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
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);

    handleImageUpload(file);
  };

  const handleRemoveImagePreview = () => {
    setImagePreview(null);
  };

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
    if (pinnedMessage?.id === id) setPinnedMessage(null);
    if (replyingTo?.id === id) setReplyingTo(null);

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
        setError('Failed to delete message', err);
        setMessages(prev => [...prev, message]);
      }
    }

    setDeleteConfirmOpen(false);
    setMessageToDelete(null);
  };

  /* --------------------------------------------------------------------- */
  /*                         Read Receipt System                          */
  /* --------------------------------------------------------------------- */
  const sendReadReceipt = useCallback((messageId) => {
    if (isConnected && messageId) {
      sendWsMessage({
        type: 'read_receipt',
        message_id: messageId,
        read_at: new Date().toISOString()
      });
    }
  }, [isConnected, sendWsMessage]);

  const markMessagesAsRead = useCallback(() => {
    if (!selectedFriend || !messages.length) return;

    const unreadMessages = messages.filter(
      msg => msg.sender_id === selectedFriend.id && !msg.is_read
    );

    if (unreadMessages.length > 0 && isConnected) {
      const lastUnreadMessage = unreadMessages[unreadMessages.length - 1];

      setMessages(prev => prev.map(msg =>
        msg.sender_id === selectedFriend.id && !msg.is_read
          ? { ...msg, is_read: true, read_at: new Date().toISOString() }
          : msg
      ));

      sendReadReceipt(lastUnreadMessage.id);
    }
  }, [messages, selectedFriend, isConnected, sendReadReceipt]);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || !selectedFriend) return;

    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isNearBottom) {
      const unreadMessages = messages.filter(
        msg => msg.sender_id === selectedFriend.id && !msg.is_read && !msg.is_temp
      );

      if (unreadMessages.length > 0 && isConnected) {
        unreadMessages.forEach(message => {
          sendWsMessage({
            type: 'read',
            message_id: message.id
          });
        });

        setMessages(prev => prev.map(msg =>
          unreadMessages.some(unread => unread.id === msg.id)
            ? { ...msg, is_read: true, read_at: new Date().toISOString() }
            : msg
        ));
      }
    }
  }, [messages, selectedFriend, isConnected, sendWsMessage]);

  useEffect(() => {
    if (selectedFriend && isConnected) {
      markMessagesAsRead();
    }
  }, [messages, selectedFriend, isConnected, markMessagesAsRead]);


  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  /* --------------------------------------------------------------------- */
  /*                             Typing Indicators                         */
  /* --------------------------------------------------------------------- */
  const handleTypingStart = useCallback(() => {
    if (!isTyping && selectedFriend && isConnected) {
      setIsTyping(true);
      sendWsMessage({ type: 'typing', is_typing: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => handleTypingStop(), 3000);
  }, [isTyping, selectedFriend, isConnected, sendWsMessage]);

  const handleTypingStop = useCallback(() => {
    if (isTyping && selectedFriend && isConnected) {
      setIsTyping(false);
      sendWsMessage({ type: 'typing', is_typing: false });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isTyping, selectedFriend, isConnected, sendWsMessage]);

  /* --------------------------------------------------------------------- */
  /*                         Load Initial Messages                         */
  /* --------------------------------------------------------------------- */
const loadInitialMessages = async () => {
  if (!selectedFriend || messages.length > 0) return;

  try {
    const chatMessages = await getPrivateChat(selectedFriend.id);

    const enhanced = chatMessages.map((msg) => {
      // ————————————————————————————
      // 1. Detect message type
      // ————————————————————————————
      const detectMessageType = (message) => {
        if (message.message_type === 'image') return 'image';
        if (message.message_type === 'voice') return 'voice';

        const content = message.content || '';

        const isVoiceUrl =
          content.match(/\.mp3$/i) ||
          (content.includes('/voice_messages/') && (content.match(/\.mp3$/i) || content.includes('.webm')));

        if (isVoiceUrl) return 'voice';

        const isImageUrl =
          content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
          (content.includes('cloudinary.com') && !content.includes('/voice_messages/')) ||
          content.startsWith('data:image/');

        return isImageUrl ? 'image' : 'text';
      };

      const messageType = detectMessageType(msg);

      // ————————————————————————————
      // 2. Convert WebM voice URLs to MP3
      // ————————————————————————————
      let content = msg.content;
      if (messageType === 'voice') {
        content = ensureMp3VoiceUrl({ ...msg, message_type: messageType });
      }

      // ————————————————————————————
      // 3. Prepare sender info
      // ————————————————————————————
      const sender = {
        id: msg.sender_id,
        username: msg.sender_id === profile?.id ? profile.username : selectedFriend.username,
        avatar_url: getUserAvatar(msg.sender_id === profile?.id ? profile : selectedFriend),
      };

      // ————————————————————————————
      // 4. Prepare reply_to info
      // ————————————————————————————
      const reply_to = msg.reply_to
        ? {
            ...msg.reply_to,
            sender_username:
              msg.reply_to.sender_id === profile?.id ? profile.username : selectedFriend.username,
          }
        : null;

      // ————————————————————————————
      // 5. Ensure seen_by is always populated
      // ————————————————————————————
      const seen_by =
        msg.seen_by && Array.isArray(msg.seen_by)
          ? msg.seen_by
          : msg.is_read
          ? [
              {
                user_id: msg.receiver_id === profile?.id ? selectedFriend.id : profile.id,
                username: msg.receiver_id === profile?.id ? selectedFriend.username : profile.username,
                avatar_url:
                  msg.receiver_id === profile?.id
                    ? getUserAvatar(selectedFriend)
                    : getUserAvatar(profile),
                seen_at: msg.read_at || new Date().toISOString(),
              },
            ]
          : [];

      return {
        ...msg,
        content,
        is_temp: false,
        message_type: messageType,
        sender,
        reply_to,
        is_read: msg.is_read || false,
        read_at: msg.read_at || null,
        seen_by,
      };
    });

    // ————————————————————————————
    // 6. Sort messages by creation time
    // ————————————————————————————
    setMessages(
      enhanced.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    );
    console.log('Loaded messages with seen_by and MP3 conversion:', enhanced);
  } catch (err) {
    setError('Failed to load messages');
    console.error(err);
  }
};


  /* --------------------------------------------------------------------- */
  /*                           Friend Selection                            */
  /* --------------------------------------------------------------------- */
  const handleSelectFriend = (friend) => {
    if (isMobile) setMobileDrawerOpen(false);
    if (currentSelectedFriend?.id == friend?.id) return;
    if (selectedFriend) closeConnection(1000, 'Switching friends');
    setSelectedFriend(friend);
    clearChatState();
    setCurrentSSelectedFriend(friend);
  };

  const clearChatState = () => {
    setMessages([]);
    setReplyingTo(null);
    setPinnedMessage(null);
    setNewMessage('');
    setFriendTyping(false);
    setIsTyping(false);
    setImagePreview(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
  };

  /* --------------------------------------------------------------------- */
  /*                            Send Message                               */
  /* --------------------------------------------------------------------- */
  const handleSendMessage = async () => {
    const content = newMessage.trim();

    // if ((!content && !audioUrl) || !selectedFriend) return;
    if (content && selectedFriend) {
      await sendTextMessage();
      return;
    }

    if (audioUrl && audioBlob) {
      await sendVoiceMessage();
      return;
    }


    if (content) {
      await sendTextMessage();
    }

    if (!content && !audioUrl && !imagePreview) {
      setError('Please type a message, record a voice note, or send an image');
      setTimeout(() => setError(null), 3000);
      return;
    }
  };


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
      reply_to_id: replyingTo?.id || null,
      reply_to: replyingTo ? {
        ...replyingTo,
        sender_username: replyingTo.sender_id === profile?.id ? profile.username : selectedFriend.username,
      } : null,
      sender: {
        username: profile.username,
        avatar_url: getUserAvatar(profile),
        id: profile.id,
      },
    };

    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage('');
    setReplyingTo(null);
    handleTypingStop();

    // Clear any voice recording if we're sending text
    if (audioUrl) {
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
    }

    const payload = {
      type: 'message',
      content: content,
      message_type: 'text',
      reply_to_id: replyingTo?.id || null,
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
              reply_to: replyingTo ? {
                ...replyingTo,
                sender_username: replyingTo.sender_id === profile?.id ? profile.username : selectedFriend.username,
              } : null,
              sender: {
                username: profile.username,
                avatar_url: getUserAvatar(profile),
                id: profile.id,
              },
            })
        );
      } catch (err) {
        setError(err.message);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setNewMessage(content);
      }
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim() && selectedFriend && isConnected) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  /* --------------------------------------------------------------------- */
  /*                         Forward Message Handler                      */
  /* --------------------------------------------------------------------- */
  const handleForwardMessage = async (message, friend) => {
    try {
      console.log('🔊 DEBUG - Forwarding message:', {
        content: message?.content,
        type: message?.message_type,
        friend: friend?.username
      });

      if (!message || !friend) {
        setError('Invalid message or friend selection');
        return;
      }

      let payload;

      // Check for VOICE messages FIRST (most specific)
      const isVoiceMessage = message.message_type === 'voice' ||
        message.content.includes('voice_messages') ||
        message.content.match(/\.(mp3|mp4|wav|m4a|ogg|aac|flac)$/i);

      // Check for IMAGE messages (less specific)
      const isImageMessage = !isVoiceMessage && (
        message.message_type === 'image' ||
        message.content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)
      );

      console.log('🔍 Message type detection:', {
        isVoiceMessage,
        isImageMessage,
        content: message.content,
        messageType: message.message_type
      });

      if (isVoiceMessage) {
        // For VOICE messages - use the same approach as your voice recording
        let voiceUrl = message.content;

        // Convert WEBM to MP3 if needed (same as your recording logic)
        if (voiceUrl.includes('.webm')) {
          voiceUrl = convertWebmToMp3Url(voiceUrl);
        }

        // Use the same payload structure as your sendVoiceMessage but for forwarding
        payload = {
          content: voiceUrl,
          message_type: 'voice', // Keep as 'voice' to match your recording logic
          voice_duration: message.voice_duration || 0,
          file_size: message.file_size || 0,
          is_forwarded: true,
          original_sender: message.sender?.username || profile?.username || 'Unknown',
        };
        console.log('🎵 Forwarding VOICE message with original URL');
      }
      else if (isImageMessage) {
        // For IMAGE messages
        payload = {
          content: message.content,
          message_type: 'image',
          is_forwarded: true,
          original_sender: message.sender?.username || profile?.username || 'Unknown',
        };
        console.log('🖼️ Forwarding IMAGE message');
      }
      else {
        // For TEXT messages
        payload = {
          content: message.content,
          message_type: 'text',
          is_forwarded: true,
          original_sender: message.sender?.username || profile?.username || 'Unknown',
          reply_to_id: message.reply_to_id || null,
        };
        console.log('📝 Forwarding TEXT message');
      }

      console.log('📤 Final payload:', payload);

      // Since we're using 'voice' type, we need to handle the backend limitation
      let sentMessage;

      if (isVoiceMessage && payload.message_type === 'voice') {
        // Try with 'voice' type first (preferred)
        try {
          sentMessage = await sendPrivateMessage(friend.id, payload);
          console.log('✅ Voice forward successful with "voice" type');
        } catch (voiceError) {
          console.log('⚠️ Voice type failed, trying with "file" type...', voiceError);
          // If 'voice' type fails, fall back to 'file' type
          const fallbackPayload = {
            ...payload,
            message_type: 'file' // Fallback to backend-supported type
          };
          sentMessage = await sendPrivateMessage(friend.id, fallbackPayload);
          console.log('✅ Voice forward successful with "file" type fallback');
        }
      } else {
        // For non-voice messages, send normally
        sentMessage = await sendPrivateMessage(friend.id, payload);
      }

      console.log('✅ Forward successful!');
      setForwardDialogOpen(false);
      setForwardingMessage(null);
      setSuccess(`Message forwarded to ${friend.username}`);

    } catch (err) {
      console.error('❌ Forward failed:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });

      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          const firstError = err.response.data.detail[0];
          setError(`Cannot forward: ${firstError.msg}`);
        } else {
          setError(`Cannot forward: ${JSON.stringify(err.response.data.detail)}`);
        }
      } else {
        setError('Failed to forward message');
      }
    }
  };

  // Make sure this function matches your recording logic
  const convertWebmToMp3Url = (webmUrl) => {
    if (webmUrl.includes('cloudinary.com') && webmUrl.includes('.webm')) {
      return webmUrl
        .replace('/upload/', '/upload/f_mp3,fl_attachment/')
        .replace('.webm', '.mp3');
    }
    return webmUrl;
  };
  /* --------------------------------------------------------------------- */
  /*                         Connection Status UI                         */
  /* --------------------------------------------------------------------- */
  const getConnectionStatus = () => {
    const unread = messages.filter(
      (m) => !m.is_read && m.sender_id === selectedFriend?.id
    ).length;

    if (friendTyping) return { text: 'Typing...', color: 'info.main' };
    if (!isConnected)
      return {
        text:
          reconnectAttempts > 0
            ? `Reconnecting... (${reconnectAttempts})`
            : 'Connecting...',
        color: 'warning.main',
      };
    return { text: `Online • ${unread} unread`, color: 'success.main' };
  };
  const status = selectedFriend
    ? getConnectionStatus()
    : { text: 'Online', color: 'success.main' };

  /* --------------------------------------------------------------------- */
  /*                         Threading Helpers                             */
  /* --------------------------------------------------------------------- */
  const organizeMessagesIntoThreads = (list) => {
    const threads = new Map();
    const roots = [];
    list.forEach((m) =>
      m.reply_to_id
        ? (threads.has(m.reply_to_id) || threads.set(m.reply_to_id, [])).get(m.reply_to_id).push(m)
        : roots.push(m)
    );
    const build = (m) => ({
      ...m,
      replies: (threads.get(m.id) || [])
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(build),
    });
    return roots.map(build).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  const flattenThreads = (threads, level = 0) => {
    let flat = [];
    threads.forEach((t) => {
      flat.push({ ...t, threadLevel: level, isThreadStart: level === 0 && t.replies.length > 0 });
      if (t.replies.length) flat = flat.concat(flattenThreads(t.replies, level + 1));
    });
    return flat;
  };
  const threadedMessages = flattenThreads(organizeMessagesIntoThreads(messages));

  /* --------------------------------------------------------------------- */
  /*                           Auto-Scroll Logic                           */
  /* --------------------------------------------------------------------- */
  const scrollToBottom = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    requestAnimationFrame(() => {
      const lastMsg = container.lastElementChild;
      if (lastMsg) {
        lastMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    if (messages.length !== lastMessageCount.current) {
      lastMessageCount.current = messages.length;
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [replyingTo, pinnedMessage, scrollToBottom]);

  useEffect(() => {
    if (selectedFriend) scrollToBottom();
  }, [selectedFriend, scrollToBottom]);

  /* --------------------------------------------------------------------- */
  /*                     Edit / Delete / Reply / Pin / Forward            */
  /* --------------------------------------------------------------------- */
  const handleEditMessage = async (messageId, newContent) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const oldContent = msg.content;
    const oldUpdatedAt = msg.updated_at;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: newContent, updated_at: new Date().toISOString() }
          : m
      )
    );

    if (String(messageId).startsWith("temp-")) {
      setError("Wait for message to send before editing");
      setTimeout(() => setError(null), 3000);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: oldContent, updated_at: oldUpdatedAt }
            : m
        )
      );
      return;
    }

    try {
      const updated = await editMessage(messageId, newContent);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: updated.content, updated_at: updated.updated_at }
            : m
        )
      );

      setSuccess("Edited");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err.message || "Failed to edit message");
      setTimeout(() => setError(null), 3000);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: oldContent, updated_at: oldUpdatedAt }
            : m
        )
      );
    }
  };

  const handleReply = (msg) => {
    console.log('🎯 REPLY: Setting reply target:', msg?.id, msg?.content);
    if (msg && msg.id) {
      setReplyingTo(msg);
      console.log('✅ REPLY: Target set successfully');
    } else {
      console.error('❌ REPLY: Invalid message received');
    }
  };

  const handlePinMessage = (msg) => setPinnedMessage(pinnedMessage?.id === msg.id ? null : msg);
  const handleForward = (msg) => {
    setForwardingMessage(msg);
    setForwardDialogOpen(true);
  };

  /* --------------------------------------------------------------------- */
  /*                         Seen Status Logic                            */
  /* --------------------------------------------------------------------- */
  const lastMyMessage = messages
    .filter(msg => msg.sender_id === profile?.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  const lastMessageSeen = lastMyMessage?.is_read;

  /* --------------------------------------------------------------------- */
  /*                               Drawer UI                               */
  /* --------------------------------------------------------------------- */
  const FriendsListDrawer = () => (
    <Drawer
      variant="temporary"
      open={mobileDrawerOpen}
      onClose={() => setMobileDrawerOpen(false)}
      ModalProps={{ keepMounted: true }}
      sx={{
        display: { xs: 'block', sm: 'none' },
        '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box' },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
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
                px: 1.5,
                py: 1.5,
                '&:hover': { bgcolor: 'action.hover' },
                '&.Mui-selected': {
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  '& .MuiListItemText-secondary': { color: 'primary.contrastText' },
                },
              }}
            >
              <ListItemAvatar sx={{ minWidth: 44 }}>
                <Avatar src={getUserAvatar(friend)} sx={{ width: 44, height: 44 }}>
                  {getUserInitials(friend.username)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={<Typography fontWeight="500" sx={{ fontSize: '0.95rem' }}>{friend.username}</Typography>}
                secondary={<Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{friend.email}</Typography>}
              />
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main', ml: 1 }} />
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );

  /* --------------------------------------------------------------------- */
  /*                                 Render                                 */
  /* --------------------------------------------------------------------- */
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row', md: 'row' },
        height: { xs: 'calc(100vh - 120px)', sm: '75vh', md: 600 },
        borderRadius: { xs: '12px', sm: '16px', md: '8px' },
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
      {/* Delete Confirmation Dialog */}
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
              {messageToDelete.message.message_type === 'image'
                ? 'This image will be permanently deleted from the chat and Cloudinary storage. This action cannot be undone.'
                : 'This message will be permanently deleted from the chat. This action cannot be undone.'
              }
            </Typography>

            {messageToDelete.message.message_type === 'image' && (
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <img
                  src={messageToDelete.message.content}
                  alt="To be deleted"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 150,
                    borderRadius: '8px'
                  }}
                />
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                onClick={() => setDeleteConfirmOpen(false)}
                variant="outlined"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                variant="contained"
                color="error"
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Mobile Header */}
      {isMobile && selectedFriend && (
        <Box
          sx={{
            p: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton size="small" onClick={() => setMobileDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Avatar src={getUserAvatar(selectedFriend)} sx={{ width: 36, height: 36 }} />
            <Box>
              <Typography variant="body1" fontWeight="600" sx={{ fontSize: '0.95rem' }}>
                {selectedFriend.username}
              </Typography>
              <Typography variant="caption" color={status.color} sx={{ fontSize: '0.75rem' }}>
                {status.text}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setSelectedFriend(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <Box sx={{ display: 'flex', flex: 1, flexDirection: { xs: 'column', sm: 'row', md: 'row' } }}>
        {/* Sidebar – tablet & desktop */}
        {(!isMobile) && (
          <Box
            sx={{
              width: { sm: 280, md: 300 },
              borderRight: 1,
              borderColor: 'divider',
              overflow: 'auto',
              flexShrink: 0,
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{ p: 2, fontWeight: 600, fontSize: { sm: '1.1rem', md: '1.25rem' } }}
            >
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
                    px: { sm: 1.5, md: 2 },
                    py: { sm: 1.5, md: 1 },
                    '&:hover': { bgcolor: 'action.hover' },
                    '&.Mui-selected': {
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      '& .MuiListItemText-secondary': { color: 'primary.contrastText' },
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={getUserAvatar(friend)} sx={{ width: 40, height: 40 }}>
                      {getUserInitials(friend.username)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography fontWeight="500" sx={{ fontSize: { sm: '0.9rem', md: '1rem' } }}>{friend.username}</Typography>}
                    secondary={<Typography variant="body2" sx={{ fontSize: { sm: '0.8rem', md: '0.875rem' } }}>{friend.email}</Typography>}
                  />
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', ml: 1 }} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        <FriendsListDrawer />

        {/* Chat Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#f8f9fa',
            minHeight: 0,
            minWidth: { sm: 300, md: 400 },
          }}
        >
          {selectedFriend ? (
            <>
              {/* Tablet / Desktop Header */}
              {(!isMobile) && (
                <Box
                  sx={{
                    p: { sm: 1.5, md: 2 },
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexShrink: 0,
                  }}
                >
                  <Avatar src={getUserAvatar(selectedFriend)} sx={{ width: { sm: 40, md: 44 }, height: { sm: 40, md: 44 } }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight="600" sx={{ fontSize: { sm: '1.1rem', md: '1.25rem' } }}>
                      {selectedFriend.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: { sm: '0.75rem', md: '0.875rem' } }}>
                      {status.text}
                    </Typography>
                  </Box>
                  <Chip
                    label={status.text}
                    size="small"
                    sx={{ bgcolor: status.color, color: 'white', fontSize: { sm: '0.7rem', md: '0.75rem' } }}
                  />
                </Box>
              )}

              {/* Pinned Message */}
              {pinnedMessage && (
                <Card
                  sx={{
                    m: { xs: 1, sm: 1.5, md: 2 },
                    mb: { xs: 0.5, sm: 1, md: 1 },
                    p: { xs: 1.5, sm: 1.5, md: 2 },
                    bgcolor: 'warning.light',
                    border: '2px solid',
                    borderColor: 'warning.main',
                    borderRadius: '12px',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PushPinIcon
                          sx={{
                            mr: 1,
                            color: 'warning.dark',
                            transform: 'rotate(45deg)',
                            fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'warning.dark',
                            fontWeight: 600,
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.75rem' },
                          }}
                        >
                          Pinned
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Avatar
                          src={getUserAvatar(pinnedMessage.sender_id === profile?.id ? profile : selectedFriend)}
                          sx={{ width: { xs: 20, sm: 22, md: 24 }, height: { xs: 20, sm: 22, md: 24 }, mr: 1 }}
                        />
                        <Typography
                          variant="body2"
                          fontWeight="500"
                          sx={{ fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.875rem' } }}
                        >
                          {pinnedMessage.sender_id === profile?.id ? 'You' : selectedFriend.username}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.875rem' },
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}
                      >
                        {(() => {
                          // Check if it's a voice message (contains voice/audio file path)
                          if (pinnedMessage.content.match(/\.(mp4|mp3|wav|m4a|ogg|aac|flac)$/i) ||
                            pinnedMessage.content.includes('voice_messages') ||
                            pinnedMessage.content.includes('audio')) {
                            return (
                              <>
                                <MicIcon sx={{ fontSize: '0.9rem' }} />
                                Voice message
                              </>
                            );
                          }
                          // Check if it's an image (contains image file extensions or paths)
                          else if (pinnedMessage.content.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i) ||
                            pinnedMessage.content.includes('images') ||
                            pinnedMessage.content.includes('photos')) {
                            return (
                              <>
                                <ImageIcon sx={{ fontSize: '0.9rem' }} />
                                Image
                              </>
                            );
                          }
                          // Check if it's a video
                          else if (pinnedMessage.content.match(/\.(mp4|mov|avi|mkv|webm)$/i) ||
                            pinnedMessage.content.includes('videos')) {
                            return (
                              <>
                                <VideocamIcon sx={{ fontSize: '0.9rem' }} />
                                Video
                              </>
                            );
                          }
                          // Check if it's a document
                          else if (pinnedMessage.content.match(/\.(pdf|doc|docx|txt|rtf)$/i) ||
                            pinnedMessage.content.includes('documents')) {
                            return (
                              <>
                                <DescriptionIcon sx={{ fontSize: '0.9rem' }} />
                                Document
                              </>
                            );
                          }
                          // Default to text message
                          else {
                            return pinnedMessage.content;
                          }
                        })()}
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setPinnedMessage(null)} sx={{ p: { xs: 0.5, sm: 0.75, md: 1 }, ml: 1 }}>
                      <CloseIcon fontSize={isMobile ? 'small' : 'medium'} />
                    </IconButton>
                  </Box>
                </Card>
              )}

              {/* Messages */}
              <Box
                ref={messagesContainerRef}
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  px: { xs: 1.5, sm: 2, md: 2 },
                  py: { xs: 1, sm: 1.5, md: 2 },
                  bgcolor: '#f8f9fa',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: { xs: 0.5, sm: 0.75, md: 1 },
                }}
                onScroll={handleScroll}
              >
                {messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', mt: 4, p: 2 }}>
                    <ChatIcon sx={{ fontSize: { xs: 48, sm: 56, md: 64 }, color: 'grey.300', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}>
                      No messages yet
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                      Say hello to {selectedFriend.username}!
                    </Typography>
                  </Box>
                ) : (
                  threadedMessages.map((message, i) => {
                    const isLast = i === threadedMessages.length - 1;
                    const isMyLastMessage = isLast && message.sender_id === profile?.id;

                    // ✅ UPDATED: Show seen status for all my messages that have been seen
                    // Not just the last one, similar to Telegram
                    const shouldShowSeenStatus = message.sender_id === profile?.id &&
                      (message.is_read || message.seen_by?.length > 0);

                    return (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        setMessages={setMessages}
                        isMine={message.sender_id === profile?.id}
                        onUpdate={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onReply={handleReply}
                        onForward={handleForward}
                        onPin={handlePinMessage}
                        profile={profile}
                        currentFriend={selectedFriend}
                        getAvatarUrl={getAvatarUrl}
                        getUserInitials={getUserInitials}
                        isPinned={pinnedMessage?.id === message.id}
                        showSeenStatus={message.sender_id === profile?.id}
                      />
                    );
                  })
                )}
              </Box>

              {/* Reply Preview */}
              {replyingTo && (
                <Box
                  sx={{
                    p: { xs: 1, sm: 1.25, md: 1.5 },
                    borderTop: 1,
                    borderColor: 'divider',
                    bgcolor: 'primary.light',
                    flexShrink: 0,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <ReplyIcon sx={{ mr: 1, color: 'primary.dark' }} fontSize={isMobile ? 'small' : 'medium'} />
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'primary.dark',
                            fontWeight: 600,
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.75rem' },
                          }}
                        >
                          Replying to {replyingTo.sender_id === profile?.id ? 'yourself' : selectedFriend.username}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'primary.contrastText',
                          fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.8rem' },
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {(() => {
                          // Check if it's a voice message (contains voice/audio file path)
                          if (replyingTo.content.match(/\.(mp4|mp3|wav|m4a|ogg|aac|flac)$/i) ||
                            replyingTo.content.includes('voice_messages') ||
                            replyingTo.content.includes('audio')) {
                            return (
                              <>
                                <MicIcon sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                                Voice message
                              </>
                            );
                          }
                          // Check if it's an image (contains image file extensions or paths)
                          else if (replyingTo.content.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i) ||
                            replyingTo.content.includes('images') ||
                            replyingTo.content.includes('photos')) {
                            return (
                              <>
                                <ImageIcon sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                                Image
                              </>
                            );
                          }
                          // Check if it's a video
                          else if (replyingTo.content.match(/\.(mp4|mov|avi|mkv|webm)$/i) ||
                            replyingTo.content.includes('videos')) {
                            return (
                              <>
                                <VideocamIcon sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                                Video
                              </>
                            );
                          }
                          // Check if it's a document
                          else if (replyingTo.content.match(/\.(pdf|doc|docx|txt|rtf)$/i) ||
                            replyingTo.content.includes('documents')) {
                            return (
                              <>
                                <DescriptionIcon sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                                Document
                              </>
                            );
                          }
                          // Default to text message
                          else {
                            return replyingTo.content;
                          }
                        })()}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => setReplyingTo(null)}
                      sx={{ p: { xs: 0.5, sm: 0.75, md: 1 }, ml: 1 }}
                    >
                      <CloseIcon fontSize={isMobile ? 'small' : 'medium'} />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: { xs: 3, sm: 4, md: 2 },
                textAlign: 'center',
              }}
            >
              <ChatIcon sx={{ fontSize: { xs: 64, sm: 72, md: 80 }, color: 'grey.300', mb: 2 }} />
              <Typography
                variant="h6"
                color="text.secondary"
                sx={{ fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.25rem' }, mb: 1 }}
              >
                {isMobile ? 'Select a friend' : 'Choose a friend to start chatting'}
              </Typography>
              {isMobile && (
                <Button
                  variant="contained"
                  onClick={() => setMobileDrawerOpen(true)}
                  sx={{ mt: 2, borderRadius: '20px', px: 3, py: 1, fontSize: '0.9rem' }}
                >
                  Open Friends List
                </Button>
              )}
            </Box>
          )}

          {/* Message Input */}
          <Box
            sx={{
              position: { xs: 'sticky', sm: 'relative' },
              bottom: 0,
              p: { xs: 1.5, sm: 2, md: 2 },
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'white',
              display: 'flex',
              gap: { xs: 1, sm: 1.5, md: 1.5 },
              alignItems: 'flex-end',
              flexShrink: 0,
            }}
          >
            {/* Voice Recording UI */}
            {isRecording && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  bgcolor: 'error.main',
                  color: 'white',
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: '12px 12px 0 0',
                  boxShadow: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: 'white',
                    animation: 'pulse 1.5s infinite',
                  }} />
                  <Typography variant="body2" fontWeight="600">
                    Recording... {Math.floor(recordingTime / 60)}:
                    {(recordingTime % 60).toString().padStart(2, '0')}
                  </Typography>
                </Box>

                {/* Send and Stop buttons side by side */}
                <Button
                  variant="contained"
                  color="inherit"
                  size="small"
                  startIcon={<StopIcon />}
                  onClick={stopRecording}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
                >
                  Stop
                </Button>
              </Box>
            )}

            {/* Voice Message Preview - Shows after recording stops */}
            {audioUrl && !isRecording && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  bgcolor: voiceSending ? 'grey.500' : 'success.main',
                  color: 'white',
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: '12px 12px 0 0',
                  boxShadow: 3,
                  zIndex: 10,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <MicIcon sx={{ fontSize: '1.2rem' }} />
                  <Typography variant="body2" fontWeight="600">
                    {voiceSending ? 'Sending...' : `Voice recorded • ${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')}`}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  {/* CANCEL - Always available unless sending */}
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelRecording();
                    }}
                    disabled={voiceSending}
                    sx={{
                      borderColor: 'white',
                      color: 'white',
                      minWidth: 90,
                      '&:hover': {
                        borderColor: 'white',
                        bgcolor: 'rgba(255,255,255,0.15)',
                      },
                      '&.Mui-disabled': {
                        borderColor: 'rgba(255,255,255,0.3)',
                        color: 'rgba(255,255,255,0.3)',
                      },
                    }}
                  >
                    Cancel
                  </Button>

                  {/* SEND - Available when we have a recording */}
                  <Button
                    variant="contained"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      sendVoiceMessage();
                    }}
                    disabled={voiceSending || isUploadingVoice}
                    startIcon={
                      isUploadingVoice ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <SendIcon fontSize="small" />
                      )
                    }
                    sx={{
                      bgcolor: 'white',
                      color: 'success.main',
                      minWidth: 100,
                      '&:hover': {
                        bgcolor: 'grey.100',
                      },
                      '&.Mui-disabled': {
                        bgcolor: 'rgba(255,255,255,0.5)',
                        color: 'rgba(76, 175, 80, 0.5)',
                      },
                    }}
                  >
                    {isUploadingVoice ? 'Sending...' : 'Send'}
                  </Button>
                </Box>
              </Box>
            )}

            {/* Voice Record Button */}
            <IconButton
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!selectedFriend || uploadingImage}
              sx={{
                borderRadius: '50%',
                width: { xs: 44, sm: 46, md: 48 },
                height: { xs: 44, sm: 46, md: 48 },
                color: isRecording ? 'error.main' : (audioUrl ? 'success.main' : 'primary.main'),
                flexShrink: 0,
                border: audioUrl && !isRecording ? '2px solid' : 'none',
                borderColor: 'success.main',
              }}
            >
              {isRecording ? <StopIcon /> : <MicIcon />}
            </IconButton>

            {/* Upload Button */}
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="image-upload"
              type="file"
              onChange={handleFileSelect}
              disabled={!selectedFriend || uploadingImage}
            />
            <label htmlFor="image-upload">
              <IconButton
                component="span"
                disabled={!selectedFriend || uploadingImage}
                sx={{
                  borderRadius: '50%',
                  width: { xs: 44, sm: 46, md: 48 },
                  height: { xs: 44, sm: 46, md: 48 },
                  color: 'primary.main',
                  flexShrink: 0,
                }}
              >
                {uploadingImage ? <CircularProgress size={24} /> : <ImageIcon />}
              </IconButton>
            </label>

            {/* Message Input */}
            <TextField
              fullWidth
              size="small"
              placeholder={
                !selectedFriend
                  ? 'Select a friend...'
                  : isRecording
                    ? 'Recording voice...' // Change placeholder during recording
                    : replyingTo
                      ? `Replying to ${replyingTo.sender_id === profile?.id ? 'you' : selectedFriend.username}...`
                      : 'Type a message...'
              }
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
                  fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
                },
                bgcolor: '#f8f9fa',
              }}
            />

            {/* Send Button - Shows different states based on recording status */}
            {isRecording ? (
              // During recording - show send button that stops and sends immediately
              <IconButton
                color="success"
                onClick={quickSendVoice}
                disabled={!selectedFriend || recordingTime < 1}
                sx={{
                  borderRadius: '50%',
                  width: { xs: 44, sm: 46, md: 48 },
                  height: { xs: 44, sm: 46, md: 48 },
                  bgcolor: 'success.main',
                  color: 'white',
                  '&.Mui-disabled': { bgcolor: 'grey.300' },
                  flexShrink: 0,
                  animation: recordingTime >= 1 ? 'pulse 1s infinite' : 'none',
                }}
              >
                <SendIcon fontSize={isMobile ? 'small' : 'medium'} />
              </IconButton>
            ) : audioUrl && !isRecording ? (
              // After recording stopped - show send button for the recorded voice
              <IconButton
                color="primary"
                onClick={sendVoiceMessage}
                disabled={!selectedFriend || isUploadingVoice}
                sx={{
                  borderRadius: '50%',
                  width: { xs: 44, sm: 46, md: 48 },
                  height: { xs: 44, sm: 46, md: 48 },
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&.Mui-disabled': { bgcolor: 'grey.300' },
                  flexShrink: 0,
                }}
              >
                {isUploadingVoice ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
              </IconButton>
            ) : (
              // Normal state - show regular send button for text messages
              <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={
                  !selectedFriend}
                sx={{
                  borderRadius: '50%',
                  width: { xs: 44, sm: 46, md: 48 },
                  height: { xs: 44, sm: 46, md: 48 },
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&.Mui-disabled': { bgcolor: 'grey.300' },
                  flexShrink: 0,
                }}
              >
                {isUploadingVoice ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  <SendIcon fontSize={isMobile ? 'small' : 'medium'} />
                )}
              </IconButton>
            )}

            {/* Image Preview */}
            {imagePreview && (
              <Box sx={{ position: 'relative', mb: 1 }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: 100,
                    height: 100,
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                />
                <IconButton
                  size="small"
                  onClick={handleRemoveImagePreview}
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    bgcolor: 'error.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'error.dark' },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>
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