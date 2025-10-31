import {
  Article as ArticleIcon,
  Chat as ChatIcon,
  Comment as CommentIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Favorite as FavoriteIcon,
  Forward as ForwardIcon,
  Group as GroupIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Reply as ReplyIcon,
  Send as SendIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Avatar,
  Backdrop,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useFormik } from 'formik';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import CreateGroupDialog from '../components/CreateGroupDialog';
import GroupInviteNotification from '../components/GroupInviteNotification';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  acceptFriendRequest,
  commentOnDiary,
  createDiary,
  createGroup,
  deleteMessage,
  editMessage,
  getDiaryComments,
  getDiaryLikes,
  getFeed,
  getFriends,
  getGroupDiaries,
  getGroupMembers,
  getGroupMessage,
  getMe,
  getPendingRequests,
  getPrivateChat,
  getUserGroups,
  joinGroup,
  likeDiary,
  searchUsers,
  sendFriendRequest,
  sendPrivateMessage,
  updateMe,
} from '../services/api';

// Tab panel component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Time formatting helper functions
const formatCambodiaTime = (dateString) => {
  if (!dateString) return 'Just now';

  try {
    let date = new Date(dateString);
    if (isNaN(date.getTime())) {
      date = new Date(dateString + 'Z');
    }

    const options = {
      timeZone: 'Asia/Bangkok',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    };

    const now = new Date();
    const messageTime = date.toLocaleString('en-US', options);
    const today = now.toLocaleDateString('en-US', { timeZone: 'Asia/Phnom_Penh' });
    const messageDate = date.toLocaleDateString('en-US', { timeZone: 'Asia/Phnom_Penh' });

    if (today === messageDate) {
      return messageTime;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-US', { timeZone: 'Asia/Phnom_Penh' });

    if (yesterdayStr === messageDate) {
      return `Yesterday ${messageTime}`;
    }

    const dateStr = date.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Phnom_Penh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    return `${dateStr} ${messageTime}`;

  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
};

const formatCambodiaDate = (dateString) => {
  if (!dateString) return 'Unknown date';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Phnom_Penh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date(dateString).toLocaleDateString('en-GB');
  }
};

// ChatMessage Component
const ChatMessage = ({ message, isMine, onUpdate, onDelete, onReply, onForward, profile, currentFriend }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const handleMenu = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };
  
  const handleClose = () => setAnchorEl(null);

  const handleEdit = async () => {
    if (editText.trim() && editText !== message.content) {
      try {
        if (onUpdate) {
          await onUpdate(message.id, editText);
        }
      } catch (err) {
        console.error('Failed to edit message:', err);
      }
    }
    setEditing(false);
    handleClose();
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this message permanently?')) {
      try {
        if (onDelete) {
          await onDelete(message.id);
        }
      } catch (err) {
        console.error('Failed to delete message:', err);
      }
    }
    handleClose();
  };

  const handleReplyClick = () => {
    if (onReply) {
      onReply(message);
    }
    handleClose();
  };

  const handleForwardClick = () => {
    if (onForward) {
      onForward(message);
    }
    handleClose();
  };

  const showMenu = !message.is_temp;

  const getSenderInfo = () => {
    if (message.sender && message.sender.username) {
      return {
        username: message.sender.username,
        avatar_url: message.sender.avatar_url,
        initial: message.sender.username.charAt(0).toUpperCase()
      };
    }
    
    if (isMine) {
      return {
        username: profile?.username || 'Me',
        avatar_url: profile?.avatar_url,
        initial: (profile?.username?.charAt(0) || 'M').toUpperCase()
      };
    }
    
    if (currentFriend) {
      return {
        username: currentFriend.username || 'Friend',
        avatar_url: currentFriend.avatar_url,
        initial: (currentFriend.username?.charAt(0) || 'F').toUpperCase()
      };
    }
    
    return {
      username: 'Unknown User',
      avatar_url: null,
      initial: 'U'
    };
  };

  const senderInfo = getSenderInfo();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        mb: 2,
        px: 1,
      }}
    >
      {!isMine && (
        <Avatar 
          src={senderInfo.avatar_url} 
          sx={{ 
            width: 32, 
            height: 32, 
            mr: 1,
            mt: 'auto',
            fontSize: '0.8rem',
            bgcolor: 'primary.main'
          }}
          imgProps={{ 
            onError: (e) => { 
              e.target.style.display = 'none';
            } 
          }}
        >
          {senderInfo.initial}
        </Avatar>
      )}
      
      <Box sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
        {!isMine && (
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              mb: 0.5,
              ml: 1,
              fontWeight: 500
            }}
          >
            {senderInfo.username}
          </Typography>
        )}
        
        {editing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 300 }}>
            <TextField
              size="small"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              multiline
              maxRows={4}
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                }
              }}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={handleEdit}>
                Save
              </Button>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              position: 'relative',
              '&:hover .message-actions': {
                opacity: 1,
              }
            }}
          >
            {message.reply_to && (
              <Box 
                sx={{ 
                  mb: 1, 
                  p: 1.5, 
                  bgcolor: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 
                  borderRadius: '8px',
                  borderLeft: '3px solid',
                  borderColor: isMine ? 'rgba(255,255,255,0.5)' : 'primary.main',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: isMine ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                  }
                }}
                onClick={handleReplyClick}
              >
                <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', fontWeight: 500 }}>
                  Replying to {message.reply_to.sender_id === profile?.id ? 'yourself' : senderInfo.username}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8, fontStyle: 'italic' }}>
                  {message.reply_to.content}
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                bgcolor: isMine ? '#0088cc' : '#f0f0f0',
                color: isMine ? 'white' : 'text.primary',
                p: 2,
                borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                position: 'relative',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                },
              }}
            >
              {message.is_forwarded && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, opacity: 0.8 }}>
                  <ForwardIcon fontSize="small" sx={{ mr: 0.5, fontSize: '1rem' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                    Forwarded {message.original_sender && `from ${message.original_sender}`}
                  </Typography>
                </Box>
              )}

              <Typography 
                variant="body2" 
                sx={{ 
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                  fontSize: '0.9rem'
                }}
              >
                {message.content}
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 1, gap: 0.5 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    opacity: 0.7,
                    fontSize: '0.7rem',
                    lineHeight: 1
                  }}
                >
                  {formatCambodiaTime(message.created_at)}
                  {message.updated_at && message.updated_at !== message.created_at && ' (edited)'}
                </Typography>
                
                {isMine && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {message.is_read ? (
                      <Box sx={{ 
                        color: isMine ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)', 
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        ✓✓
                      </Box>
                    ) : (
                      <Box sx={{ 
                        color: isMine ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', 
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        ✓
                      </Box>
                    )}
                  </Box>
                )}
              </Box>

              {showMenu && (
                <IconButton
                  size="small"
                  onClick={handleMenu}
                  className="message-actions"
                  sx={{ 
                    position: 'absolute', 
                    top: -8, 
                    right: isMine ? -8 : 'auto',
                    left: isMine ? 'auto' : -8,
                    bgcolor: isMine ? '#0088cc' : '#f0f0f0',
                    color: isMine ? 'white' : 'text.primary',
                    opacity: 0,
                    transition: 'opacity 0.2s, transform 0.2s',
                    width: 24,
                    height: 24,
                    '&:hover': {
                      bgcolor: isMine ? '#0077b3' : '#e0e0e0',
                      transform: 'scale(1.1)',
                    }
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>
        )}

        {showMenu && (
          <Menu 
            anchorEl={anchorEl} 
            open={Boolean(anchorEl)} 
            onClose={handleClose}
            anchorOrigin={{
              vertical: 'top',
              horizontal: isMine ? 'left' : 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: isMine ? 'right' : 'left',
            }}
            PaperProps={{
              sx: {
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }
            }}
          >
            {isMine && (
              <MenuItem 
                onClick={() => { 
                  setEditing(true); 
                  handleClose(); 
                }}
                sx={{ borderRadius: '8px', my: 0.5, mx: 1 }}
              >
                <EditIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
                Edit
              </MenuItem>
            )}
            
            <MenuItem 
              onClick={handleReplyClick}
              sx={{ borderRadius: '8px', my: 0.5, mx: 1 }}
            >
              <ReplyIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
              Reply
            </MenuItem>

            <MenuItem 
              onClick={handleForwardClick}
              sx={{ borderRadius: '8px', my: 0.5, mx: 1 }}
            >
              <ForwardIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
              Forward
            </MenuItem>

            {isMine && (
              <MenuItem 
                onClick={handleDelete} 
                sx={{ 
                  borderRadius: '8px', 
                  my: 0.5, 
                  mx: 1,
                  color: 'error.main',
                  '&:hover': {
                    bgcolor: 'error.light',
                    color: 'error.dark'
                  }
                }}
              >
                <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
                Delete
              </MenuItem>
            )}
          </Menu>
        )}

        {message.is_temp && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
            <Typography variant="caption" sx={{ opacity: 0.7, mr: 1, fontSize: '0.7rem' }}>
              Sending...
            </Typography>
            <CircularProgress size={10} />
          </Box>
        )}
      </Box>

      {isMine && (
        <Avatar 
          src={profile?.avatar_url} 
          sx={{ 
            width: 32, 
            height: 32, 
            ml: 1,
            mt: 'auto',
            fontSize: '0.8rem',
            bgcolor: 'secondary.main'
          }}
          imgProps={{ 
            onError: (e) => { 
              e.target.style.display = 'none';
            } 
          }}
        >
          {(profile?.username?.charAt(0) || 'M').toUpperCase()}
        </Avatar>
      )}
    </Box>
  );
};

// Forward Message Dialog Component
const ForwardMessageDialog = ({ open, onClose, message, friends, onForward }) => {
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleFriend = (friendId) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleForward = () => {
    if (selectedFriends.length > 0 && message) {
      onForward(message, selectedFriends);
      setSelectedFriends([]);
      setSearchTerm('');
      onClose();
    }
  };

  const handleCloseDialog = () => {
    setSelectedFriends([]);
    setSearchTerm('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleCloseDialog} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ForwardIcon color="primary" />
          <Typography variant="h6" fontWeight="600">Forward Message</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Card 
          sx={{ 
            p: 2, 
            mb: 2, 
            bgcolor: 'grey.50',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1, opacity: 0.8 }}>
            Forwarding:
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            {message?.content}
          </Typography>
          {message?.reply_to && (
            <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
              <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 500 }}>
                Replying to: {message.reply_to.content}
              </Typography>
            </Box>
          )}
        </Card>

        <TextField
          fullWidth
          size="small"
          placeholder="Search friends..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            sx: {
              borderRadius: '12px',
            }
          }}
        />

        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Select friends to forward to:
        </Typography>
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {filteredFriends.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
              No friends found
            </Typography>
          ) : (
            filteredFriends.map((friend) => (
              <ListItem
                key={friend.id}
                sx={{
                  border: '1px solid',
                  borderColor: selectedFriends.includes(friend.id) ? 'primary.main' : 'divider',
                  borderRadius: '12px',
                  mb: 1,
                  bgcolor: selectedFriends.includes(friend.id) ? 'primary.light' : 'background.paper',
                  color: selectedFriends.includes(friend.id) ? 'primary.contrastText' : 'text.primary',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }
                }}
                onClick={() => handleToggleFriend(friend.id)}
                button
              >
                <ListItemAvatar>
                  <Avatar 
                    src={friend.avatar_url}
                    sx={{
                      width: 40,
                      height: 40,
                    }}
                    imgProps={{ 
                      onError: (e) => { 
                        e.target.style.display = 'none';
                      } 
                    }}
                  >
                    {friend.username?.charAt(0)?.toUpperCase() || 'F'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body1" fontWeight="500">
                      {friend.username}
                    </Typography>
                  }
                  secondary={friend.email}
                />
                <Checkbox
                  checked={selectedFriends.includes(friend.id)}
                  onChange={() => handleToggleFriend(friend.id)}
                  color="primary"
                />
              </ListItem>
            ))
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button 
          onClick={handleCloseDialog}
          sx={{ borderRadius: '8px' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleForward}
          disabled={selectedFriends.length === 0}
          startIcon={<ForwardIcon />}
          sx={{ borderRadius: '8px' }}
        >
          Forward to {selectedFriends.length} {selectedFriends.length === 1 ? 'friend' : 'friends'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// View Group Content Component - FIXED VERSION
const ViewGroupContent = ({ group, profile, onJoinSuccess, setSuccess, setError }) => {
  const [members, setMembers] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [tab, setTab] = useState(0);
  const [messages, setMessages] = useState([]);
  const [newGroupMessage, setNewGroupMessage] = useState("");
  const wsRef = useRef(null);
  const BASE_URI = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem("accessToken");
  const messagesEndRef = useRef(null);
  const [expendedGroupDiary, setExpendGroupDiary] = useState(null);
  const [diaryGroupComments, setDiaryGroupComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [postingComment, setPostingComment] = useState({});

  const isMember = members.some(member => member.id === profile?.id);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await joinGroup(group.id);
      setSuccess('Successfully joined the group!');
      if (onJoinSuccess) onJoinSuccess();
    } catch (err) {
      setError(err.message || 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [membersData, diariesData] = await Promise.all([
          getGroupMembers(group.id).catch(() => []),
          getGroupDiaries(group.id).catch(() => []),
        ]);
        setMembers(membersData);
        setDiaries(diariesData);
      } catch (err) {
        setError(err.message || 'Failed to load group details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [group.id, setError]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await getGroupMessage(group.id);
        setMessages(data);
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      }
    };
    
    if (isMember) {
      fetchMessages();
    }
  }, [group.id, isMember]);

  useEffect(() => {
    if (!isMember) return;

    let ws;
    let reconnectTimeout;

    const connect = () => {
      const wsUrl = `${BASE_URI.replace(/^http/, 'ws')}/ws/group/${group.id}?token=${token}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to group chat");
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        setMessages(prev => [...prev, msg]);
      };

      ws.onclose = (event) => {
        console.log("Disconnected from chat", event.reason);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [group.id, token, isMember]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendNewMessage = () => {
    if (!newGroupMessage.trim() || !wsRef.current) return;

    const msgData = {
      type: "message",
      content: newGroupMessage,
    };

    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender: profile,
      content: newGroupMessage,
    };
    setMessages(prev => [...prev, tempMessage]);

    wsRef.current.send(JSON.stringify(msgData));
    setNewGroupMessage("");
  };

  const formatMessageDateTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleToggleComments = async (diaryId) => {
    if (expendedGroupDiary === diaryId) {
      setExpendGroupDiary(null);
    } else {
      setExpendGroupDiary(diaryId);

      if (!diaryGroupComments[diaryId]) {
        try {
          const data = await getDiaryComments(diaryId);
          setDiaryGroupComments(prev => ({ ...prev, [diaryId]: data }));
        } catch (error) {
          setDiaryGroupComments(prev => ({ ...prev, [diaryId]: [] }));
        }
      }
    }
  };

  const handleAddComment = async (diaryId) => {
    const content = newComment[diaryId]?.trim();
    if (!content) return;

    setPostingComment((prev) => ({ ...prev, [diaryId]: true }));

    try {
      const newCmt = await commentOnDiary(diaryId, content);
      setDiaryGroupComments((prev) => ({
        ...prev,
        [diaryId]: [...(prev[diaryId] || []), newCmt],
      }));
      setNewComment((prev) => ({ ...prev, [diaryId]: "" }));
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setPostingComment((prev) => ({ ...prev, [diaryId]: false }));
    }
  };

  const handleLikeGroupDiary = async (diaryId) => {
    setDiaries((prevDiaries) =>
      prevDiaries.map((d) => {
        if (d.id !== diaryId) return d;

        const isLiked = d.likes?.some((like) => like.user.id === profile.id);
        let updatedLikes;

        if (isLiked) {
          updatedLikes = d.likes.filter((like) => like.user.id !== profile.id);
        } else {
          updatedLikes = [
            ...d.likes,
            { id: Date.now(), user: { id: profile.id, username: profile.username } },
          ];
        }

        return { ...d, likes: updatedLikes };
      })
    );

    try {
      await likeDiary(diaryId);
    } catch (error) {
      console.error("Failed to like diary:", error.message);
      setDiaries((prevDiaries) =>
        prevDiaries.map((d) => {
          if (d.id !== diaryId) return d;
          const isLiked = d.likes?.some((like) => like.user.id === profile.id);
          let updatedLikes;

          if (isLiked) {
            updatedLikes = d.likes.filter((like) => like.user.id !== profile.id);
          } else {
            updatedLikes = [
              ...d.likes,
              { id: Date.now(), user: { id: profile.id, username: profile.username } },
            ];
          }
          return { ...d, likes: updatedLikes };
        })
      );
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Description */}
      {group.description && (
        <Typography paragraph sx={{ fontStyle: 'italic', color: 'text.secondary', lineHeight: 1.6 }}>
          "{group.description}"
        </Typography>
      )}

      {/* Join Button */}
      {!isMember && (
        <Box sx={{ mb: 3, textAlign: 'right' }}>
          <Button 
            variant="contained" 
            onClick={handleJoin}
            disabled={joining}
            startIcon={joining ? <CircularProgress size={16} /> : null}
            sx={{ borderRadius: '8px' }}
          >
            {joining ? 'Joining...' : 'Join Group'}
          </Button>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Tabs for Members and Group Feed */}
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Members (${members.length})`} />
        <Tab label={`Group Feed (${diaries.length})`} />
        {isMember && <Tab label="Group Chat" />}
      </Tabs>

      {/* Members Tab */}
      {tab === 0 && (
        <List sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50', borderRadius: '12px', p: 1 }}>
          {members.map((member) => (
            <ListItem key={member.id} sx={{ borderRadius: '8px', mb: 0.5 }}>
              <ListItemAvatar>
                <Avatar 
                  src={member.avatar_url} 
                  sx={{ width: 32, height: 32 }}
                  imgProps={{ 
                    onError: (e) => { 
                      e.target.style.display = 'none';
                    } 
                  }}
                >
                  {member.username?.[0]?.toUpperCase() || 'U'}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight="500">
                    {member.username}
                  </Typography>
                }
                secondary={member.id === profile?.id ? 'You' : member.email}
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* Group Feed Tab */}
      {tab === 1 && (
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {diaries.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
              No diaries posted in this group yet.
            </Typography>
          ) : (
            diaries.map((d) => {
              const isExpanded = expendedGroupDiary === d.id;
              const diaryComments = diaryGroupComments[d.id] || [];
              const isLiked = d.likes?.some((like) => like.user.id === profile.id);
              const totalLikes = d?.likes?.length;

              return (
                <Card key={d.id} sx={{ p: 2, mb: 2, borderRadius: '12px' }}>
                  <Typography sx={{ fontSize: 20, fontWeight: "bold" }} variant="subtitle2">
                    {d.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {d.author?.username || "Unknown"} • {formatCambodiaDate(d.created_at)}
                  </Typography>
                  <Typography sx={{ mb: 1 }}>{d.content}</Typography>

                  <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <Box sx={{ display: 'flex', alignItems: "center" }}>
                      <Typography
                        sx={{
                          transition: "all 0.2s ease-in-out",
                          transform: isLiked ? "scale(1.2)" : "scale(1)",
                        }}
                      >
                        {totalLikes}
                      </Typography>

                      <Button
                        startIcon={
                          <FavoriteIcon sx={{ color: isLiked ? "red" : "grey" }} />
                        }
                        size="small"
                        sx={{
                          minWidth: "auto",
                          color: isLiked ? "red" : "grey",
                        }}
                        onClick={() => handleLikeGroupDiary(d.id)}
                      >
                        {isLiked ? "Liked" : "Like"}
                      </Button>
                    </Box>

                    <Button
                      startIcon={<CommentIcon />}
                      size="small"
                      sx={{ minWidth: "auto", color: "grey" }}
                      onClick={() => handleToggleComments(d.id)}
                    >
                      Comment
                    </Button>
                  </Box>

                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Write a comment..."
                          value={newComment[d.id] || ""}
                          onChange={(e) =>
                            setNewComment((prev) => ({ ...prev, [d.id]: e.target.value }))
                          }
                        />
                        <Button
                          variant="contained"
                          onClick={() => handleAddComment(d.id)}
                          disabled={postingComment[d.id]}
                          sx={{ minWidth: "80px" }}
                        >
                          {postingComment[d.id] ? 'Posting...' : 'Post'}
                        </Button>
                      </Box>
                      {diaryComments.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          No comments yet.
                        </Typography>
                      ) : (
                        diaryComments.map((c) => (
                          <Box key={c.id} sx={{ mb: 1 }}>
                            <Typography variant="subtitle2">{c.author?.username || "Anonymous"}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              {formatCambodiaDate(c.created_at)}
                            </Typography>
                            <Typography variant="body2" sx={{ ml: 1, backgroundColor: 'grey.200', padding: 1.5, my: 1, borderRadius: 2 }}>
                              {c.content}
                            </Typography>
                          </Box>
                        ))
                      )}
                    </Box>
                  </Collapse>
                </Card>
              );
            })
          )}
        </Box>
      )}

      {/* Group Chat Tab */}
      {tab === 2 && isMember && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 400 }}>
          <Box sx={{ flex: 1, overflowY: "auto", mb: 1, p: 1 }}>
            {messages.map((msg) => {
              const isOwn = msg.sender?.id === profile?.id;

              return (
                <Box
                  key={msg.id}
                  sx={{
                    display: "flex",
                    justifyContent: isOwn ? "flex-end" : "flex-start",
                    mb: 1,
                  }}
                >
                  <Box sx={{ maxWidth: "70%" }}>
                    {!isOwn && (
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {msg.sender?.username || "Unknown"}
                      </Typography>
                    )}
                    <Box
                      sx={{
                        bgcolor: isOwn ? "primary.main" : "white",
                        color: isOwn ? "white" : "black",
                        borderRadius: 2,
                        p: 1.5,
                        my: 1,
                        wordBreak: "break-word",
                      }}
                    >
                      <Typography variant="body2">{msg.content}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatMessageDateTime(msg.created_at)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            <div ref={messagesEndRef} />
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Type a message..."
              value={newGroupMessage}
              onChange={e => setNewGroupMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendNewMessage();
                }
              }}
              multiline
              maxRows={3}
            />
            <Button 
              variant="contained" 
              onClick={handleSendNewMessage} 
              disabled={!newGroupMessage.trim()}
              sx={{ minWidth: '60px', height: '40px' }}
            >
              <SendIcon />
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// Main Dashboard Component
const DashboardPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // States for different features
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // Diary interaction states
  const [expandedDiary, setExpandedDiary] = useState(null);
  const [diaryComments, setDiaryComments] = useState({});
  const [diaryLikes, setDiaryLikes] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
  const [likedDiaries, setLikedDiaries] = useState(new Set());
  const [commentLoading, setCommentLoading] = useState({});

  // Message states
  const [messageLoading, setMessageLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Dialog states
  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [viewGroupDialogOpen, setViewGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Clear chat state helper
  const clearChatState = () => {
    setMessages([]);
    setReplyingTo(null);
    setNewMessage('');
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchDashboardData();
  }, [isAuthenticated, navigate]);

  // Enhanced polling for real-time updates
  useEffect(() => {
    if (!selectedFriend) {
      setMessages([]);
      return;
    }

    let isSubscribed = true;

    const pollMessages = async () => {
      try {
        const chatMessages = await getPrivateChat(selectedFriend.id);
        
        if (isSubscribed) {
          const enhancedMessages = chatMessages.map(message => {
            const isMyMessage = message.sender_id === profile?.id;
            
            return {
              ...message,
              sender: {
                username: isMyMessage 
                  ? profile?.username 
                  : selectedFriend?.username || 'Unknown User',
                avatar_url: isMyMessage 
                  ? profile?.avatar_url 
                  : selectedFriend?.avatar_url,
                id: isMyMessage ? profile?.id : selectedFriend?.id
              },
              is_read: message.is_read || false
            };
          });
          
          const sortedMessages = enhancedMessages.sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
          );

          setMessages(prev => {
            if (JSON.stringify(prev) === JSON.stringify(sortedMessages)) {
              return prev;
            }
            return sortedMessages;
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    pollMessages();
    const pollInterval = setInterval(pollMessages, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [selectedFriend?.id, profile]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle tab changes - clear chat when leaving messages tab
  const handleTabChange = (e, newValue) => {
    if (activeTab === 1 && newValue !== 1) {
      clearChatState();
      setSelectedFriend(null);
    }
    setActiveTab(newValue);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const profileData = await getMe();
      setProfile(profileData);

      const [friendsData, pendingData, feedData, groupsData] = await Promise.all([
        getFriends().catch(err => { console.error('Friends error:', err); return []; }),
        getPendingRequests().catch(err => { console.error('Pending error:', err); return []; }),
        getFeed().catch(err => { console.error('Feed error:', err); return []; }),
        getUserGroups().catch(err => { console.error('Groups error:', err); return []; }),
      ]);

      setFriends(friendsData || []);
      setPendingRequests(pendingData || []);
      setDiaries(feedData || []);
      setGroups(groupsData || []);

      const initialLikes = {};
      const initialComments = {};
      feedData?.forEach(diary => {
        initialLikes[diary.id] = 0;
        initialComments[diary.id] = diaryComments[diary.id] || [];
      });
      setDiaryLikes(initialLikes);
      setDiaryComments(initialComments);

    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Message operation handlers
  const handleEditMessage = async (messageId, newContent) => {
    try {
      const updatedMessage = await editMessage(messageId, newContent);
      
      const isMyMessage = updatedMessage.sender_id === profile?.id;
      const enhancedMessage = {
        ...updatedMessage,
        sender: {
          username: isMyMessage 
            ? profile?.username 
            : selectedFriend?.username || 'Unknown User',
          avatar_url: isMyMessage 
            ? profile?.avatar_url 
            : selectedFriend?.avatar_url,
          id: isMyMessage ? profile?.id : selectedFriend?.id
        }
      };
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...enhancedMessage, is_temp: false }
            : msg
        )
      );
      
      setSuccess('Message updated successfully');
    } catch (err) {
      console.error('Edit message error:', err);
      setError(err.message || 'Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    console.log('Deleting message:', messageId);
    
    setMessages(prev => prev.filter(msg => String(msg.id) !== String(messageId)));
    
    setSuccess('Message deleted successfully');
    
    try {
      await deleteMessage(messageId);
      console.log('Backend delete successful');
    } catch (err) {
      console.error('Backend delete failed:', err);
      setError('Failed to delete message on server');
    }
  };

  // Reply handler
  const handleReply = (message) => {
    setReplyingTo(message);
    setTimeout(() => {
      const input = document.querySelector('textarea');
      if (input) input.focus();
    }, 100);
  };

  // Forward handler
  const handleForward = (message) => {
    setForwardingMessage(message);
    setForwardDialogOpen(true);
  };

  // Handle actual forwarding to multiple friends
  const handleForwardMessage = async (message, friendIds) => {
    try {
      setMessageLoading(true);
      
      const forwardPromises = friendIds.map(friendId =>
        sendPrivateMessage(friendId, {
          content: message.content,
          message_type: 'text',
          is_forwarded: true,
          original_sender: message.sender?.username || profile?.username || 'Unknown',
          reply_to_id: message.reply_to_id || null,
        })
      );

      await Promise.all(forwardPromises);
      
      setSuccess(`Message forwarded to ${friendIds.length} ${friendIds.length === 1 ? 'friend' : 'friends'}`);
      setForwardingMessage(null);
      setForwardDialogOpen(false);
      
    } catch (err) {
      setError(err.message || 'Failed to forward message');
    } finally {
      setMessageLoading(false);
    }
  };

  // Clear reply
  const clearReply = () => {
    setReplyingTo(null);
    setTimeout(() => {
      const input = document.querySelector('textarea');
      if (input) input.focus();
    }, 100);
  };

  // Optimized friend selection
  const handleSelectFriend = async (friend) => {
    clearChatState();
    setSelectedFriend(friend);
    setIsLoadingMessages(true);
    
    try {
      const chatMessages = await getPrivateChat(friend.id);
      
      const enhancedMessages = chatMessages.map(message => {
        const isMyMessage = message.sender_id === profile?.id;
        
        return {
          ...message,
          sender: {
            username: isMyMessage 
              ? profile?.username 
              : friend?.username || 'Unknown User',
            avatar_url: isMyMessage 
              ? profile?.avatar_url 
              : friend?.avatar_url,
            id: isMyMessage ? profile?.id : friend?.id
          },
          is_read: message.is_read || false
        };
      });
      
      const sortedMessages = enhancedMessages.sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      );
      setMessages(sortedMessages);
    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message || 'Failed to load messages');
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Send message with reply
  const handleSendMessage = async () => {
    const messageContent = newMessage.trim();
    if (!messageContent || !selectedFriend) return;

    setMessageLoading(true);

    try {
      const tempMessage = {
        id: Date.now(),
        sender_id: profile.id,
        receiver_id: selectedFriend.id,
        content: messageContent,
        message_type: 'text',
        is_read: false,
        created_at: new Date().toISOString(),
        is_temp: true,
        reply_to_id: replyingTo?.id || null,
        reply_to: replyingTo || null,
        sender: {
          username: profile.username,
          avatar_url: profile.avatar_url,
          id: profile.id
        }
      };

      setMessages(prev => {
        const newMessages = [...prev, tempMessage];
        return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

      setNewMessage('');
      setReplyingTo(null);

      const sentMessage = await sendPrivateMessage(selectedFriend.id, { 
        content: messageContent, 
        message_type: 'text',
        reply_to_id: replyingTo?.id || null,
      });

      const enhancedSentMessage = {
        ...sentMessage,
        sender: {
          username: profile.username,
          avatar_url: profile.avatar_url,
          id: profile.id
        },
        is_temp: false,
        is_read: sentMessage.is_read || false
      };

      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.is_temp);
        const newMessages = [...filtered, enhancedSentMessage];
        return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

    } catch (err) {
      setError(err.message || 'Failed to send message');
      setMessages(prev => prev.filter(msg => !msg.is_temp));
      setNewMessage(messageContent);
    } finally {
      setMessageLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Profile form
  const profileFormik = useFormik({
    initialValues: {
      username: '',
      bio: '',
      avatar_url: '',
    },
    validationSchema: Yup.object({
      username: Yup.string().min(3, 'Username must be at least 3 characters').required('Required'),
      bio: Yup.string().max(500, 'Bio must be less than 500 characters'),
      avatar_url: Yup.string().url('Must be a valid URL'),
    }),
    enableReinitialize: true,
    onSubmit: async (values) => {
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        const updateData = Object.fromEntries(
          Object.entries(values).filter(([, value]) => value !== '')
        );

        const response = await updateMe(updateData);
        setProfile(response);
        setEditing(false);
        setSuccess('Profile updated successfully');
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(err.message || 'Failed to update profile');
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    if (profile) {
      profileFormik.setValues({
        username: profile.username || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile]);

  // Diary form
  const diaryFormik = useFormik({
    initialValues: {
      title: '',
      content: '',
      share_type: 'public',
      group_ids: [],
    },
    validationSchema: Yup.object({
      title: Yup.string().required('Title is required'),
      content: Yup.string().required('Content is required'),
      share_type: Yup.string().oneOf(['public', 'friends', 'group', 'personal']),
      group_ids: Yup.array().when('share_type', {
        is: 'group',
        then: (schema) => schema.min(1, 'Please select at least one group'),
        otherwise: (schema) => schema.notRequired(),
      }),
    }),
    onSubmit: async (values, { resetForm }) => {
      try {
        const payload = {
          title: values.title,
          content: values.content,
          share_type: values.share_type,
          group_ids: values.share_type === 'group' ? values.group_ids : [],
        };

        if (values.share_type !== 'group') delete payload.group_ids;

        await createDiary(payload);

        setSuccess('Diary created successfully');
        setDiaryDialogOpen(false);
        resetForm();
        fetchDashboardData();
      } catch (err) {
        setError(err.message || 'Failed to create diary');
      }
    },
  });

  // Group form
  const groupFormik = useFormik({
    initialValues: {
      name: '',
      description: '',
    },
    validationSchema: Yup.object({
      name: Yup.string().required('Group name is required'),
    }),
    onSubmit: async (values, { resetForm }) => {
      try {
        const newGroup = await createGroup(values);
        setGroups(prev => [...prev, newGroup]);
        setSuccess('Group created successfully');
        setGroupDialogOpen(false);
        resetForm();
      } catch (err) {
        setError(err.message || 'Failed to create group');
      }
    },
  });

  // Diary interaction functions
  const handleLikeDiary = async (diaryId) => {
    try {
      await likeDiary(diaryId);

      const newLikedDiaries = new Set(likedDiaries);
      if (newLikedDiaries.has(diaryId)) {
        newLikedDiaries.delete(diaryId);
        setDiaryLikes(prev => ({
          ...prev,
          [diaryId]: Math.max(0, (prev[diaryId] || 0) - 1)
        }));
      } else {
        newLikedDiaries.add(diaryId);
        setDiaryLikes(prev => ({
          ...prev,
          [diaryId]: (prev[diaryId] || 0) + 1
        }));
      }
      setLikedDiaries(newLikedDiaries);

    } catch (err) {
      setError(err.message || 'Failed to like diary');
    }
  };

  const handleAddComment = async (diaryId) => {
    const commentText = commentTexts[diaryId] || '';
    if (!commentText.trim()) return;

    setCommentLoading(prev => ({ ...prev, [diaryId]: true }));

    try {
      const newComment = await commentOnDiary(diaryId, commentText);

      setDiaryComments(prev => ({
        ...prev,
        [diaryId]: [...(prev[diaryId] || []), {
          id: Date.now(),
          content: commentText,
          user_id: profile?.id,
          user: { username: profile?.username },
          created_at: new Date().toISOString()
        }]
      }));

      setCommentTexts(prev => ({
        ...prev,
        [diaryId]: ''
      }));

    } catch (err) {
      setError(err.message || 'Failed to add comment');
    } finally {
      setCommentLoading(prev => ({ ...prev, [diaryId]: false }));
    }
  };

  const handleExpandDiary = async (diaryId) => {
    if (!diaryId) return;

    setExpandedDiary(diaryId);

    try {
      const [comments, likes] = await Promise.all([
        getDiaryComments(diaryId).catch(err => {
          console.error('Comments error:', err);
          return [];
        }),
        getDiaryLikes(diaryId).catch(err => {
          console.error('Likes error:', err);
          return [];
        }),
      ]);

      setDiaryComments(prev => ({
        ...prev,
        [diaryId]: comments
      }));

      setDiaryLikes(prev => ({
        ...prev,
        [diaryId]: Array.isArray(likes) ? likes.length : (likes || 0)
      }));

    } catch (err) {
      console.error('Failed to fetch diary details:', err);
    }
  };

  const handleCommentTextChange = (diaryId, text) => {
    setCommentTexts(prev => ({
      ...prev,
      [diaryId]: text
    }));
  };

  // Other handlers
  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      setError('Search query must be at least 2 characters');
      return;
    }
    setLoading(true);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
      setError(null);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (userId) => {
    try {
      await sendFriendRequest(userId);
      setSuccess('Friend request sent');
      setSearchResults(searchResults.filter(user => user.id !== userId));
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (requesterId) => {
    try {
      await acceptFriendRequest(requesterId);
      setSuccess('Friend request accepted');
      setPendingRequests(pendingRequests.filter(req => req.id !== requesterId));
      fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to accept friend request');
    }
  };

  const handleViewGroup = (group) => {
    setSelectedGroup(group);
    setViewGroupDialogOpen(true);
  };

  if (!profile) {
    return (
      <Layout>
        <Backdrop open={loading} sx={{ zIndex: 1300, color: '#40C4FF' }}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </Layout>
    );
  }

  return (
    <Layout>
      <Backdrop open={loading} sx={{ zIndex: 1300, color: '#40C4FF' }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', p: 2 }}>
        {/* SHOW PENDING INVITES */}
        <GroupInviteNotification onJoin={fetchDashboardData} />

        {/* Header */}
        <Card sx={{ mb: 3, p: 3, borderRadius: '16px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar
              src={profile?.avatar_url}
              alt={profile?.username}
              sx={{ width: 80, height: 80, mr: 3 }}
              imgProps={{ 
                onError: (e) => { 
                  e.target.style.display = 'none';
                } 
              }}
            />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" gutterBottom fontWeight="600">
                Welcome back, {profile?.username}!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {profile?.bio || 'No bio yet.'}
              </Typography>
              <Chip
                label={profile?.is_verified ? 'Verified' : 'Not Verified'}
                color={profile?.is_verified ? 'success' : 'default'}
                size="small"
                sx={{ mt: 1, borderRadius: '8px' }}
              />
            </Box>
            <IconButton onClick={() => setEditing(!editing)}>
              <EditIcon />
            </IconButton>
          </Box>

          <Collapse in={!!error}>
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>
              {error}
            </Alert>
          </Collapse>
          <Collapse in={!!success}>
            <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          </Collapse>

          <Collapse in={editing}>
            <Card sx={{ p: 3, mt: 2, borderRadius: '12px' }}>
              <Typography variant="h6" gutterBottom fontWeight="600">
                Edit Profile
              </Typography>
              <Box component="form" onSubmit={profileFormik.handleSubmit}>
                <TextField
                  label="Username"
                  name="username"
                  value={profileFormik.values.username}
                  onChange={profileFormik.handleChange}
                  onBlur={profileFormik.handleBlur}
                  error={profileFormik.touched.username && !!profileFormik.errors.username}
                  helperText={profileFormik.touched.username && profileFormik.errors.username}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    sx: { borderRadius: '8px' }
                  }}
                />
                <TextField
                  label="Bio"
                  name="bio"
                  multiline
                  rows={3}
                  value={profileFormik.values.bio}
                  onChange={profileFormik.handleChange}
                  onBlur={profileFormik.handleBlur}
                  error={profileFormik.touched.bio && !!profileFormik.errors.bio}
                  helperText={profileFormik.touched.bio && profileFormik.errors.bio}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    sx: { borderRadius: '8px' }
                  }}
                />
                <TextField
                  label="Avatar URL"
                  name="avatar_url"
                  value={profileFormik.values.avatar_url}
                  onChange={profileFormik.handleChange}
                  onBlur={profileFormik.handleBlur}
                  error={profileFormik.touched.avatar_url && !!profileFormik.errors.avatar_url}
                  helperText={profileFormik.touched.avatar_url && profileFormik.errors.avatar_url}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    sx: { borderRadius: '8px' }
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button type="submit" variant="contained" sx={{ borderRadius: '8px' }}>
                    Save
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setEditing(false);
                      profileFormik.resetForm();
                    }}
                    sx={{ borderRadius: '8px' }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            </Card>
          </Collapse>
        </Card>

        {/* Main Content with Tabs */}
        <Card sx={{ borderRadius: '16px', overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                borderRadius: '8px 8px 0 0',
                minHeight: 60,
              }
            }}
          >
            <Tab icon={<ArticleIcon />} label="Feed" />
            <Tab icon={<ChatIcon />} label="Messages" />
            <Tab icon={<PersonAddIcon />} label="Friends" />
            <Tab icon={<GroupIcon />} label="Groups" />
            <Tab label="Search Users" />
          </Tabs>

          {/* Feed Tab */}
          <TabPanel value={activeTab} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" fontWeight="600">Your Feed</Typography>
              <Button
                variant="contained"
                onClick={() => setDiaryDialogOpen(true)}
                startIcon={<ArticleIcon />}
                sx={{ borderRadius: '8px' }}
              >
                New Diary
              </Button>
            </Box>

            {diaries.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No diaries in your feed yet. Create one or follow more friends!
              </Typography>
            ) : (
              diaries.map((diary) => (
                <Card key={diary.id} sx={{ p: 3, mb: 2, borderRadius: '12px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" gutterBottom fontWeight="600">
                        {diary.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ color: 'green', fontWeight: '600' }}>
                          By {diary.author?.username || ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          • {formatCambodiaDate(diary.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={diary.share_type}
                      size="small"
                      color={
                        diary.share_type === 'public' ? 'primary' :
                          diary.share_type === 'friends' ? 'secondary' : 'default'
                      }
                      sx={{ borderRadius: '8px' }}
                    />
                  </Box>

                  <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
                    {diary.content}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: expandedDiary === diary.id ? 0 : 2 }}>
                    <Button
                      startIcon={likedDiaries.has(diary.id) ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                      onClick={() => handleLikeDiary(diary.id)}
                      color={likedDiaries.has(diary.id) ? 'error' : 'inherit'}
                      size="small"
                      sx={{
                        minWidth: 'auto',
                        color: likedDiaries.has(diary.id) ? 'error.main' : 'text.secondary',
                        borderRadius: '8px'
                      }}
                    >
                      {likedDiaries.has(diary.id) ? 'Liked' : 'Like'}
                      {(diaryLikes[diary.id] > 0) && ` (${diaryLikes[diary.id]})`}
                    </Button>

                    <Button
                      startIcon={<CommentIcon />}
                      onClick={() => handleExpandDiary(diary.id)}
                      size="small"
                      color={expandedDiary === diary.id ? 'primary' : 'inherit'}
                      sx={{ minWidth: 'auto', borderRadius: '8px' }}
                    >
                      Comment
                      {diaryComments[diary.id]?.length > 0 && ` (${diaryComments[diary.id].length})`}
                    </Button>
                  </Box>

                  <Collapse in={expandedDiary === diary.id}>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: '12px' }}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Write a comment..."
                          value={commentTexts[diary.id] || ''}
                          onChange={(e) => handleCommentTextChange(diary.id, e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddComment(diary.id);
                            }
                          }}
                          disabled={commentLoading[diary.id]}
                          InputProps={{
                            sx: { borderRadius: '8px' }
                          }}
                        />
                        <Button
                          variant="contained"
                          onClick={() => handleAddComment(diary.id)}
                          disabled={!commentTexts[diary.id]?.trim() || commentLoading[diary.id]}
                          sx={{ minWidth: '60px', borderRadius: '8px' }}
                        >
                          {commentLoading[diary.id] ? <CircularProgress size={20} /> : <SendIcon />}
                        </Button>
                      </Box>

                      {diaryComments[diary.id]?.length > 0 ? (
                        <List sx={{ maxHeight: 200, overflow: 'auto' }}>
                          {diaryComments[diary.id].map((comment) => (
                            <ListItem key={comment.id} sx={{ px: 0, py: 1 }}>
                              <ListItemAvatar>
                                <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                                  {comment.user?.username?.charAt(0)?.toUpperCase() || 'U'}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" component="span" fontWeight="600" color='green'>
                                      {comment.user?.username || `User ${comment.user_id}`}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatCambodiaTime(comment.created_at)}
                                    </Typography>
                                  </Box>
                                }
                                secondary={
                                  <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.5 }}>
                                    {comment.content}
                                  </Typography>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                          No comments yet. Be the first to comment!
                        </Typography>
                      )}
                    </Box>
                  </Collapse>
                </Card>
              ))
            )}
          </TabPanel>

          {/* Messages Tab */}
          <TabPanel value={activeTab} index={1}>
            <Box sx={{ display: 'flex', height: 600, borderRadius: '8px', overflow: 'hidden' }}>
              {/* Friends List Sidebar */}
              <Box sx={{ 
                width: 300, 
                borderRight: 1, 
                borderColor: 'divider', 
                pr: 2,
                bgcolor: 'background.paper'
              }}>
                <Typography variant="h6" gutterBottom sx={{ p: 2, fontWeight: 600 }}>
                  Friends {isLoadingMessages && <CircularProgress size={16} sx={{ ml: 1 }} />}
                </Typography>
                <List sx={{ maxHeight: 520, overflow: 'auto' }}>
                  {friends.map((friend) => (
                    <ListItem
                      key={friend.id}
                      selected={selectedFriend?.id === friend.id}
                      onClick={() => handleSelectFriend(friend)}
                      disabled={isLoadingMessages}
                      sx={{
                        borderRadius: '12px',
                        mb: 1,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          transform: 'translateX(4px)',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'primary.light',
                          color: 'primary.contrastText',
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar 
                          src={friend.avatar_url} 
                          alt={friend.username} 
                          sx={{ width: 40, height: 40 }}
                          imgProps={{ 
                            onError: (e) => { 
                              e.target.style.display = 'none';
                            } 
                          }}
                        >
                          {friend.username?.charAt(0)?.toUpperCase() || 'F'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body1" fontWeight="500">
                            {friend.username}
                          </Typography>
                        }
                        secondary={friend.email}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>

              {/* Chat Area */}
              <Box sx={{ 
                flexGrow: 1, 
                display: 'flex', 
                flexDirection: 'column',
                bgcolor: '#f8f9fa'
              }}>
                {selectedFriend ? (
                  <>
                    {/* Chat Header */}
                    <Box sx={{ 
                      p: 2, 
                      borderBottom: 1, 
                      borderColor: 'divider', 
                      bgcolor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}>
                      <Avatar 
                        src={selectedFriend.avatar_url} 
                        sx={{ 
                          width: 44, 
                          height: 44, 
                          bgcolor: 'primary.main',
                          fontSize: '1.2rem',
                          fontWeight: 'bold'
                        }}
                        imgProps={{ 
                          onError: (e) => { 
                            e.target.style.display = 'none';
                          } 
                        }}
                      >
                        {selectedFriend.username?.charAt(0)?.toUpperCase() || 'F'}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" fontWeight="600">
                          {selectedFriend.username || 'Friend'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {isLoadingMessages ? 'Loading messages...' : 
                           messages.length > 0 ? 'Online • Last seen recently' : 'Start a conversation'}
                        </Typography>
                      </Box>
                      <Chip
                        label="Real-time"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ borderRadius: '8px' }}
                      />
                    </Box>
                    
                    {/* Reply Preview Bar */}
                    {replyingTo && (
                      <Box sx={{ 
                        p: 2, 
                        bgcolor: 'primary.light', 
                        color: 'primary.contrastText',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <ReplyIcon sx={{ mr: 1.5, fontSize: '1.2rem', flexShrink: 0 }} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', fontWeight: 500 }}>
                              Replying to {replyingTo.sender_id === profile?.id ? 'yourself' : selectedFriend.username}
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                            }}>
                              {replyingTo.content}
                            </Typography>
                          </Box>
                        </Box>
                        <IconButton 
                          size="small" 
                          onClick={clearReply}
                          sx={{ 
                            color: 'primary.contrastText',
                            flexShrink: 0,
                            ml: 1
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                    
                    {/* Messages Container */}
                    <Box sx={{ 
                      flexGrow: 1, 
                      overflow: 'auto', 
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)'
                    }}>
                      {isLoadingMessages ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                          <CircularProgress />
                        </Box>
                      ) : messages.length === 0 ? (
                        <Box sx={{ 
                          textAlign: 'center', 
                          mt: 4,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%'
                        }}>
                          <ChatIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No messages yet
                          </Typography>
                          <Typography color="text.secondary">
                            Start a conversation with {selectedFriend.username}
                          </Typography>
                        </Box>
                      ) : (
                        <>
                          {messages
                            .filter(message => !message.is_unsent && !message.is_temp)
                            .map((message) => (
                              <ChatMessage
                                key={message.id}
                                message={message}
                                isMine={message.sender_id === profile?.id}
                                onUpdate={handleEditMessage}
                                onDelete={handleDeleteMessage}
                                onReply={handleReply}
                                onForward={handleForward}
                                profile={profile}
                                currentFriend={selectedFriend}
                              />
                            ))
                          }
                          <div ref={messagesEndRef} />
                        </>
                      )}
                    </Box>
                    
                    {/* Message Input */}
                    <Box sx={{ 
                      p: 2, 
                      borderTop: 1, 
                      borderColor: 'divider', 
                      bgcolor: 'white',
                      display: 'flex', 
                      gap: 1, 
                      alignItems: 'flex-end' 
                    }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder={
                          replyingTo 
                            ? `Replying to ${replyingTo.sender_id === profile?.id ? 'yourself' : selectedFriend.username}...` 
                            : "Type a message... (Press Enter to send)"
                        }
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        multiline
                        maxRows={3}
                        disabled={messageLoading}
                        InputProps={{
                          sx: { 
                            borderRadius: '24px',
                            bgcolor: '#f8f9fa'
                          }
                        }}
                        autoFocus={!!replyingTo}
                      />
                      <Button
                        variant="contained"
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || messageLoading}
                        sx={{ 
                          minWidth: '48px', 
                          height: '48px', 
                          borderRadius: '50%',
                          bgcolor: '#0088cc',
                          '&:hover': {
                            bgcolor: '#0077b3'
                          }
                        }}
                      >
                        {messageLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <SendIcon />}
                      </Button>
                    </Box>
                  </>
                ) : (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    flexDirection: 'column',
                    bgcolor: '#f8f9fa'
                  }}>
                    <ChatIcon sx={{ fontSize: 96, color: 'grey.300', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Select a friend to start chatting
                    </Typography>
                    <Typography color="text.secondary" align="center">
                      Choose a friend from the list to begin your conversation
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Forward Message Dialog */}
            <ForwardMessageDialog
              open={forwardDialogOpen}
              onClose={() => setForwardDialogOpen(false)}
              message={forwardingMessage}
              friends={friends.filter(friend => friend.id !== selectedFriend?.id)}
              onForward={handleForwardMessage}
            />
          </TabPanel>

          {/* Friends Tab */}
          <TabPanel value={activeTab} index={2}>
            <Typography variant="h5" gutterBottom fontWeight="600">
              Friends
            </Typography>

            {pendingRequests.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom color="primary" fontWeight="600">
                  Pending Requests ({pendingRequests.length})
                </Typography>
                {pendingRequests.map((request) => (
                  <Card 
                    key={request.id} 
                    sx={{ 
                      p: 2, 
                      mb: 1, 
                      display: 'flex', 
                      alignItems: 'center',
                      borderRadius: '12px'
                    }}
                  >
                    <Avatar 
                      src={request.avatar_url} 
                      sx={{ mr: 2, width: 48, height: 48 }}
                      imgProps={{ 
                        onError: (e) => { 
                          e.target.style.display = 'none';
                        } 
                      }}
                    >
                      {request.username?.charAt(0)?.toUpperCase() || 'U'}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body1" fontWeight="500">{request.username}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {request.email}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleAcceptRequest(request.id)}
                      sx={{ borderRadius: '8px' }}
                    >
                      Accept
                    </Button>
                  </Card>
                ))}
              </Box>
            )}

            <Typography variant="h6" gutterBottom fontWeight="600">
              Your Friends ({friends.length})
            </Typography>
            {friends.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                No friends yet. Search for users to add friends!
              </Typography>
            ) : (
              friends.map((friend) => (
                <Card 
                  key={friend.id} 
                  sx={{ 
                    p: 2, 
                    mb: 1, 
                    display: 'flex', 
                    alignItems: 'center',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }
                  }}
                >
                  <Avatar 
                    src={friend.avatar_url} 
                    sx={{ mr: 2, width: 48, height: 48 }}
                    imgProps={{ 
                      onError: (e) => { 
                        e.target.style.display = 'none';
                      } 
                    }}
                  >
                    {friend.username?.charAt(0)?.toUpperCase() || 'F'}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1" fontWeight="500">{friend.username}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {friend.email}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      handleSelectFriend(friend);
                      setActiveTab(1);
                    }}
                    sx={{ borderRadius: '8px' }}
                  >
                    Message
                  </Button>
                </Card>
              ))
            )}
          </TabPanel>

          {/* Groups Tab */}
          <TabPanel value={activeTab} index={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" fontWeight="600">Groups</Typography>
              <Button 
                variant="contained" 
                onClick={() => setGroupDialogOpen(true)} 
                startIcon={<GroupIcon />}
                sx={{ borderRadius: '8px' }}
              >
                Create Group
              </Button>
            </Box>

            {groups.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No groups yet. Create one!
              </Typography>
            ) : (
              groups.map((group) => (
                <Card 
                  key={group.id} 
                  sx={{ 
                    p: 3, 
                    mb: 2, 
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="h6" fontWeight="600">{group.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Created {formatCambodiaDate(group.created_at)}
                      </Typography>
                      {group.description && (
                        <Typography sx={{ mt: 1, fontStyle: 'italic', lineHeight: 1.6 }}>{group.description}</Typography>
                      )}
                    </Box>
                    <Box>
                      <Tooltip title="View Group">
                        <IconButton 
                          onClick={() => handleViewGroup(group)}
                          sx={{ 
                            bgcolor: 'primary.light',
                            color: 'primary.contrastText',
                            '&:hover': { bgcolor: 'primary.main' },
                            borderRadius: '8px',
                            mr: 1
                          }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Open Chat">
                        <IconButton 
                          component={Link} 
                          to={`/group/${group.id}`}
                          sx={{ 
                            bgcolor: 'secondary.light',
                            color: 'secondary.contrastText',
                            '&:hover': { bgcolor: 'secondary.main' },
                            borderRadius: '8px'
                          }}
                        >
                          <ChatIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Card>
              ))
            )}
          </TabPanel>

          {/* Search Users Tab */}
          <TabPanel value={activeTab} index={4}>
            <Typography variant="h5" gutterBottom fontWeight="600">
              Search Users
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              <TextField
                fullWidth
                label="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  sx: { borderRadius: '8px' }
                }}
              />
              <Button 
                variant="contained" 
                onClick={handleSearch}
                sx={{ borderRadius: '8px' }}
              >
                Search
              </Button>
            </Box>

            {searchResults.length === 0 && searchQuery.length >= 2 && (
              <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                No users found matching "{searchQuery}"
              </Typography>
            )}

            {searchResults.map((user) => (
              <Card 
                key={user.id} 
                sx={{ 
                  p: 2, 
                  mb: 1, 
                  display: 'flex', 
                  alignItems: 'center',
                  borderRadius: '12px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }
                }}
              >
                <Avatar 
                  src={user.avatar_url} 
                  sx={{ mr: 2, width: 48, height: 48 }}
                  imgProps={{ 
                    onError: (e) => { 
                      e.target.style.display = 'none';
                    } 
                  }}
                >
                  {user.username?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body1" fontWeight="500">{user.username}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PersonAddIcon />}
                  onClick={() => handleSendFriendRequest(user.id)}
                  sx={{ borderRadius: '8px' }}
                >
                  Add Friend
                </Button>
              </Card>
            ))}
          </TabPanel>
        </Card>
      </Box>

      {/* Create Diary Dialog */}
      <Dialog 
        open={diaryDialogOpen} 
        onClose={() => setDiaryDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Diary</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              label="Title"
              name="title"
              value={diaryFormik.values.title}
              onChange={diaryFormik.handleChange}
              onBlur={diaryFormik.handleBlur}
              error={diaryFormik.touched.title && !!diaryFormik.errors.title}
              helperText={diaryFormik.touched.title && diaryFormik.errors.title}
              fullWidth
              margin="normal"
              required
              InputProps={{
                sx: { borderRadius: '8px' }
              }}
            />

            <TextField
              label="Content"
              name="content"
              multiline
              rows={4}
              value={diaryFormik.values.content}
              onChange={diaryFormik.handleChange}
              onBlur={diaryFormik.handleBlur}
              error={diaryFormik.touched.content && !!diaryFormik.errors.content}
              helperText={diaryFormik.touched.content && diaryFormik.errors.content}
              fullWidth
              margin="normal"
              required
              InputProps={{
                sx: { borderRadius: '8px' }
              }}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Share Type</InputLabel>
              <Select
                name="share_type"
                value={diaryFormik.values.share_type}
                onChange={diaryFormik.handleChange}
                onBlur={diaryFormik.handleBlur}
                label="Share Type"
                sx={{ borderRadius: '8px' }}
              >
                <MenuItem value="public">Public</MenuItem>
                <MenuItem value="friends">Friends Only</MenuItem>
                <MenuItem value="group">Group</MenuItem>
                <MenuItem value="personal">Personal</MenuItem>
              </Select>
            </FormControl>

            {diaryFormik.values.share_type === 'group' && (
              <FormControl fullWidth margin="normal">
                <InputLabel>Select Groups</InputLabel>
                <Select
                  multiple
                  name="group_ids"
                  value={diaryFormik.values.group_ids}
                  onChange={diaryFormik.handleChange}
                  renderValue={(selected) =>
                    groups
                      .filter((group) => selected.includes(group.id))
                      .map((g) => g.name)
                      .join(', ')
                  }
                  sx={{ borderRadius: '8px' }}
                >
                  {groups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      <Checkbox checked={diaryFormik.values.group_ids.includes(group.id)} />
                      <ListItemText primary={group.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setDiaryDialogOpen(false)}
            sx={{ borderRadius: '8px' }}
          >
            Cancel
          </Button>
          <Button
            onClick={diaryFormik.handleSubmit}
            variant="contained"
            sx={{ borderRadius: '8px' }}
          >
            Create Diary
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Group</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              label="Group Name"
              name="name"
              required
              fullWidth
              margin="normal"
              value={groupFormik.values.name}
              onChange={groupFormik.handleChange}
              onBlur={groupFormik.handleBlur}
              error={groupFormik.touched.name && !!groupFormik.errors.name}
              helperText={groupFormik.touched.name && groupFormik.errors.name}
              InputProps={{
                sx: { borderRadius: '8px' }
              }}
            />
            <TextField
              label="Description"
              name="description"
              multiline
              rows={3}
              fullWidth
              margin="normal"
              value={groupFormik.values.description}
              onChange={groupFormik.handleChange}
              onBlur={groupFormik.handleBlur}
              InputProps={{
                sx: { borderRadius: '8px' }
              }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setGroupDialogOpen(false)}
            sx={{ borderRadius: '8px' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={groupFormik.handleSubmit}
            disabled={!groupFormik.isValid || groupFormik.isSubmitting}
            sx={{ borderRadius: '8px' }}
          >
            Create Group
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Group Dialog */}
      <Dialog
        open={viewGroupDialogOpen}
        onClose={() => setViewGroupDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" fontWeight="600">{selectedGroup?.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Created {selectedGroup && formatCambodiaDate(selectedGroup.created_at)}
              </Typography>
            </Box>
            <IconButton 
              onClick={() => setViewGroupDialogOpen(false)}
              sx={{ borderRadius: '8px' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedGroup ? (
            <ViewGroupContent
              group={selectedGroup}
              profile={profile}
              onJoinSuccess={() => {
                setViewGroupDialogOpen(false);
                fetchDashboardData();
              }}
              setSuccess={setSuccess}
              setError={setError}
            />
          ) : (
            <Typography>Loading...</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setViewGroupDialogOpen(false)}
            sx={{ borderRadius: '8px' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Group Dialog Component */}
      <CreateGroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        onSuccess={(newGroup) => {
          setGroups(prev => [...prev, newGroup]);
          fetchDashboardData();
          setGroupDialogOpen(false);
        }}
        friends={friends}
      />
    </Layout>
  );
};

export default DashboardPage;