import { useCallback } from 'react';
import { deleteImageMessage, deleteMessage } from '../../../services/api';

export const useMessageDeletion = ({
  setMessages,
  setPinnedMessage,
  setReplyingTo,
  setError,
  setSuccess
}) => {
  const handleDeleteMessage = useCallback(async (messageId, isTemp = false, messages) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const isImage = message.message_type === 'image';

    // Remove from UI immediately
    setMessages(prev => prev.filter(m => m.id !== messageId));
    if (setPinnedMessage && messageId === setPinnedMessage?.id) setPinnedMessage(null);
    if (setReplyingTo && messageId === setReplyingTo?.id) setReplyingTo(null);

    // Call API for non-temp messages
    if (!isTemp) {
      try {
        if (isImage) {
          await deleteImageMessage(messageId);
        } else {
          await deleteMessage(messageId);
        }
        setSuccess(isImage ? 'Image deleted' : 'Message deleted');
        setTimeout(() => setSuccess(null), 2000);
      } catch (err) {
        setError('Failed to delete message',err);
        // Revert UI change on error
        setMessages(prev => [...prev, message]);
      }
    }
  }, [setMessages, setPinnedMessage, setReplyingTo, setError, setSuccess]);

  return {
    handleDeleteMessage
  };
};