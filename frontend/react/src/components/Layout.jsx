import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Badge from '@mui/material/Badge';
import MailIcon from '@mui/icons-material/Mail';
import { useEffect, useState } from 'react';
import InboxComponent from './dialogs/InboxComponentDialog';
import { getUserInvites } from '../services/api';

const Layout = ({ children }) => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [popup, setPopup] = useState(false);
  const [invites, setInvites] = useState([]);

  const fetchInvites = async () => {
    try {
      const res = await getUserInvites();
      setInvites(res);
    } catch (error) {
      console.error("Error fetching invites:", error);
      setInvites([]);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSuccess = () => {
    setPopup(false);
  }

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
      <AppBar position="static">
        <Toolbar
          sx={{
            px: { xs: 1, sm: 2 },
            py: { xs: 1, sm: 1.5 },
          }}
        >
          <Typography
            variant="h5"
            component="div"
            sx={{ flexGrow: 1, fontSize: { xs: '1.2rem', sm: '1.5rem' } }}
            aria-label="Whisper Space Logo"
          >
            Whisper Space
          </Typography>
          <Box sx={{ marginRight: 2 }}>
            <Badge badgeContent={totalInvites || 0} color="secondary">
              <MailIcon color="white" sx={{ '&:hover': { color: 'grey.300' } }} onClick={() => setPopup(true)} />
            </Badge>
          </Box>
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 } }}>
            {!isAuthenticated ? (
              <>
                <Button
                  color="inherit"
                  component={Link}
                  to="/register"
                  sx={{
                    borderRadius: 20,
                    px: { xs: 1, sm: 2 },
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                  }}
                  aria-label="Register"
                >
                  Register
                </Button>
                <Button
                  color="inherit"
                  component={Link}
                  to="/login"
                  sx={{
                    borderRadius: 20,
                    px: { xs: 1, sm: 2 },
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                  }}
                  aria-label="Login"
                >
                  Login
                </Button>
              </>
            ) : (
              <Button
                color="inherit"
                onClick={handleLogout}
                sx={{
                  borderRadius: 20,
                  px: { xs: 1, sm: 2 },
                  fontSize: { xs: '0.8rem', sm: '0.9rem' },
                }}
                aria-label="Logout"
              >
                Logout
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          flexGrow: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 1, sm: 2 },
          py: { xs: 2, sm: 3 },
        }}
      >
        {children}
      </Box>
      <InboxComponent
        open={popup}
        onClose={() => setPopup(false)}
        onSuccess={handleSuccess}
      />
    </Box>
  );
};

export default Layout;