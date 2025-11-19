import { useCallback, useEffect } from 'react';

export const useReadReceipt = ({
  selectedFriend,
  messages,
  isConnected,
  sendWsMessage,
  messagesContainerRef
}) => {
  const sendReadReceipt = useCallback((messageId) => {
    if (isConnected && messageId) {
      sendWsMessage({
        type: 'read_receipt',
        message_id: messageId,
        read_at: new Date().toISOString()
      });
    }
  }, [isConnected, sendWsMessage]);

  const markMessagesAsRead = useCallback((setMessages) => {
    if (!selectedFriend || !messages.length) return;

    const unreadMessages = messages.filter(
      msg => msg.sender_id === selectedFriend.id && !msg.is_read
    );

    if (unreadMessages.length > 0 && isConnected) {
      const lastUnreadMessage = unreadMessages[unreadMessages.length - 1];
      
      // Update local state immediately
      setMessages(prev => prev.map(msg => 
        msg.sender_id === selectedFriend.id && !msg.is_read 
          ? { ...msg, is_read: true, read_at: new Date().toISOString() }
          : msg
      ));

      // Send read receipt
      sendReadReceipt(lastUnreadMessage.id);
    }
  }, [messages, selectedFriend, isConnected, sendReadReceipt]);

  const handleScroll = useCallback((setMessages) => {
    if (!messagesContainerRef.current || !selectedFriend) return;

    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isNearBottom) {
      markMessagesAsRead(setMessages);
    }
  }, [selectedFriend, markMessagesAsRead, messagesContainerRef]);

  return {
    sendReadReceipt,
    markMessagesAsRead,
    handleScroll
  };
};