import {
    Avatar,
    Box,
    Drawer,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Typography,
} from '@mui/material';

export const FriendsSidebar = ({
  friends,
  selectedFriend,
  onSelectFriend,
  mobileDrawerOpen,
  onCloseMobileDrawer,
  isMobile,
  getUserAvatar,
  getUserInitials
}) => {
  const FriendsList = () => (
    <>
      <Typography variant="h6" gutterBottom sx={{ 
        p: 2, 
        fontWeight: 700,
        color: 'text.primary',
        fontSize: isMobile ? '1.2rem' : { sm: '1.2rem', md: '1.3rem' },
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper'
      }}>
        Friends
      </Typography>
      <List sx={{ p: 1 }}>
        {friends.map((friend) => (
          <ListItem
            key={friend.id}
            selected={selectedFriend?.id === friend.id}
            onClick={() => onSelectFriend(friend)}
            sx={{
              borderRadius: '12px',
              mb: 1,
              mx: isMobile ? 0 : 0.5,
              px: isMobile ? 1.5 : { sm: 1.5, md: 2 },
              py: isMobile ? 1.25 : { sm: 1.25, md: 1.5 },
              transition: 'all 0.2s ease-in-out',
              cursor: 'pointer',
              '&:hover': { 
                bgcolor: 'action.hover',
                transform: 'translateY(-1px)',
                boxShadow: 1
              },
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                boxShadow: 2,
                '& .MuiListItemText-primary': { 
                  color: 'primary.contrastText',
                  fontWeight: 600 
                },
                '& .MuiListItemText-secondary': { 
                  color: 'primary.contrastText',
                  opacity: 0.9
                },
              },
            }}
          >
            <ListItemAvatar sx={{ minWidth: isMobile ? 48 : 44 }}>
              <Avatar 
                src={getUserAvatar(friend)} 
                sx={{ 
                  width: isMobile ? 48 : 44, 
                  height: isMobile ? 48 : 44,
                  border: '2px solid',
                  borderColor: selectedFriend?.id === friend.id ? 'white' : 'transparent'
                }}
              >
                {getUserInitials(friend.username)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Typography fontWeight="500" sx={{ 
                  fontSize: isMobile ? '1rem' : { sm: '0.95rem', md: '1.05rem' },
                  lineHeight: 1.2
                }}>
                  {friend.username}
                </Typography>
              }
              secondary={
                <Typography variant="body2" sx={{ 
                  fontSize: isMobile ? '0.8rem' : { sm: '0.8rem', md: '0.85rem' },
                  opacity: 0.7,
                  lineHeight: 1.2,
                  mt: 0.5
                }}>
                  {friend.email}
                </Typography>
              }
            />
            <Box sx={{ 
              width: isMobile ? 12 : 10, 
              height: isMobile ? 12 : 10, 
              borderRadius: '50%', 
              bgcolor: 'success.main', 
              ml: 1,
              border: '2px solid',
              borderColor: 'background.paper'
            }} />
          </ListItem>
        ))}
      </List>
    </>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileDrawerOpen}
        onClose={onCloseMobileDrawer}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { 
            width: 300, 
            boxSizing: 'border-box',
            background: 'linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)'
          },
        }}
      >
        <FriendsList />
      </Drawer>
    );
  }

  return (
    <Box
      sx={{
        width: { sm: 300, md: 320 },
        borderRight: 1,
        borderColor: 'divider',
        overflow: 'auto',
        flexShrink: 0,
        background: 'linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)'
      }}
    >
      <FriendsList />
    </Box>
  );
};