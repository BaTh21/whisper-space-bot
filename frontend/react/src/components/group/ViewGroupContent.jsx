import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Card,
  TextField,
  Collapse,
  CircularProgress
} from '@mui/material';
import {
  Favorite as FavoriteIcon,
  Comment as CommentIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { 
  getGroupMembers, 
  getGroupDiaries, 
  getGroupMessage, 
  joinGroup,
  likeDiary,
  commentOnDiary,
  getDiaryComments
} from '../../services/api';
import { formatCambodiaDate } from '../../utils/dateUtils';

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
      // Rollback on failure
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

export default ViewGroupContent;