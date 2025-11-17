import MailIcon from '@mui/icons-material/Mail';
import { AppBar, Box, Button, Toolbar, Typography, Avatar, Menu, MenuItem } from '@mui/material';
import Badge from '@mui/material/Badge';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPendingGroupInvites, getMe } from '../services/api';
import InboxComponent from './dialogs/InboxComponentDialog';
import DeleteDialog from './dialogs/DeleteDialog';

const Layout = ({ children, onProfileClick }) => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [popup, setPopup] = useState(false);
  const [invites, setInvites] = useState([]);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const fetchInvites = async () => {
    try {
      const res = await getPendingGroupInvites();
      setInvites(res);
    } catch (error) {
      setInvites([]);
    }
  };

  const fetchMe = async () => {
    try {
      const res = await getMe();
      setProfile(res);
      console.log("Profile", res);
    } catch (error) {
      console.log("Failed to get profile", error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchInvites();
      fetchMe();
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSuccess = () => {
    setPopup(false);
    fetchInvites();
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const totalInvites = invites.length;

  return (
    <Box
      sx={{
        width: '100vw',
        minHeight: '100vh',
        background: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        m: 0,
        p: 0,
      }}
    >
      <AppBar position="static" sx={{ m: 0, px: 4 }}>
        <Toolbar sx={{ px: 2, py: 1, m: 0 }}>
          <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>
            Whisper Space
          </Typography>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {!isAuthenticated ? (
              <>
                <Button color="inherit" component={Link} to="/register" sx={{ borderRadius: 20 }}>
                  Register
                </Button>
                <Button color="inherit" component={Link} to="/login" sx={{ borderRadius: 20 }}>
                  Login
                </Button>
              </>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ mr: 3 }}>
                  <Badge badgeContent={totalInvites || 0} color="secondary">
                    <MailIcon sx={{ cursor: 'pointer' }} onClick={() => setPopup(true)} />
                  </Badge>
                </Box>

                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                  onClick={handleMenuOpen}
                >
                  <Avatar src={profile?.avatar_url} alt={profile?.username}>
                    {profile?.username?.charAt(0) || "P"}
                  </Avatar>
                  <Typography>{profile?.username}</Typography>
                </Box>

                {/* Profile Menu */}
                <Menu
                  anchorEl={anchorEl}
                  open={menuOpen}
                  onClose={handleMenuClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                >
                  <MenuItem
                    onClick={() => {
                      handleMenuClose();
                      if (onProfileClick) onProfileClick(7);
                    }}
                  >
                    Profile
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      handleMenuClose();
                      setOpen(true);
                    }}
                  >
                    Logout
                  </MenuItem>
                </Menu>
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Box>
        {children}
      </Box>

      {isAuthenticated && (
        <InboxComponent open={popup} onClose={() => setPopup(false)} onSuccess={handleSuccess} />
      )}

      <DeleteDialog
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={handleSuccess}
        title="Logout"
        tag="Logout"
        description="Are you sure want to logout?"
        onConfirm={handleLogout}
      />
    </Box>
  );
};

export default Layout;
