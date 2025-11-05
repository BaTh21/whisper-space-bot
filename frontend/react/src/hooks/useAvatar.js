import { useMemo } from 'react';

export const useAvatar = () => {
  const cacheBuster = useMemo(() => Date.now(), []);

  const getAvatarUrl = useMemo(() => {
    return (url) => {
      // If no URL or invalid, return null to show initials
      if (!url || typeof url !== 'string' || url === 'undefined' || url === 'null' || url.trim() === '') {
        return null;
      }

      let cleanUrl = url.trim();
      
      // Remove any query parameters first
      cleanUrl = cleanUrl.split('?')[0];
      
      // If it's already a full URL, use it directly
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        return `${cleanUrl}?v=${cacheBuster}`;
      }

      // If it's just a filename (like "f42c2c73437e475f98a2e282ad61f12a.jpg")
      // Construct the proper URL
      const baseUrl = 'http://localhost:8000';
      
      // Ensure we don't have duplicate static/avatars in path
      if (cleanUrl.includes('static/avatars/')) {
        // Extract just the filename
        const filename = cleanUrl.split('static/avatars/').pop();
        return `${baseUrl}/static/avatars/${filename}?v=${cacheBuster}`;
      }
      
      // If it's just a plain filename
      if (cleanUrl.match(/^[a-f0-9]+\.(jpg|jpeg|png|gif|webp)$/i)) {
        return `${baseUrl}/static/avatars/${cleanUrl}?v=${cacheBuster}`;
      }

      // If it doesn't look like a valid image file, return null
      console.warn('Invalid avatar URL format:', url);
      return null;
    };
  }, [cacheBuster]);

  const getUserInitials = useMemo(() => {
    return (username) => {
      if (typeof username !== 'string' || !username.trim()) return 'U';
      
      const nameParts = username.trim().split(' ').filter(part => part.length > 0);
      if (nameParts.length === 1) {
        return nameParts[0].charAt(0).toUpperCase();
      } else {
        return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
      }
    };
  }, []);

  const getUserAvatar = useMemo(() => {
    return (user) => {
      if (!user) {
        console.log('No user provided for avatar');
        return null;
      }
      
      // Try different possible avatar fields
      const avatarUrl = user.avatar_url || user.avatar || user.profile_picture || user.image || user.avatar_image;
      
      console.log('Avatar lookup for user:', {
        username: user.username,
        avatarUrl: avatarUrl,
        userObject: user
      });
      
      const finalUrl = getAvatarUrl(avatarUrl);
      
      console.log('Final avatar URL:', finalUrl);
      
      return finalUrl;
    };
  }, [getAvatarUrl]);

  // Helper to create a placeholder avatar
  const getPlaceholderAvatar = useMemo(() => {
    return (username, size = 100) => {
      const name = username || 'User';
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=${size}`;
    };
  }, []);

  return {
    getAvatarUrl,
    getUserInitials,
    getUserAvatar,
    getPlaceholderAvatar
  };
};