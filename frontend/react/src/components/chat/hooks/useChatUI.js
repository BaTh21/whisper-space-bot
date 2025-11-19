import { useState, useCallback } from 'react';

export const useChatUI = () => {
  const [selectedFriend, setSelectedFriend] = useState(null);
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
  const [isTyping, setIsTyping] = useState(false);

  const handleSelectFriend = useCallback((friend, closeConnection, isMobile) => {
    if (isMobile) setMobileDrawerOpen(false);
    if (selectedFriend) closeConnection(1000, 'Switching friends');
    setSelectedFriend(friend);
    clearChatState();
  }, [selectedFriend]);

  const clearChatState = useCallback(() => {
    setMessages([]);
    setReplyingTo(null);
    setPinnedMessage(null);
    setNewMessage('');
    setFriendTyping(false);
    setIsTyping(false);
    setImagePreview(null);
  }, []);

  const handleReply = useCallback((msg) => {
    if (msg && msg.id) {
      setReplyingTo(msg);
    }
  }, []);

  const handlePinMessage = useCallback((msg) => {
    setPinnedMessage(pinnedMessage?.id === msg.id ? null : msg);
  }, [pinnedMessage]);

  const handleForward = useCallback((msg) => {
    setForwardingMessage(msg);
    setForwardDialogOpen(true);
  }, []);

  return {
    // State
    selectedFriend,
    messages,
    newMessage,
    replyingTo,
    forwardingMessage,
    forwardDialogOpen,
    pinnedMessage,
    mobileDrawerOpen,
    friendTyping,
    uploadingImage,
    imagePreview,
    deleteConfirmOpen,
    messageToDelete,
    isTyping,

    // Setters
    setMessages,
    setNewMessage,
    setReplyingTo,
    setForwardingMessage,
    setForwardDialogOpen,
    setPinnedMessage,
    setMobileDrawerOpen,
    setFriendTyping,
    setUploadingImage,
    setImagePreview,
    setDeleteConfirmOpen,
    setMessageToDelete,
    setIsTyping,

    // Handlers
    handleSelectFriend,
    clearChatState,
    handleReply,
    handlePinMessage,
    handleForward
  };
};