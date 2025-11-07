// /src/components/UserAvatar.jsx
import { Avatar } from '@mui/material';
import { useState } from 'react';

const UserAvatar = ({ user, size = 32, ...props }) => {
  const [imageFailed, setImageFailed] = useState(false);
  
  const getAvatarUrl = (avatarUrl) => {
    if (!avatarUrl || imageFailed) return null;
    return `${avatarUrl}?v=${Date.now()}`;
  };

  const getInitials = (username) => {
    if (!username) return 'U';
    
    const names = username.split(' ');
    let initials = names[0].charAt(0).toUpperCase();
    
    if (names.length > 1) {
      initials += names[names.length - 1].charAt(0).toUpperCase();
    }
    
    return initials;
  };

  const avatarUrl = getAvatarUrl(user?.avatar_url || user?.avatar);
  const initials = getInitials(user?.username);

  return (
    <Avatar
      src={avatarUrl}
      onError={() => setImageFailed(true)}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        bgcolor: avatarUrl && !imageFailed ? 'transparent' : 'primary.main',
        fontWeight: 'bold',
        ...props.sx
      }}
      {...props}
    >
      {initials}
    </Avatar>
  );
};

export default UserAvatar;