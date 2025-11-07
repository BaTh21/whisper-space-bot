import { useCallback, useState } from 'react';

export const useAvatar = () => {
  const [failedAvatars, setFailedAvatars] = useState(new Set());

  const getAvatarUrl = useCallback((avatarUrl) => {
    if (!avatarUrl) return null;
    
    // If we already know this avatar failed, return null
    if (failedAvatars.has(avatarUrl)) {
      return null;
    }
    
    // Return the URL as-is (remove cache busting to avoid 404s)
    return avatarUrl;
  }, [failedAvatars]);

  const handleAvatarError = useCallback((avatarUrl) => {
    if (avatarUrl) {
      console.log('Avatar failed to load:', avatarUrl);
      setFailedAvatars(prev => new Set(prev).add(avatarUrl));
    }
  }, []);

  const getUserAvatar = useCallback((user) => {
    if (!user) return null;
    
    const avatarUrl = user.avatar_url || user.avatar;
    if (!avatarUrl) return null;
    
    if (failedAvatars.has(avatarUrl)) {
      return null;
    }
    
    return avatarUrl;
  }, [failedAvatars]);

  const getUserInitials = useCallback((username) => {
    if (!username) return 'U';
    
    const names = username.split(' ');
    let initials = names[0].charAt(0).toUpperCase();
    
    if (names.length > 1) {
      initials += names[names.length - 1].charAt(0).toUpperCase();
    }
    
    return initials;
  }, []);

  return {
    getAvatarUrl,
    getUserAvatar,
    getUserInitials,
    handleAvatarError // Make sure this is returned
  };
};