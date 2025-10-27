import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
    </Box>
  );
};

export default Layout;