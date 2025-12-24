// Layout.jsx - Clean style time display
import { AppBar, Avatar, Box, Button, Drawer, IconButton, Menu, MenuItem, Tab, Tabs, Toolbar, Typography } from '@mui/material';
import Badge from '@mui/material/Badge';
import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMe, getActivityInbox } from '../services/api';
import DeleteDialog from './dialogs/DeleteDialog';
import LogoImg from '/whisperspace.png';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BlockIcon from '@mui/icons-material/Block';
import GroupsIcon from '@mui/icons-material/Groups';
import HomeIcon from '@mui/icons-material/Home';
import LanguageIcon from '@mui/icons-material/Language';
import LogoutIcon from '@mui/icons-material/Logout';
import MailIcon from '@mui/icons-material/Mail';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import PersonIcon from '@mui/icons-material/Person';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import ReviewsIcon from '@mui/icons-material/RateReview';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import InboxComponent from './dialogs/InboxComponent';

const Layout = ({ children, onProfileClick, setNewActiveTab }) => {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [popup, setPopup] = useState(false);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [showLabel, setShowLabel] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Language menu
  const [langAnchorEl, setLangAnchorEl] = useState(null);
  const langMenuOpen = Boolean(langAnchorEl);

  // Cambodia Time state
  const [currentTime, setCurrentTime] = useState('');
  const [activities, setActivities] = useState([]);

  const unreadCount = useMemo(
    () => activities.filter(a => !a.is_read).length,
    [activities]
  );

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

  // Function to update Cambodia time
  const updateCambodiaTime = () => {
    const now = new Date();

    // Cambodia is UTC+7 (Indochina Time)
    const options = {
      timeZone: 'Asia/Phnom_Penh',
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h12'
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);

    // Extract hour, minute, second, and dayPeriod (AM/PM)
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;
    const dayPeriod = parts.find(p => p.type === 'dayPeriod').value; // 'AM' or 'PM'

    const timeString = `${hour}:${minute}:${second} ${dayPeriod}`;
    setCurrentTime(timeString);
  };

  const fetchMe = async () => {
    try {
      const res = await getMe();
      setProfile(res);

      const acRes = await getActivityInbox();
      setActivities(acRes);
    } catch (error) {
      console.log("Failed to get profile", error);

      setActivities([]);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMe();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const currentTab = pathToTabMap[location.pathname] || 0;
    setActiveTab(currentTab);
  }, [location.pathname]);

  // Set up Cambodia time interval
  useEffect(() => {
    updateCambodiaTime();
    const intervalId = setInterval(updateCambodiaTime, 1000);
    return () => clearInterval(intervalId);
  }, []);

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

            {/* Right: Auth + Language + Time + User Menu */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {isAuthenticated && (
                <>

                  <Box sx={{
                    display: { xs: 'none', md: 'flex' },
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                  }}>
                    <AccessTimeIcon sx={{ fontSize: '0.9rem', opacity: 0.8 }} />
                    <Typography variant="body2" sx={{
                      fontWeight: 'medium',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      letterSpacing: '0.5px'
                    }}>
                      {currentTime}
                    </Typography>
                  </Box>

                  <Box sx={{
                    display: { xs: 'flex', md: 'none' },
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  }}>
                    <AccessTimeIcon sx={{ fontSize: '0.8rem' }} />
                    <Typography variant="caption" sx={{
                      fontSize: '0.75rem',
                      fontFamily: 'monospace'
                    }}>
                      {currentTime.replace(/:\d{2}($| )/g, '$1').trim()}
                    </Typography>
                  </Box>
                </>
              )}

              {isAuthenticated && (
                <>
                  <IconButton
                    color="inherit"
                    onClick={handleLangMenuOpen}
                    sx={{
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        transform: 'scale(1.05)'
                      },
                      transition: 'all 0.2s'
                    }}
                  >
                    <LanguageIcon />
                  </IconButton>
                  <Menu
                    anchorEl={langAnchorEl}
                    open={langMenuOpen}
                    onClose={handleLangMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    PaperProps={{
                      sx: {
                        mt: 1,
                        minWidth: 140,
                      }
                    }}
                  >
                    <MenuItem onClick={() => changeLanguage('en')}>
                      <img
                        src="/flags/uk.png"
                        alt="English"
                        style={{ width: 20, height: 14, marginRight: 8 }}
                      />
                      English
                    </MenuItem>
                    <MenuItem onClick={() => changeLanguage('km')}>
                      <img
                        src="/flags/kh.png"
                        alt="Khmer"
                        style={{ width: 20, height: 14, marginRight: 8 }}
                      />
                      ភាសាខ្មែរ
                    </MenuItem>
                  </Menu>
                </>
              )}

              {/* Guest Buttons */}
              {!isAuthenticated ? (
                <>
                  <Button
                    color="inherit"
                    component={Link}
                    to="/register"
                    sx={{
                      borderRadius: 20,
                      textTransform: 'none',
                      fontWeight: 500
                    }}
                  >
                    {t("register")}
                  </Button>
                  <Button
                    color="inherit"
                    component={Link}
                    to="/login"
                    sx={{
                      borderRadius: 20,
                      textTransform: 'none',
                      fontWeight: 500
                    }}
                  >
                    {t("login")}
                  </Button>
                </>
              ) : (
                /* Authenticated User */
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {/* Mail Icon */}
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <Badge
                      badgeContent={unreadCount}
                      color="error"
                      overlap="circular"
                      anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                      }}
                      sx={{
                        '& .MuiBadge-badge': {
                          fontSize: '0.7rem',
                          height: 18,
                          minWidth: 18,
                        },
                        mr: { xs: 0, sm: 2 },
                      }}
                    >
                      <IconButton
                        color="inherit"
                        onClick={() => setPopup(true)}
                        sx={{
                          p: 1,
                          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
                        }}
                      >
                        <MailIcon sx={{ fontSize: '1.5rem' }} />
                      </IconButton>
                    </Badge>

                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer',
                      '&:hover': { opacity: 0.9 }
                    }}
                    onClick={handleMenuOpen}
                  >
                    <Avatar
                      src={profile?.avatar_url}
                      sx={{
                        width: 32,
                        height: 32,
                        border: '2px solid rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      {profile?.username?.charAt(0) || "P"}
                    </Avatar>
                    <Typography sx={{
                      display: { xs: 'none', sm: 'block' },
                      fontWeight: 500,
                      fontSize: '0.95rem'
                    }}>
                      {profile?.username}
                    </Typography>
                  </Box>

                  <Menu
                    anchorEl={anchorEl}
                    open={menuOpen}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    PaperProps={{
                      sx: {
                        mt: 1,
                        minWidth: 180,
                      }
                    }}
                  >
                    <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); if (onProfileClick) onProfileClick(7); }}>
                      <PersonIcon sx={{ mr: 1.5, fontSize: '1.1rem' }} />
                      {t("profile")}
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); setOpen(true); }}>
                      <LogoutIcon sx={{ mr: 1.5, fontSize: '1.1rem' }} />
                      {t("logout")}
                    </MenuItem>
                  </Menu>
                </Box>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ mt: 0 }}>{children}</Box>

        {/* Dialogs */}
        {isAuthenticated &&
          <InboxComponent
            open={popup}
            onClose={() => {
              setPopup(false);
              fetchMe();
            }
            }
            onSuccess={handleSuccess} />}
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