import {
    Backdrop,
    CircularProgress,
    Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, checkAuthStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const verifyAuthentication = async () => {
      await checkAuthStatus();
      setAuthChecked(true);
    };

    verifyAuthentication();
  }, [checkAuthStatus]);

  useEffect(() => {
    if (authChecked && !loading) {
      if (!isAuthenticated) {
        // Redirect to login if NOT authenticated
        navigate('/login', { 
          replace: true,
          state: { 
            from: location.pathname,
            message: 'Please log in to access this page'
          }
        });
      }
      // REMOVED the else clause - don't redirect authenticated users!
      // They should stay on whatever protected route they're trying to access
    }
  }, [authChecked, loading, isAuthenticated, navigate, location]);

  // Show loading spinner while checking authentication
  if (loading || !authChecked) {
    return (
      <Backdrop 
        open={true} 
        sx={{ 
          zIndex: 1300, 
          color: '#fff',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <CircularProgress color="inherit" />
        <Typography variant="h6" color="inherit">
          Verifying authentication...
        </Typography>
      </Backdrop>
    );
  }

  // If authenticated, render the children
  if (isAuthenticated) {
    return children;
  }

  // Show loading while redirecting to login
  return (
    <Backdrop 
      open={true} 
      sx={{ 
        zIndex: 1300, 
        color: '#fff',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <CircularProgress color="inherit" />
      <Typography variant="h6" color="inherit">
        Redirecting to login...
      </Typography>
    </Backdrop>
  );
};

export default ProtectedRoute;