import { useCallback } from 'react';
import { useWebSocket } from '../../../hooks/useWebSocket';
const getWebSocketBaseUrl = () => {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (!wsUrl) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return apiUrl.replace(/^http/, 'ws');
  }
  return wsUrl;
};

const BASE_URI = getWebSocketBaseUrl();

export const useChatWebSocket = ({
  selectedFriend,
  setMessages,
  setFriendTyping,
  setError,
  loadInitialMessages,
  getAvatarUrl,
  pinnedMessage,
  replyingTo
}) => {
  const getWsUrl = useCallback(() => {
    if (!selectedFriend) return null;
    const rawToken = localStorage.getItem('accessToken') || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
    return `${BASE_URI}/api/v1/ws/private/${selectedFriend.id}?token=${token}`;
  }, [selectedFriend]);

  const handleWebSocketMessage = useCallback((data) => {
    const { type } = data;

    if (type === 'message') {
      const detectMessageType = (msgData) => {
        if (msgData.message_type === 'image') return 'image';
        const content = msgData.content || '';
        const isImageUrl = 
          content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) || 
          content.includes('cloudinary.com') ||
          content.includes('res.cloudinary.com') ||
          content.startsWith('data:image/') ||
          content.startsWith('blob:');
        return isImageUrl ? 'image' : 'text';
      };

      const incomingMsg = {
        ...data,
        is_temp: false,
        sender: {
          id: data.sender_id,
          username: data.sender_username,
          avatar_url: getAvatarUrl(data.sender_username ? null : data.sender_id),
        },
        reply_to: data.reply_to
          ? { 
              ...data.reply_to, 
              sender_username: data.reply_to.sender_username,
              is_read: data.reply_to.is_read || false,
              read_at: data.reply_to.read_at
            }
          : null,
        message_type: detectMessageType(data),
        is_read: data.is_read || false,
        read_at: data.read_at,
        delivered_at: data.delivered_at
      };

      setMessages((prev) => {
        const filtered = prev.filter(
          (m) => !m.is_temp || m.content !== incomingMsg.content
        );
        if (filtered.some((m) => m.id === incomingMsg.id)) return filtered;

        return [...filtered, incomingMsg].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
      });

    } else if (type === 'read_receipt') {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.message_id
            ? { 
                ...msg, 
                is_read: true, 
                read_at: data.read_at,
                status: 'seen'
              }
            : msg
        )
      );
    } else if (type === 'typing') {
      setFriendTyping(data.is_typing);
    } else if (type === 'message_status_update') {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.message_id
            ? { 
                ...msg, 
                is_read: data.is_read || msg.is_read,
                read_at: data.read_at || msg.read_at,
                delivered_at: data.delivered_at || msg.delivered_at,
                status: data.status || msg.status
              }
            : msg
        )
      );
    } else if (type === 'message_deleted') {
      setMessages((prev) => prev.filter((msg) => msg.id !== data.message_id));
      if (pinnedMessage?.id === data.message_id) setPinnedMessage(null);
      if (replyingTo?.id === data.message_id) setReplyingTo(null);
    }
  }, [getAvatarUrl, pinnedMessage, replyingTo, setMessages, setFriendTyping]);

  const handleWebSocketOpen = useCallback(() => {
    console.log('[WS] Connected');
    setError(null);
    loadInitialMessages();
  }, [setError, loadInitialMessages]);

  const handleWebSocketClose = useCallback((event) => {
    console.log('[WS] Closed', event.code, event.reason);
    setFriendTyping(false);
  }, [setFriendTyping]);

  const handleWebSocketError = useCallback((error) => {
    console.error('[WS] Error', error);
    setError('Chat connection failed');
  }, [setError]);

  const handleReconnect = useCallback((attempt) => {
    console.log(`[WS] Reconnect #${attempt}`);
  }, []);

  const webSocket = useWebSocket(getWsUrl(), {
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

  return webSocket;
};