// src/pages/GroupChatPage.jsx
import SendIcon from '@mui/icons-material/Send';
import { Box, IconButton, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ChatMessage from '../components/ChatMessage';
import { getGroupMessages, sendGroupMessage } from '../services/api';

export default function GroupChatPage() {
  const { groupId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const currentUserId = 1; // Replace with real auth

  useEffect(() => {
    getGroupMessages(groupId).then(res => setMessages(res.data));
  }, [groupId]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const sent = await sendGroupMessage(groupId, input);
    setMessages(prev => [...prev, sent]);
    setInput('');
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ height: '60vh', overflowY: 'auto', mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
        {messages.map(msg => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isMine={msg.sender_id === currentUserId}
            onUpdate={updated => setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))}
            onDelete={id => setMessages(prev => prev.filter(m => m.id !== id))}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <IconButton color="primary" onClick={handleSend}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}