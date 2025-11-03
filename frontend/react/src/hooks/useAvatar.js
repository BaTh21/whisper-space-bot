import { useMemo } from 'react';

export const useAvatar = () => {
  // Use a single cache buster that changes only when needed
  const cacheBuster = useMemo(() => Date.now(), []); // Only set once on mount

  const getAvatarUrl = useMemo(() => {
    return (url) => {
      // Add comprehensive type checking
      if (!url || url === 'undefined' || url === 'null' || typeof url !== 'string') {
        return null;
      }

      // Remove existing cache busting parameters
      const cleanUrl = url.split('?')[0];
      
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        return `${cleanUrl}?v=${cacheBuster}`;
      }

      const baseUrl = 'http://localhost:8000';
      const finalUrl = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
      return `${baseUrl}${finalUrl}?v=${cacheBuster}`;
    };
  }, [cacheBuster]);

  const getUserInitials = useMemo(() => {
    return (username) => {
      // Add type checking for username
      if (typeof username !== 'string') return 'U';
      return username?.charAt(0)?.toUpperCase() || 'U';
    };
  }, []);

  const getUserAvatar = useMemo(() => {
    return (user) => {
      if (!user) return null;
      
      // Safely access the avatar_url property
      const avatarUrl = user.avatar_url || user.avatar || user.profilePicture;
      return getAvatarUrl(avatarUrl);
    };
  }, [getAvatarUrl]);

  return {
    getAvatarUrl,
    getUserInitials,
    getUserAvatar
  };
};