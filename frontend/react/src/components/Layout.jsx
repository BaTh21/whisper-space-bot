// Layout.jsx
import { AppBar, Avatar, Box, Button, Drawer, IconButton, Menu, MenuItem, Tab, Tabs, Toolbar, Typography } from '@mui/material';
import Badge from '@mui/material/Badge';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next'; // ← NEW
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMe, getPendingGroupInvites } from '../services/api';
import DeleteDialog from './dialogs/DeleteDialog';
import InboxComponent from './dialogs/InboxComponentDialog';
import LogoImg from '/whisperspace.png';

import BlockIcon from '@mui/icons-material/Block';
import GroupsIcon from '@mui/icons-material/Groups';
import HomeIcon from '@mui/icons-material/Home';
import LanguageIcon from '@mui/icons-material/Language'; // ← NEW (for switcher)
import LogoutIcon from '@mui/icons-material/Logout';
import MailIcon from '@mui/icons-material/Mail';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import PersonIcon from '@mui/icons-material/Person';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import ReviewsIcon from '@mui/icons-material/RateReview';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';

const Layout = ({ children, onProfileClick, setNewActiveTab }) => {
  const { t, i18n } = useTranslation(); // ← NEW
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [popup, setPopup] = useState(false);
  const [invites, setInvites] = useState([]);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [showLabel, setShowLabel] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Language menu
  const [langAnchorEl, setLangAnchorEl] = useState(null);
  const langMenuOpen = Boolean(langAnchorEl);

  const pathToTabMap = {
    '/feed': 0,
    '/messages': 1,
    '/friends': 2,
    '/groups': 3,
    '/notes': 4,
    '/search': 5,
    '/blocked': 6,
    '/profile': 7,
  };

  const [activeTab, setActiveTab] = useState(pathToTabMap[location.pathname] || 0);
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

  useEffect(() => {
    const currentTab = pathToTabMap[location.pathname] || 0;
    setActiveTab(currentTab);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSuccess = () => {
    setPopup(false);
    fetchInvites();
  };

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLangMenuOpen = (event) => setLangAnchorEl(event.currentTarget);
  const handleLangMenuClose = () => setLangAnchorEl(null);
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    handleLangMenuClose();
  };

  const handleHomePageClick = () => navigate("/feed");
  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const totalInvites = invites.length;

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    const tabToPathMap = {
      0: '/feed', 1: '/messages', 2: '/friends', 3: '/groups',
      4: '/notes', 5: '/search', 6: '/blocked', 7: '/profile',
    };
    const newPath = tabToPathMap[newValue] || '/feed';
    navigate(newPath);
    if (setNewActiveTab) setNewActiveTab(newValue);
  };

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
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
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
            "&:hover": { bgcolor: "rgba(0,0,0,0.05)" },
          },
          "& .Mui-selected": {
            bgcolor: "primary.main",
            color: "white !important",
            fontWeight: "bold",
            "& .MuiSvgIcon-root": { color: "white !important" },
          },
          "& .MuiTab-iconWrapper": { marginBottom: "0 !important" },
        }}
      >
        <Tab icon={<HomeIcon />} label={showLabel ? t("feed") : null} />
        <Tab icon={<ReviewsIcon />} label={showLabel ? t("messages") : null} />
        <Tab icon={<PeopleIcon />} label={showLabel ? t("friends") : null} />
        <Tab icon={<GroupsIcon />} label={showLabel ? t("groups") : null} />
        <Tab icon={<StickyNote2Icon />} label={showLabel ? t("notes") : null} />
        <Tab icon={<PersonSearchIcon />} label={showLabel ? t("search") : null} />
        <Tab icon={<BlockIcon />} label={showLabel ? t("blocked") : null} />
        <Tab icon={<PersonIcon />} label={showLabel ? t("profile") : null} />
      </Tabs>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', width: '100vw', minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
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

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          "& .MuiDrawer-paper": { width: showLabel ? 200 : 40 },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="fixed">
          <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
            {/* Left: Logo + Mobile Menu */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <IconButton color="inherit" onClick={handleDrawerToggle}>
                  <MenuIcon />
                </IconButton>
              </Box>
              <Box component="img" onClick={handleHomePageClick} src={LogoImg} alt="logo" sx={{ width: 50, '&:hover': { scale: 1.1 } }} />
              <Typography variant="h6" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {t("appName")}
              </Typography>
            </Box>

            {/* Right: Auth + Language + User Menu */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {/* Language Switcher (globe icon) */}
              {isAuthenticated && (
                <>
                  <IconButton color="inherit" onClick={handleLangMenuOpen}>
                    <LanguageIcon />
                  </IconButton>
                  <Menu
                    anchorEl={langAnchorEl}
                    open={langMenuOpen}
                    onClose={handleLangMenuClose}
                  >
                    <MenuItem onClick={() => changeLanguage('en')}>English</MenuItem>
                    <MenuItem onClick={() => changeLanguage('km')}>ភាសាខ្មែរ</MenuItem>
                  </Menu>
                </>
              )}

              {/* Guest Buttons */}
              {!isAuthenticated ? (
                <>
                  <Button color="inherit" component={Link} to="/register" sx={{ borderRadius: 20 }}>
                    {t("register")}
                  </Button>
                  <Button color="inherit" component={Link} to="/login" sx={{ borderRadius: 20 }}>
                    {t("login")}
                  </Button>
                </>
              ) : (
                /* Authenticated User */
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Badge badgeContent={totalInvites || 0} color="secondary" sx={{ mr: { xs: 0, sm: 2 } }}>
                    <MailIcon sx={{ cursor: 'pointer' }} onClick={() => setPopup(true)} />
                  </Badge>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={handleMenuOpen}>
                    <Avatar src={profile?.avatar_url}>{profile?.username?.charAt(0) || "P"}</Avatar>
                    <Typography>{profile?.username}</Typography>
                  </Box>

                  <Menu
                    anchorEl={anchorEl}
                    open={menuOpen}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); if (onProfileClick) onProfileClick(7); }}>
                      <PersonIcon sx={{ mr: 1 }} />
                      {t("profile")}
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); setOpen(true); }}>
                      <LogoutIcon sx={{ mr: 1 }} />
                      {t("logout")}
                    </MenuItem>
                  </Menu>
                </Box>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ mt: 8 }}>{children}</Box>

        {/* Dialogs */}
        {isAuthenticated && <InboxComponent open={popup} onClose={() => setPopup(false)} onSuccess={handleSuccess} />}
        <DeleteDialog
          open={open}
          onClose={() => setOpen(false)}
          title={t("logout")}
          tag="Logout"
          description={t("logoutConfirm")}
          onConfirm={handleLogout}
        />
      </Box>
    </Box>
  );
};

export default Layout;