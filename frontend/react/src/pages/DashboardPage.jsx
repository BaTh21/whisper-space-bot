// Pages/DashboardPage.jsx
import {
  Article as ArticleIcon,
  Chat as ChatIcon,
  Comment as CommentIcon,
  Edit as EditIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Favorite as FavoriteIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon,
  Send as SendIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Backdrop,
  Box,
  Button,
  Card,
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
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useFormik } from 'formik';
import { useEffect, useState } from 'react';
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
  getDiaryComments,
  getDiaryLikes,
  getFeed,
  getFriends,
  getGroupDiaries,
  // NEW: Group detail APIs
  getGroupMembers,
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
    // Ensure it's parsed as UTC first
    let date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // If invalid, try forcing UTC
      date = new Date(dateString + 'Z');
    }
    
    const options = {
      timeZone: 'Asia/Bangkok',  // ← Use 'Asia/Bangkok' (same as Phnom Penh)
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

// View Group Content Component
const ViewGroupContent = ({ group, profile, onJoinSuccess }) => {
  const [members, setMembers] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  const isMember = members.some(m => m.id === profile?.id);

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
  }, [group.id]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await joinGroup(group.id);
      setSuccess('Joined group successfully');
      onJoinSuccess();
    } catch (err) {
      setError(err.message || 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <>
      {/* Description */}
      {group.description && (
        <Typography paragraph sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
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
          >
            {joining ? 'Joining...' : 'Join Group'}
          </Button>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Members */}
      <Typography variant="subtitle1" gutterBottom>
        Members ({members.length})
      </Typography>
      <List sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50', borderRadius: 1, p: 1, mb: 3 }}>
        {members.map((member) => (
          <ListItem key={member.id}>
            <ListItemAvatar>
              <Avatar src={member.avatar_url} sx={{ width: 32, height: 32 }}>
                {member.username?.[0] || 'U'}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={member.username}
              secondary={member.id === profile?.id ? 'You' : member.email}
            />
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      {/* Group Feed */}
      <Typography variant="subtitle1" gutterBottom>
        Group Feed ({diaries.length})
      </Typography>
      {diaries.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
          No diaries posted in this group yet.
        </Typography>
      ) : (
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {diaries.map((diary) => (
            <Card key={diary.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2">{diary.title}</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                by {diary.user?.username || 'Unknown'} • {formatCambodiaDate(diary.created_at)}
              </Typography>
              <Typography variant="body2">{diary.content}</Typography>
            </Card>
          ))}
        </Box>
      )}
    </>
  );
};

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
  const [lastMessageUpdate, setLastMessageUpdate] = useState(Date.now());

  // Dialog states
  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [viewGroupDialogOpen, setViewGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchDashboardData();
  }, [isAuthenticated, navigate]);

  // Enhanced polling for real-time updates
  useEffect(() => {
    if (!selectedFriend) return;

    let isSubscribed = true;
    let retryCount = 0;
    const maxRetries = 5;

    const pollMessages = async () => {
      try {
        const chatMessages = await getPrivateChat(selectedFriend.id);
        
        if (isSubscribed) {
          const sortedMessages = chatMessages.sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );
          
          if (JSON.stringify(sortedMessages) !== JSON.stringify(messages)) {
            setMessages(sortedMessages);
            setLastMessageUpdate(Date.now());
          }
          retryCount = 0;
        }
      } catch (error) {
        console.error('Polling error:', error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          console.log('Max polling retries reached, stopping');
          return;
        }
      }
    };
    
    pollMessages();
    const pollInterval = setInterval(pollMessages, 2000);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [selectedFriend, messages.length]);

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
        initialComments[diary.id] = [];
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

  // Message handlers
  const handleSelectFriend = async (friend) => {
    setSelectedFriend(friend);
    setNewMessage('');
    setMessageLoading(true);
    try {
      const chatMessages = await getPrivateChat(friend.id);
      const sortedMessages = chatMessages.sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      );
      setMessages(sortedMessages);
      setLastMessageUpdate(Date.now());
    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setMessageLoading(false);
    }
  };

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
        is_temp: true
      };

      setMessages(prev => {
        const newMessages = [...prev, tempMessage];
        return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

      setNewMessage('');

      const sentMessage = await sendPrivateMessage(selectedFriend.id, { 
        content: messageContent, 
        message_type: 'text' 
      });

      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.is_temp);
        const newMessages = [...filtered, {
          ...sentMessage,
          created_at: sentMessage.created_at || new Date().toISOString()
        }];
        return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

      setLastMessageUpdate(Date.now());

    } catch (err) {
      setError(err.message || 'Failed to send message');
      setMessages(prev => prev.filter(msg => !msg.is_temp));
      setNewMessage(messageContent);
    } finally {
      setMessageLoading(false);
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
      group_id: '',
    },
    validationSchema: Yup.object({
      title: Yup.string().required('Title is required'),
      content: Yup.string().required('Content is required'),
      share_type: Yup.string().oneOf(['public', 'friends', 'group']),
    }),
    onSubmit: async (values, { resetForm }) => {
      try {
        await createDiary(values);
        setSuccess('Diary created successfully');
        setDiaryDialogOpen(false);
        resetForm();
        fetchDashboardData();
      } catch (err) {
        setError(err.message || 'Failed to create diary');
      }
    },
  });

  // Group form - UPDATED: Instant UI update + Join from View
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
        const newGroup = await createGroup(values);  // returns response.data
        setGroups(prev => [...prev, newGroup]);      // Instant UI update
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
    if (expandedDiary === diaryId) {
      setExpandedDiary(null);
      return;
    }

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

  const handleJoinGroup = async (groupId) => {
    try {
      await joinGroup(groupId);
      setSuccess('Joined group successfully');
      fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to join group');
    }
  };

  // View Group Handler
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
        <Card sx={{ mb: 3, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar
              src={profile?.avatar_url}
              alt={profile?.username}
              sx={{ width: 80, height: 80, mr: 3 }}
            />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" gutterBottom>
                Welcome back, {profile?.username}!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {profile?.bio || 'No bio yet.'}
              </Typography>
              <Chip
                label={profile?.is_verified ? 'Verified' : 'Not Verified'}
                color={profile?.is_verified ? 'success' : 'default'}
                size="small"
                sx={{ mt: 1 }}
              />
            </Box>
            <IconButton onClick={() => setEditing(!editing)}>
              <EditIcon />
            </IconButton>
          </Box>

          <Collapse in={!!error}>
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          </Collapse>
          <Collapse in={!!success}>
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          </Collapse>

          <Collapse in={editing}>
            <Card sx={{ p: 3, mt: 2 }}>
              <Typography variant="h6" gutterBottom>
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
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button type="submit" variant="contained">
                    Save
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={() => {
                      setEditing(false);
                      profileFormik.resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            </Card>
          </Collapse>
        </Card>

        {/* Main Content with Tabs */}
        <Card>
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
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
              <Typography variant="h5">Your Feed</Typography>
              <Button 
                variant="contained" 
                onClick={() => setDiaryDialogOpen(true)}
                startIcon={<ArticleIcon />}
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
                <Card key={diary.id} sx={{ p: 3, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {diary.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        By User #{diary.user_id} • {formatCambodiaDate(diary.created_at)}
                      </Typography>
                    </Box>
                    <Chip 
                      label={diary.share_type} 
                      size="small" 
                      color={
                        diary.share_type === 'public' ? 'primary' : 
                        diary.share_type === 'friends' ? 'secondary' : 'default'
                      } 
                    />
                  </Box>

                  <Typography variant="body1" sx={{ mb: 3 }}>
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
                        color: likedDiaries.has(diary.id) ? 'error.main' : 'text.secondary'
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
                      sx={{ minWidth: 'auto' }}
                    >
                      Comment
                      {diaryComments[diary.id]?.length > 0 && ` (${diaryComments[diary.id].length})`}
                    </Button>
                  </Box>

                  <Collapse in={expandedDiary === diary.id}>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
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
                        />
                        <Button 
                          variant="contained" 
                          onClick={() => handleAddComment(diary.id)}
                          disabled={!commentTexts[diary.id]?.trim() || commentLoading[diary.id]}
                          sx={{ minWidth: '60px' }}
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
                                  {comment.user?.username?.charAt(0) || 'U'}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" component="span" fontWeight="bold">
                                      {comment.user?.username || `User ${comment.user_id}`}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatCambodiaTime(comment.created_at)}
                                    </Typography>
                                  </Box>
                                }
                                secondary={
                                  <Typography variant="body2" sx={{ mt: 0.5 }}>
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
            <Box sx={{ display: 'flex', height: 500 }}>
              <Box sx={{ width: 300, borderRight: 1, borderColor: 'divider', pr: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Friends {messageLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
                </Typography>
                <List sx={{ maxHeight: 350, overflow: 'auto' }}>
                  {friends.map((friend) => (
                    <ListItem
                      key={friend.id}
                      selected={selectedFriend?.id === friend.id}
                      onClick={() => handleSelectFriend(friend)}
                      disabled={messageLoading}
                    >
                      <ListItemAvatar>
                        <Avatar src={friend.avatar_url} alt={friend.username}>
                          {friend.username?.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={friend.username} 
                        secondary={friend.email}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>

              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', pl: 2 }}>
                {selectedFriend ? (
                  <>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="h6">
                          Chat with {selectedFriend.username}
                        </Typography>
                        <Chip 
                          label="Real-time" 
                          size="small" 
                          color="success" 
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {messages.length > 0 ? 
                          `${messages.length} messages • Last updated: ${formatCambodiaTime(new Date().toISOString())}` : 
                          'No messages yet'
                        }
                      </Typography>
                    </Box>
                    
                    <Box sx={{ 
                      flexGrow: 1, 
                      overflow: 'auto', 
                      mb: 2, 
                      maxHeight: 300,
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      p: 1,
                      bgcolor: 'grey.50',
                      borderRadius: 1
                    }}>
                      {messages.length === 0 ? (
                        <Box sx={{ textAlign: 'center', mt: 4 }}>
                          <ChatIcon sx={{ fontSize: 48, color: 'grey.300', mb: 2 }} />
                          <Typography color="text.secondary">
                            No messages yet. Start a conversation!
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Messages update automatically every 2 seconds
                          </Typography>
                        </Box>
                      ) : (
                        [...messages].reverse().map((message) => (
                          <Box
                            key={message.id}
                            sx={{
                              display: 'flex',
                              justifyContent: message.sender_id === profile?.id ? 'flex-end' : 'flex-start',
                              mb: 1,
                            }}
                          >
                            <Card
                              sx={{
                                p: 1.5,
                                maxWidth: '70%',
                                bgcolor: message.sender_id === profile?.id ? 'primary.light' : 'white',
                                color: message.sender_id === profile?.id ? 'primary.contrastText' : 'text.primary',
                                border: message.is_temp ? '2px dashed' : 'none',
                                borderColor: message.is_temp ? 'primary.main' : 'none',
                                opacity: message.is_temp ? 0.8 : 1
                              }}
                            >
                              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                {message.content}
                                {message.is_temp && (
                                  <CircularProgress size={12} sx={{ ml: 1 }} />
                                )}
                              </Typography>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  mt: 0.5, 
                                  display: 'block',
                                  color: message.sender_id === profile?.id ? 'primary.contrastText' : 'text.secondary',
                                  opacity: 0.8,
                                  fontSize: '0.7rem'
                                }}
                              >
                                {formatCambodiaTime(message.created_at)}
                              </Typography>
                            </Card>
                          </Box>
                        ))
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Type a message... (Press Enter to send)"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        multiline
                        maxRows={3}
                        disabled={messageLoading}
                      />
                      <Button 
                        variant="contained" 
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || messageLoading}
                        sx={{ minWidth: '60px', height: '40px' }}
                      >
                        {messageLoading ? <CircularProgress size={20} /> : <SendIcon />}
                      </Button>
                    </Box>
                  </>
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%',
                    flexDirection: 'column'
                  }}>
                    <ChatIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                    <Typography color="text.secondary" align="center">
                      Select a friend to start chatting
                    </Typography>
                    <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 1 }}>
                      Messages update in real-time automatically
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </TabPanel>

          {/* Friends Tab */}
          <TabPanel value={activeTab} index={2}>
            <Typography variant="h5" gutterBottom>
              Friends
            </Typography>

            {pendingRequests.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  Pending Requests ({pendingRequests.length})
                </Typography>
                {pendingRequests.map((request) => (
                  <Card key={request.id} sx={{ p: 2, mb: 1, display: 'flex', alignItems: 'center' }}>
                    <Avatar src={request.avatar_url} sx={{ mr: 2 }}>
                      {request.username?.charAt(0)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body1">{request.username}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {request.email}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleAcceptRequest(request.id)}
                    >
                      Accept
                    </Button>
                  </Card>
                ))}
              </Box>
            )}

            <Typography variant="h6" gutterBottom>
              Your Friends ({friends.length})
            </Typography>
            {friends.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                No friends yet. Search for users to add friends!
              </Typography>
            ) : (
              friends.map((friend) => (
                <Card key={friend.id} sx={{ p: 2, mb: 1, display: 'flex', alignItems: 'center' }}>
                  <Avatar src={friend.avatar_url} sx={{ mr: 2 }}>
                    {friend.username?.charAt(0)}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1">{friend.username}</Typography>
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
                  >
                    Message
                  </Button>
                </Card>
              ))
            )}
          </TabPanel>

          {/* Groups Tab - UPDATED */}
          <TabPanel value={activeTab} index={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5">Groups</Typography>
              <Button 
                variant="contained" 
                onClick={() => setGroupDialogOpen(true)}
                startIcon={<GroupIcon />}
              >
                Create Group
              </Button>
            </Box>

            {groups.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4 }} align="center">
                You're not in any groups yet. Create one or join existing groups!
              </Typography>
            ) : (
              groups.map((group) => (
                <Card key={group.id} sx={{ p: 3, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {group.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Created {formatCambodiaDate(group.created_at)}
                      </Typography>
                      {group.description && (
                        <Typography variant="body1" sx={{ mt: 1, mb: 2, fontStyle: 'italic' }}>
                          {group.description}
                        </Typography>
                      )}
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewGroup(group)}
                    >
                      View Group
                    </Button>
                  </Box>
                </Card>
              ))
            )}
          </TabPanel>
          {/* === GROUPS TAB === */}
          <TabPanel value={activeTab} index={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5">Groups</Typography>
              <Button variant="contained" onClick={() => setGroupDialogOpen(true)} startIcon={<GroupIcon />}>
                Create Group
              </Button>
            </Box>

            {groups.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No groups yet. Create one!
              </Typography>
            ) : (
              groups.map((group) => (
                <Card key={group.id} sx={{ p: 3, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="h6">{group.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Created {formatCambodiaDate(group.created_at)}
                      </Typography>
                      {group.description && (
                        <Typography sx={{ mt: 1, fontStyle: 'italic' }}>{group.description}</Typography>
                      )}
                    </Box>
                    <Box>
                      <Tooltip title="View Group">
                        <IconButton onClick={() => handleViewGroup(group)}>
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Open Chat">
                        <IconButton component={Link} to={`/group/${group.id}`}>
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
            <Typography variant="h5" gutterBottom>
              Search Users
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              <TextField
                fullWidth
                label="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button variant="contained" onClick={handleSearch}>
                Search
              </Button>
            </Box>

            {searchResults.length === 0 && searchQuery.length >= 2 && (
              <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                No users found matching "{searchQuery}"
              </Typography>
            )}

            {searchResults.map((user) => (
              <Card key={user.id} sx={{ p: 2, mb: 1, display: 'flex', alignItems: 'center' }}>
                <Avatar src={user.avatar_url} sx={{ mr: 2 }}>
                  {user.username?.charAt(0)}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body1">{user.username}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PersonAddIcon />}
                  onClick={() => handleSendFriendRequest(user.id)}
                >
                  Add Friend
                </Button>
              </Card>
            ))}
          </TabPanel>
        </Card>
      </Box>

      {/* Create Diary Dialog */}
      <Dialog open={diaryDialogOpen} onClose={() => setDiaryDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Diary</DialogTitle>
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
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Share Type</InputLabel>
              <Select
                name="share_type"
                value={diaryFormik.values.share_type}
                onChange={diaryFormik.handleChange}
                onBlur={diaryFormik.handleBlur}
                label="Share Type"
              >
                <MenuItem value="public">Public</MenuItem>
                <MenuItem value="friends">Friends Only</MenuItem>
                <MenuItem value="group">Group</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiaryDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={diaryFormik.handleSubmit} 
            variant="contained"
            disabled={!diaryFormik.isValid}
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
      >
        <DialogTitle>Create New Group</DialogTitle>
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
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={groupFormik.handleSubmit}
            disabled={!groupFormik.isValid || groupFormik.isSubmitting}
          >
            Create Group
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Group Dialog */}
      <Dialog
        open={viewGroupDialogOpen}
        onClose={() => setViewGroupDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6">{selectedGroup?.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Created {selectedGroup && formatCambodiaDate(selectedGroup.created_at)}
              </Typography>
            </Box>
            <IconButton onClick={() => setViewGroupDialogOpen(false)}>
              <VisibilityIcon />
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
            />
          ) : (
            <Typography>Loading...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewGroupDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      {/* === CREATE GROUP DIALOG === */}
      <CreateGroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        onSuccess={(newGroup) => {
          // Add the new group to the list AND refresh everything
          setGroups(prev => [...prev, newGroup]);
          fetchDashboardData();          // <-- THIS LINE MAKES BOTH USERS SEE SAME GROUP
          setGroupDialogOpen(false);
        }}
        friends={friends}
      />
          </Layout>
    
  );
};

export default DashboardPage;