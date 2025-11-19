import { useCallback } from 'react';
import { sendImageMessage, uploadImage } from '../../../services/api';

export const useImageUpload = ({
  selectedFriend,
  profile,
  setMessages,
  setError,
  setUploadingImage,
  setImagePreview,
  sendWsMessage,
  getUserAvatar
}) => {
  const handleImageUpload = useCallback(async (file) => {
    if (!selectedFriend) return;

    const tempId = `temp-img-${Date.now()}`;
    
    try {
      setUploadingImage(true);
      
      console.log('Starting image upload...');
      
      // Upload image to get URL
      const result = await uploadImage(selectedFriend.id, file);
      console.log('Upload result:', result);
      
      const { url } = result;
      
      // Create temp message with EXPLICIT image type
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

      // Add to messages immediately
      setMessages((prev) => [...prev, tempMsg]);
      setImagePreview(null);

      // Send via WebSocket
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
        // HTTP fallback
        try {
          const sentMessage = await sendImageMessage(selectedFriend.id, url);
          console.log('HTTP response:', sentMessage);
          
          // Replace temp message with real message
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
          // Keep the temp message for now
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload image: ' + (err.message || 'Unknown error'));
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setUploadingImage(false);
    }
  }, [selectedFriend, profile, setMessages, setError, setUploadingImage, setImagePreview, sendWsMessage, getUserAvatar]);

  const handleFileSelect = useCallback((event, setError) => {
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

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Upload the image
    handleImageUpload(file);
  }, [handleImageUpload, setImagePreview]);

  return {
    handleImageUpload,
    handleFileSelect
  };
};