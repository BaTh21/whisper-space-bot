// src/components/GroupInviteNotification.jsx
import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Button } from '@mui/material';
import { getPendingInvites, acceptGroupInvite } from '../services/api';

export default function GroupInviteNotification({ onJoin }) {
  const [invites, setInvites] = useState([]);

  const load = async () => {
    try {
      const res = await getPendingInvites();
      setInvites(res.data || []);
    } catch (_) {}
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, []);

  const accept = async (id) => {
    await acceptGroupInvite(id);
    setInvites(prev => prev.filter(x => x.id !== id));
    onJoin();                 // refresh groups for the invitee
  };

  if (!invites.length) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>Group Invites</Typography>
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