import { Refresh as RefreshIcon } from '@mui/icons-material';
import { Box, Button, Card, CardContent, IconButton, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { acceptGroupInvite, getPendingInvites } from '../services/api';

export default function GroupInviteNotification({ onJoin }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPendingInvites();
      setInvites(res.data || []);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const accept = async (id) => {
    await acceptGroupInvite(id);
    setInvites(prev => prev.filter(x => x.id !== id));
    onJoin();
  };

  if (!invites.length) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6">Group Invites</Typography>
        <IconButton size="small" onClick={load} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>
      {invites.map(i => (
        <Card key={i.id} sx={{ mb: 1 }}>
          <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography>
              <b>{i.inviter?.username}</b> invited you to <b>{i.group?.name}</b>
            </Typography>
            <Button size="small" variant="contained" onClick={() => accept(i.id)}>
              Accept
            </Button>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}