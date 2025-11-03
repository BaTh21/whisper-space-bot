import { useMemo } from 'react';

export const useAvatar = () => {
  const cacheBuster = useMemo(() => Date.now(), []);

  const getAvatarUrl = useMemo(() => {
    return (url) => {
      // If no URL or invalid, return null to show initials
      if (!url || typeof url !== 'string' || url === 'undefined' || url === 'null') {
        return null;
      }

      let cleanUrl = url;
      
      // Remove any query parameters first
      cleanUrl = cleanUrl.split('?')[0];
      
      // If it's already a full URL, use it directly
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        return `${cleanUrl}?v=${cacheBuster}`;
      }

      // Ensure the path is correct - remove any duplicate static/avatars
      if (cleanUrl.startsWith('/static/avatars/')) {
        cleanUrl = cleanUrl.replace('/static/avatars/', '');
      }
      
      // Remove any leading slashes
      cleanUrl = cleanUrl.replace(/^\/+/, '');
      
      // Construct the proper path
      const finalPath = `static/avatars/${cleanUrl}`;
      
      const baseUrl = 'http://localhost:8000';
      return `${baseUrl}/${finalPath}?v=${cacheBuster}`;
    };
  }, [cacheBuster]);

  // ... rest of the hook remains the same
  const getUserInitials = useMemo(() => {
    return (username) => {
      if (typeof username !== 'string' || !username.trim()) return 'U';
      return username.charAt(0).toUpperCase();
    };
  }, []);

  const getUserAvatar = useMemo(() => {
    return (user) => {
      if (!user) return null;
      const avatarUrl = user.avatar_url || user.avatar || user.profile_picture || user.image;
      return getAvatarUrl(avatarUrl);
    };
  }, [getAvatarUrl]);

  return {
    getAvatarUrl,
    getUserInitials,
    getUserAvatar
  };
};