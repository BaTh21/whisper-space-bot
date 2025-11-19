import { useCallback, useRef } from 'react';

export const useTypingIndicator = ({
  selectedFriend,
  isConnected,
  sendWsMessage,
  isTyping,
  setIsTyping
}) => {
  const typingTimeoutRef = useRef(null);

  const handleTypingStart = useCallback(() => {
    if (!isTyping && selectedFriend && isConnected) {
      setIsTyping(true);
      sendWsMessage({ type: 'typing', is_typing: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => handleTypingStop(), 3000);
  }, [isTyping, selectedFriend, isConnected, sendWsMessage, setIsTyping]);

  const handleTypingStop = useCallback(() => {
    if (isTyping && selectedFriend && isConnected) {
      setIsTyping(false);
      sendWsMessage({ type: 'typing', is_typing: false });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isTyping, selectedFriend, isConnected, sendWsMessage, setIsTyping]);

  return {
    handleTypingStart,
    handleTypingStop
  };
};