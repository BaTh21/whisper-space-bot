import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useCallback, useRef } from 'react';
import { ChatHeader } from '../chat/components/ChatHeader';
import { DeleteConfirmationDialog } from '../chat/components/DeleteConfirmationDialog';
import { EmptyChatState } from '../chat/components/EmptyChatState';
import ForwardMessageDialog from '../chat/components/ForwardMessageDialog';
import { FriendsSidebar } from '../chat/components/FriendsSidebar';
import { MessageInput } from '../chat/components/MessageInput';
import { MessagesList } from '../chat/components/MessagesList';
import { PinnedMessage } from '../chat/components/PinnedMessage';
import { ReplyPreview } from '../chat/components/ReplyPreview';
import { useAutoScroll } from '../chat/hooks/useAutoScroll';
import { useAvatar } from '../chat/hooks/useAvatar';
import { useChatMessages } from '../chat/hooks/useChatMessages';
import { useChatUI } from '../chat/hooks/useChatUI';
import { useChatWebSocket } from '../chat/hooks/useChatWebSocket';
import { useImageUpload } from '../chat/hooks/useImageUpload';
import { useMessageDeletion } from '../chat/hooks/useMessageDeletion';
import { useReadReceipt } from '../chat/hooks/useReadReceipt';
import { useTypingIndicator } from '../chat/hooks/useTypingIndicator';

