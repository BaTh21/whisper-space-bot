import { useEffect, useRef, useState } from 'react';
import { deleteMessage, editMessage, getPrivateChat, sendPrivateMessage } from '../services/api';

export const useMessages = (selectedFriend, profile) => {
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!selectedFriend) {
      setMessages([]);
      return;
    }

    let isSubscribed = true;

    const pollMessages = async () => {
      try {
        const chatMessages = await getPrivateChat(selectedFriend.id);
        
        if (isSubscribed) {
          const enhancedMessages = chatMessages.map(message => ({
            ...message,
            sender: {
              username: message.sender_id === profile?.id 
                ? profile?.username 
                : selectedFriend?.username || 'Unknown User',
              avatar_url: message.sender_id === profile?.id 
                ? profile?.avatar_url 
                : selectedFriend?.avatar_url,
              id: message.sender_id === profile?.id ? profile?.id : selectedFriend?.id
            },
            is_read: message.is_read || false
          }));
          
          const sortedMessages = enhancedMessages.sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
          );

          setMessages(prev => {
            if (JSON.stringify(prev) === JSON.stringify(sortedMessages)) {
              return prev;
            }
            return sortedMessages;
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    pollMessages();
    const pollInterval = setInterval(pollMessages, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [selectedFriend?.id, profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleEditMessage = async (messageId, newContent) => {
    try {
      const updatedMessage = await editMessage(messageId, newContent);
      const enhancedMessage = {
        ...updatedMessage,
        sender: {
          username: updatedMessage.sender_id === profile?.id 
            ? profile?.username 
            : selectedFriend?.username || 'Unknown User',
          avatar_url: updatedMessage.sender_id === profile?.id 
            ? profile?.avatar_url 
            : selectedFriend?.avatar_url,
          id: updatedMessage.sender_id === profile?.id ? profile?.id : selectedFriend?.id
        }
      };
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...enhancedMessage, is_temp: false }
            : msg
        )
      );
      return true;
    } catch (err) {
      console.error('Edit message error:', err);
      return false;
    }
  };

  const handleDeleteMessage = async (messageId) => {
    setMessages(prev => prev.filter(msg => String(msg.id) !== String(messageId)));
    
    try {
      await deleteMessage(messageId);
      return true;
    } catch (err) {
      console.error('Backend delete failed:', err);
      return false;
    }
  };

  const handleSendMessage = async (messageContent, replyingTo = null) => {
    if (!messageContent.trim() || !selectedFriend) return null;

    setMessageLoading(true);

    try {
      const tempMessage = {
        id: Date.now(),
        sender_id: profile.id,
        receiver_id: selectedFriend.id,
        content: messageContent,
        message_type: 'text',
        is_read: false,
        created_at: new Date().toISOString(),
        is_temp: true,
        reply_to_id: replyingTo?.id || null,
        reply_to: replyingTo || null,
        sender: {
          username: profile.username,
          avatar_url: profile.avatar_url,
          id: profile.id
        }
      };

      setMessages(prev => [...prev, tempMessage]);

      const sentMessage = await sendPrivateMessage(selectedFriend.id, { 
        content: messageContent, 
        message_type: 'text',
        reply_to_id: replyingTo?.id || null,
      });

      const enhancedSentMessage = {
        ...sentMessage,
        sender: {
          username: profile.username,
          avatar_url: profile.avatar_url,
          id: profile.id
        },
        is_temp: false,
        is_read: sentMessage.is_read || false
      };

      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.is_temp);
        const newMessages = [...filtered, enhancedSentMessage];
        return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

      return enhancedSentMessage;
    } catch (err) {
      setMessages(prev => prev.filter(msg => !msg.is_temp));
      throw err;
    } finally {
      setMessageLoading(false);
    }
  };

  const loadMessages = async (friend) => {
    if (!friend) return;
    
    setIsLoadingMessages(true);
    try {
      const chatMessages = await getPrivateChat(friend.id);
      const enhancedMessages = chatMessages.map(message => ({
        ...message,
        sender: {
          username: message.sender_id === profile?.id 
            ? profile?.username 
            : friend?.username || 'Unknown User',
          avatar_url: message.sender_id === profile?.id 
            ? profile?.avatar_url 
            : friend?.avatar_url,
          id: message.sender_id === profile?.id ? profile?.id : friend?.id
        },
        is_read: message.is_read || false
      }));
      
      const sortedMessages = enhancedMessages.sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      );
      setMessages(sortedMessages);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages([]);
      throw err;
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    isLoadingMessages,
    messageLoading,
    messagesEndRef,
    handleEditMessage,
    handleDeleteMessage,
    handleSendMessage,
    loadMessages,
    clearMessages,
    setMessages
  };
};