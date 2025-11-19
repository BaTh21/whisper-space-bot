import { useCallback } from 'react';
import { editMessage, getPrivateChat } from '../../../services/api';

export const useChatMessages = ({
  selectedFriend,
  profile,
  setMessages,
  setError,
  setSuccess,
  getUserAvatar
}) => {
  const loadInitialMessages = useCallback(async () => {
    if (!selectedFriend) return;

    try {
      const chatMessages = await getPrivateChat(selectedFriend.id);
      
      const enhanced = chatMessages.map((msg) => {
        const detectMessageType = (message) => {
          if (message.message_type === 'image') return 'image';
          const content = message.content || '';
          const isImageUrl = 
            content.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) || 
            content.includes('cloudinary.com') ||
            content.includes('res.cloudinary.com') ||
            content.startsWith('data:image/') ||
            content.startsWith('blob:');
          return isImageUrl ? 'image' : 'text';
        };

        return {
          ...msg,
          is_temp: false,
          message_type: detectMessageType(msg),
          sender: {
            id: msg.sender_id,
            username:
              msg.sender_id === profile?.id ? profile.username : selectedFriend.username,
            avatar_url: getUserAvatar(
              msg.sender_id === profile?.id ? profile : selectedFriend
            ),
          },
          reply_to: msg.reply_to
            ? {
                ...msg.reply_to,
                sender_username:
                  msg.reply_to.sender_id === profile?.id
                    ? profile.username
                    : selectedFriend.username,
              }
            : null,
        };
      });

      setMessages(
        enhanced.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      );
    } catch (err) {
      setError('Failed to load messages');
      console.error(err);
    }
  }, [selectedFriend, profile, setMessages, setError, getUserAvatar]);

  const handleEditMessage = useCallback(async (messageId, newContent, messages) => {
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
  }, [setMessages, setError, setSuccess]);

  const organizeMessagesIntoThreads = useCallback((list) => {
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
  }, []);

  const flattenThreads = useCallback((threads, level = 0) => {
    let flat = [];
    threads.forEach((t) => {
      flat.push({ ...t, threadLevel: level, isThreadStart: level === 0 && t.replies.length > 0 });
      if (t.replies.length) flat = flat.concat(flattenThreads(t.replies, level + 1));
    });
    return flat;
  }, []);

  const getThreadedMessages = useCallback((messages) => {
    return flattenThreads(organizeMessagesIntoThreads(messages));
  }, [organizeMessagesIntoThreads, flattenThreads]);

  return {
    loadInitialMessages,
    handleEditMessage,
    getThreadedMessages
  };
};