const MessagesTab = ({ friends, profile, setError, setSuccess }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { getAvatarUrl, getUserInitials, getUserAvatar } = useAvatar(); // Fixed: use hook correctly

  // Refs
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // UI State Management
  const {
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
    setMessages,
    setNewMessage,
    setReplyingTo,
    setForwardDialogOpen,
    setPinnedMessage,
    setMobileDrawerOpen,
    setFriendTyping,
    setUploadingImage,
    setImagePreview,
    setDeleteConfirmOpen,
    setMessageToDelete,
    setIsTyping,
    handleSelectFriend,
    clearChatState,
    handleReply,
    handlePinMessage,
    handleForward
  } = useChatUI();

  // Messages Management
  const {
    loadInitialMessages,
    handleEditMessage,
    getThreadedMessages
  } = useChatMessages({
    selectedFriend,
    profile,
    setMessages,
    setError,
    setSuccess,
    getUserAvatar
  });

  // WebSocket Management
  const {
    sendMessage: sendWsMessage,
    closeConnection,
    isConnected,
    reconnectAttempts,
  } = useChatWebSocket({
    selectedFriend,
    setMessages,
    setFriendTyping,
    setError,
    loadInitialMessages,
    getAvatarUrl,
    pinnedMessage,
    replyingTo
  });

  // Typing Indicator
  const {
    handleTypingStart,
    handleTypingStop
  } = useTypingIndicator({
    selectedFriend,
    isConnected,
    sendWsMessage,
    isTyping,
    setIsTyping
  });

  // Read Receipt
  const {
    handleScroll: handleScrollWithReceipt
  } = useReadReceipt({
    selectedFriend,
    messages,
    isConnected,
    sendWsMessage,
    messagesContainerRef
  });

  // Image Upload
  const {
    handleFileSelect
  } = useImageUpload({
    selectedFriend,
    profile,
    setMessages,
    setError,
    setUploadingImage,
    setImagePreview,
    sendWsMessage,
    getUserAvatar
  });

  // Message Deletion
  const {
    handleDeleteMessage
  } = useMessageDeletion({
    setMessages,
    setPinnedMessage,
    setReplyingTo,
    setError,
    setSuccess
  });

  // Auto Scroll
  const {
    useAutoScrollEffect
  } = useAutoScroll(messagesContainerRef);

  // Apply auto-scroll effects
  useAutoScrollEffect(messages, replyingTo, pinnedMessage, selectedFriend);

  // Read receipt scroll handler
  const handleScroll = useCallback(() => {
    handleScrollWithReceipt(setMessages);
  }, [handleScrollWithReceipt, setMessages]);

  // Connection status
  const getConnectionStatus = useCallback(() => {
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
    }, [friendTyping, isConnected, reconnectAttempts, messages, selectedFriend]);

  const status = selectedFriend
    ? getConnectionStatus()
    : { text: 'Online', color: 'success.main' };

  // Send message handler
  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !selectedFriend) return;

    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      sender_id: profile.id,
      receiver_id: selectedFriend.id,
      content,
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

    const payload = {
      type: 'message',
      content,
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

  // Input change handler
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim() && selectedFriend && isConnected) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  // File select handler
  const handleFileSelectWrapper = (event) => {
    handleFileSelect(event, setError);
  };

  const handleRemoveImagePreview = () => {
    setImagePreview(null);
  };

  // Delete message handler
  const handleDeleteMessageWrapper = (messageId, isTemp = false) => {
    handleDeleteMessage(messageId, isTemp, messages);
  };

  const confirmDelete = async () => {
    if (!messageToDelete) return;

    const { id, isTemp, message } = messageToDelete;
    await handleDeleteMessageWrapper(id, isTemp);
    setDeleteConfirmOpen(false);
    setMessageToDelete(null);
  };

  // Seen status logic
  const lastMyMessage = messages
    .filter(msg => msg.sender_id === profile?.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  const lastMessageSeen = lastMyMessage?.is_read;

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
      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        messageToDelete={messageToDelete}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
      />

      <ChatHeader
        selectedFriend={selectedFriend}
        status={status}
        isMobile={isMobile}
        onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
        onCloseChat={() => setSelectedFriend(null)}
        getUserAvatar={getUserAvatar}
      />

      <Box sx={{ display: 'flex', flex: 1, flexDirection: { xs: 'column', sm: 'row', md: 'row' } }}>
        <FriendsSidebar
          friends={friends}
          selectedFriend={selectedFriend}
          onSelectFriend={(friend) => handleSelectFriend(friend, closeConnection, isMobile)}
          mobileDrawerOpen={mobileDrawerOpen}
          onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
          isMobile={isMobile}
          getUserAvatar={getUserAvatar}
          getUserInitials={getUserInitials}
        />

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
              <PinnedMessage
                pinnedMessage={pinnedMessage}
                onUnpin={() => setPinnedMessage(null)}
                profile={profile}
                selectedFriend={selectedFriend}
                getUserAvatar={getUserAvatar}
                isMobile={isMobile}
              />

              <MessagesList
                messages={messages}
                threadedMessages={getThreadedMessages(messages)}
                messagesContainerRef={messagesContainerRef}
                selectedFriend={selectedFriend}
                profile={profile}
                onEditMessage={(messageId, newContent) => handleEditMessage(messageId, newContent, messages)}
                onDeleteMessage={handleDeleteMessageWrapper}
                onReply={handleReply}
                onForward={handleForward}
                onPin={handlePinMessage}
                getAvatarUrl={getAvatarUrl}
                getUserInitials={getUserInitials}
                pinnedMessage={pinnedMessage}
                isMobile={isMobile}
                lastMessageSeen={lastMessageSeen}
                onScroll={handleScroll}
              />

              <ReplyPreview
                replyingTo={replyingTo}
                profile={profile}
                selectedFriend={selectedFriend}
                onCancelReply={() => setReplyingTo(null)}
                isMobile={isMobile}
              />
            </>
          ) : (
            <EmptyChatState
              isMobile={isMobile}
              onOpenFriendsList={() => setMobileDrawerOpen(true)}
            />
          )}

          <MessageInput
            selectedFriend={selectedFriend}
            newMessage={newMessage}
            onInputChange={handleInputChange}
            onSendMessage={handleSendMessage}
            replyingTo={replyingTo}
            uploadingImage={uploadingImage}
            imagePreview={imagePreview}
            onFileSelect={handleFileSelectWrapper}
            onRemoveImagePreview={handleRemoveImagePreview}
            isMobile={isMobile}
          />
        </Box>
      </Box>

      <ForwardMessageDialog
        open={forwardDialogOpen}
        onClose={() => setForwardDialogOpen(false)}
        message={forwardingMessage}
        friends={friends.filter((f) => f.id !== selectedFriend?.id)}
        onForward={() => {}}
        getAvatarUrl={getAvatarUrl}
        getUserInitials={getUserInitials}
      />
    </Box>
  );
};

export default MessagesTab;