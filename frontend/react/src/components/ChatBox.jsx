// components/ChatBox.jsx
import SendIcon from '@mui/icons-material/Send';
import { Box, IconButton, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { getMessages, sendMessage } from '../services/api';
import ChatMessage from './ChatMessage';

export default function ChatBox({ friendId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const currentUserId = 1; // from auth context

  useEffect(() => {
    getMessages(friendId).then(res => setMessages(res.data));
  }, [friendId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const sent = await sendMessage({ receiver_id: friendId, content: newMessage });
    setMessages(prev => [...prev, sent]);
    setNewMessage('');
  };

  const handleUpdate = (updatedMsg) => {
    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
  };

  const handleDelete = (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  return (
    <Box sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {messages.map(msg => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isMine={msg.sender_id === currentUserId}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', p: 1, borderTop: '1px solid #ddd' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <IconButton color="primary" onClick={handleSend}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}