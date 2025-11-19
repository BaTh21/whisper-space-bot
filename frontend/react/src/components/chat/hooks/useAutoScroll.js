import { useCallback, useEffect, useRef } from 'react';

export const useAutoScroll = (messagesContainerRef) => {
  const lastMessageCount = useRef(0);

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
  }, [messagesContainerRef]);

  const useAutoScrollEffect = (messages, replyingTo, pinnedMessage, selectedFriend) => {
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
  };

  return {
    scrollToBottom,
    useAutoScrollEffect,
    lastMessageCount
  };
};