// /src/components/GroupInviteNotification.jsx - Fixed version
import {
  Alert,
  Box,
  Button,
  Snackbar,
  Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import { getPendingGroupInvites, respondToGroupInvite } from '../services/api';

const GroupInviteNotification = ({ onJoin }) => {
  const [invites, setInvites] = useState([]);
  const [open, setOpen] = useState(false);
  const [currentInvite, setCurrentInvite] = useState(null);

  useEffect(() => {
    const fetchInvites = async () => {
  try {
    const pendingInvites = await getPendingGroupInvites();
    setInvites(pendingInvites);
    
    // Show notification if there are invites
    if (pendingInvites.length > 0) {
      setCurrentInvite(pendingInvites[0]);
      setOpen(true);
    }
  } catch (error) {
    console.error('Failed to fetch group invites:', error);
    // Optional: Set empty array as fallback
    setInvites([]);
  }
};

    fetchInvites();
    
    // Poll for new invites every 30 seconds
    const interval = setInterval(fetchInvites, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async () => {
    if (!currentInvite) return;
    
    try {
      await respondToGroupInvite(currentInvite.id, 'accept');
      setInvites(prev => prev.filter(inv => inv.id !== currentInvite.id));
      setOpen(false);
      onJoin?.();
    } catch (error) {
      console.error('Failed to accept invite:', error);
    }
  };

  const handleDecline = async () => {
    if (!currentInvite) return;
    
    try {
      await respondToGroupInvite(currentInvite.id, 'decline');
      setInvites(prev => prev.filter(inv => inv.id !== currentInvite.id));
      setOpen(false);
    } catch (error) {
      console.error('Failed to decline invite:', error);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  // Don't show anything if no invites
  if (!currentInvite) return null;

  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        onClose={handleClose}
        sx={{ width: '100%' }}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button color="success" size="small" onClick={handleAccept}>
              Join
            </Button>
            <Button color="inherit" size="small" onClick={handleDecline}>
              Decline
            </Button>
          </Box>
        }
      >
        <Typography variant="body2">
          You've been invited to join <strong>{currentInvite.group_name}</strong>
        </Typography>
      </Alert>
    </Snackbar>
  );
};

export default GroupInviteNotification;