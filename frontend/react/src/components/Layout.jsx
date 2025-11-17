import { AppBar, Box, Button, Toolbar, Typography, Avatar, Menu, MenuItem, Tabs, Tab, IconButton, Drawer } from '@mui/material';
import Badge from '@mui/material/Badge';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPendingGroupInvites, getMe } from '../services/api';
import InboxComponent from './dialogs/InboxComponentDialog';
import DeleteDialog from './dialogs/DeleteDialog';
import LogoImg from '/whisperspace.png';

import MailIcon from '@mui/icons-material/Mail';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import ReviewsIcon from '@mui/icons-material/RateReview';
import PeopleIcon from '@mui/icons-material/People';
import GroupsIcon from '@mui/icons-material/Groups';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import BlockIcon from '@mui/icons-material/Block';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';

const Layout = ({ children, onProfileClick, setNewActiveTab }) => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [popup, setPopup] = useState(false);
  const [invites, setInvites] = useState([]);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [showLabel, setShowLabel] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [activeTab, setActiveTab] = useState(0);

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

  const handleHomePageClick = () => {
    navigate("/");
  }

  const totalInvites = invites.length;

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleTabChange = (event, newValue) => setActiveTab(newValue);

  const drawer = (
    <Box
      sx={{
        width: showLabel ? 200 : 40,
        transition: "width 0.25s",
        bgcolor: "white",
        borderRight: "1px solid #e2e2e2",
        display: "flex",
        flexDirection: "column",
        mt: { md: 1, xs: 0 }
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <IconButton onClick={() => setShowLabel(x => !x)}>
          <MenuIcon />
        </IconButton>
      </Box>
      <Tabs
        orientation="vertical"
        value={activeTab}
        onChange={handleTabChange}
        sx={{
          width: "100%",
          "& .MuiTab-root": {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: showLabel ? "flex-start" : "flex-start",
            gap: showLabel ? 1.5 : 0,
            px: showLabel ? 2 : 1,
            py: 1.2,
            mb: 0.5,
            minHeight: 48,
            textTransform: "none",
            fontSize: "0.9rem",
            color: "#5f6368",
            opacity: showLabel ? 1 : 0.9,
            transition: "0.2s",

            "&:hover": {
              bgcolor: "rgba(0,0,0,0.05)",
            },
          },

          "& .Mui-selected": {
            bgcolor: "primary.main",
            color: "white !important",
            fontWeight: "bold",
            "& .MuiSvgIcon-root": {
              color: "white !important",
            },
          },

          "& .MuiTab-iconWrapper": {
            marginBottom: "0 !important",
          },
        }}
      >
        <Tab
          onClick={() => {
            if (setNewActiveTab) setNewActiveTab(0)
          }}
          icon={<HomeIcon />} label={showLabel ? "Feed" : null} />
        <Tab
          onClick={() => {
            if (setNewActiveTab) setNewActiveTab(1)
          }}
          icon={<ReviewsIcon />} label={showLabel ? "Messages" : null} />
        <Tab
          onClick={() => {
            if (setNewActiveTab) setNewActiveTab(2)
          }}
          icon={<PeopleIcon />} label={showLabel ? "Friends" : null} />
        <Tab
          onClick={() => {
            if (setNewActiveTab) setNewActiveTab(3)
          }}
          icon={<GroupsIcon />} label={showLabel ? "Groups" : null} />
        <Tab
          onClick={() => {
            if (setNewActiveTab) setNewActiveTab(4)
          }}
          icon={<StickyNote2Icon />} label={showLabel ? "Notes" : null} />
        <Tab
          onClick={() => {
            if (setNewActiveTab) setNewActiveTab(5)
          }}
          icon={<PersonSearchIcon />} label={showLabel ? "Search" : null} />
        <Tab
          onClick={() => {
            if (setNewActiveTab) setNewActiveTab(6)
          }}
          icon={<BlockIcon />} label={showLabel ? "Blocked" : null} />
        <Tab
          onClick={() => {
            if (setNewActiveTab) setNewActiveTab(7)
          }}
          icon={<PersonIcon />} label={showLabel ? "Profile" : null} />
      </Tabs>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', width: '100vw', minHeight: '100vh' }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: showLabel ? 200 : 40,
          flexDirection: 'column',
          bgcolor: 'white',
          borderRight: '1px solid #e2e2e2',
          transition: "width 0.25s",
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton onClick={() => setShowLabel(x => !x)}>
            <MenuIcon />
          </IconButton>
        </Box>
        {drawer}
      </Box>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          "& .MuiDrawer-paper": { width: showLabel ? 200 : 40, },
        }}
      >
        {drawer}
      </Drawer>

      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="fixed">
          <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <IconButton color="inherit" onClick={handleDrawerToggle}>
                  <MenuIcon />
                </IconButton>
              </Box>
              <Box component="img" onClick={handleHomePageClick} src={LogoImg} alt="logo" sx={{ width: 50, '&:hover': { scale: 1.1 } }} />
              <Typography variant="h6" sx={{ display: { xs: 'none', sm: 'block' } }}>
                Whisper Space
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              {!isAuthenticated ? (
                <>
                  <Button color="inherit" component={Link} to="/register" sx={{ borderRadius: 20 }}>Register</Button>
                  <Button color="inherit" component={Link} to="/login" sx={{ borderRadius: 20 }}>Login</Button>
                </>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, }}>
                  <Badge badgeContent={totalInvites || 0} color="secondary"
                  sx={{
                    mr: {xs: 0, sm: 2}
                  }}
                  >
                    <MailIcon sx={{ cursor: 'pointer' }} onClick={() => setPopup(true)} />
                  </Badge>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={handleMenuOpen}>
                    <Avatar src={profile?.avatar_url}>{profile?.username?.charAt(0) || "P"}</Avatar>
                    <Typography>{profile?.username}</Typography>
                  </Box>

                  <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                    <MenuItem
                      onClick={() => { handleMenuClose(); if (onProfileClick) onProfileClick(7); }}>
                      <PersonIcon />
                      Profile
                    </MenuItem>
                    <MenuItem 
                    onClick={() => { handleMenuClose(); setOpen(true); }}>
                      <LogoutIcon/>
                      Logout
                      </MenuItem>
                  </Menu>
                </Box>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ mt: 8, p: 2 }}>
          {children}
        </Box>

        {isAuthenticated && <InboxComponent open={popup} onClose={() => setPopup(false)} onSuccess={handleSuccess} />}
        <DeleteDialog open={open} onClose={() => setOpen(false)} onSuccess={handleSuccess} title="Logout" tag="Logout" description="Are you sure want to logout?" onConfirm={handleLogout} />
      </Box>
    </Box>
  );
};

export default Layout;
