// components/ChatBox.jsx
import SendIcon from '@mui/icons-material/Send';
import { Box, IconButton, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { getMessages, sendMessage } from '../services/api';
import ChatMessage from './ChatMessage';

export default function ChatBox({ friendId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // ADDED: Reply state
  const currentUserId = 1; // from auth context

  useEffect(() => {
    getMessages(friendId).then(res => setMessages(res.data));
  }, [friendId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    
    const messageData = {
      receiver_id: friendId, 
      content: newMessage,
      reply_to_id: replyingTo?.id || null // ADDED: Include reply reference
    };
    
    const sent = await sendMessage(messageData);
    setMessages(prev => [...prev, sent]);
    setNewMessage('');
    setReplyingTo(null); // ADDED: Clear reply after sending
  };

  const handleUpdate = (updatedMsg) => {
    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
  };

  const handleDelete = (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  // ADDED: Handle reply function
  const handleReply = (message) => {
    setReplyingTo(message);
  };

  // ADDED: Clear reply function
  const clearReply = () => {
    setReplyingTo(null);
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
            onReply={handleReply} // ADDED: Pass onReply function
          />
        ))}
      </Box>

      {/* ADDED: Reply preview bar */}
      {replyingTo && (
        <Box sx={{ 
          p: 1, 
          bgcolor: 'primary.light', 
          color: 'white',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: 8 }}>↳</span>
            <span>Replying to: {replyingTo.content}</span>
          </Box>
          <IconButton 
            size="small" 
            onClick={clearReply}
            sx={{ color: 'white' }}
          >
            ×
          </IconButton>
        </Box>
      )}

      <Box sx={{ display: 'flex', p: 1, borderTop: '1px solid #ddd' }}>
        <TextField
          fullWidth
          size="small"
          placeholder={
            replyingTo 
              ? `Replying to: ${replyingTo.content.substring(0, 30)}...` 
              : "Type a message..."
          }
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