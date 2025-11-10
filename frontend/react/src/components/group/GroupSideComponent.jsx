import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
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
    Comment as CommentIcon
} from '@mui/icons-material';
import {
    getGroupMembers,
    getGroupDiaries,
    likeDiary,
    commentOnDiary,
    getDiaryComments,
    getGroupById,
    removeGroupMember
} from '../../services/api';
import { formatCambodiaDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { useParams } from 'react-router-dom';
import DeleteDialog from '../dialogs/DeleteDialog';

const GroupSideComponent = () => {
    const { groupId } = useParams();
    const [members, setMembers] = useState([]);
    const [diaries, setDiaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(0);
    const [expendedGroupDiary, setExpendGroupDiary] = useState(null);
    const [diaryGroupComments, setDiaryGroupComments] = useState({});
    const [newComment, setNewComment] = useState({});
    const [postingComment, setPostingComment] = useState({});
    const { auth } = useAuth();
    const user = auth?.user;
    const [group, setGroup] = useState(null);
    const [open, setOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);

    useEffect(() => {
        const fetchGroupData = async () => {
            setLoading(true);
            try {
                const [membersData, diariesData, groupData] = await Promise.all([
                    getGroupMembers(groupId),
                    getGroupDiaries(groupId),
                    getGroupById(groupId)
                ]);
                setMembers(membersData);
                setDiaries(diariesData);
                setGroup(groupData);
            } catch (err) {
                console.log(err);
            } finally {
                setLoading(false);
            }
        };
        fetchGroupData();
    }, [groupId]);

    const handleToggleComments = async (diaryId) => {
        if (expendedGroupDiary === diaryId) {
            setExpendGroupDiary(null);
        } else {
            setExpendGroupDiary(diaryId);
            if (!diaryGroupComments[diaryId]) {
                try {
                    const data = await getDiaryComments(diaryId);
                    setDiaryGroupComments(prev => ({ ...prev, [diaryId]: data }));
                } catch {
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

                const isLiked = d.likes?.some((like) => like.user.id === user?.id);
                let updatedLikes;

                if (isLiked) {
                    updatedLikes = d.likes.filter((like) => like.user.id !== user?.id);
                } else {
                    updatedLikes = [
                        ...d.likes,
                        { id: Date.now(), user: { id: user?.id, username: user?.username } },
                    ];
                }

                return { ...d, likes: updatedLikes };
            })
        );

        try {
            await likeDiary(diaryId);
        } catch (error) {
            console.error("Failed to like diary:", error.message);
        }
    };

    const handleRemoveMember = async (groupId, memberId) => {
        try {
            await removeGroupMember(groupId, memberId);
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    }

    const handleConfirmRemove = async () => {
        if (selectedMember) {
            try {
                await handleRemoveMember(group.id, selectedMember.id);
                setMembers(prev => prev.filter(m => m.id !== selectedMember.id));

                setSelectedMember(null);
                setOpen(false);
            } catch (error) {
                console.error(error);
                alert("Failed to remove member");
            }
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '80vh', width: '30%', marginTop: 2, marginLeft: 2 }}>
            <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 1 }}>
                <Tab label={`Members (${members.length})`} />
                <Tab label={`Group Feed (${diaries.length})`} />
            </Tabs>

            {tab === 0 && (
                <List sx={{ maxHeight: 200, overflow: 'auto', borderRadius: '12px', p: 1 }}>
                    {members.map((member) => (
                        <ListItem key={member.id} sx={{ borderRadius: '8px', mb: 1, bgcolor: 'grey.100', display: 'flex', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <ListItemAvatar>
                                    <Avatar
                                        src={member.avatar_url}
                                        sx={{ width: 32, height: 32 }}
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
                                    secondary={member.id === user?.id ? 'You' : member.email}
                                />
                            </Box>
                            {group?.creator_id === member?.id && (
                                <Typography sx={{fontSize: 14, color: 'red'}}>
                                Admin
                                </Typography>
                            )}
                            {group?.creator_id === user?.id && member.id !== user?.id && (
                                <Button
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                        setSelectedMember(member);
                                        setOpen(true);
                                    }}
                                >
                                    Kick Out
                                </Button>
                            )}

                        </ListItem>
                    ))}
                </List>
            )}

            {tab === 1 && (
                <Box sx={{
                    overflow: 'auto',
                    // Hide scrollbar
                    '&::-webkit-scrollbar': {
                        display: 'none', // Chrome, Safari, Edge
                    },
                    scrollbarWidth: 'none', // Firefox
                }}>
                    {diaries.length === 0 ? (
                        <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                            No diaries posted in this group yet.
                        </Typography>
                    ) : (
                        diaries.map((d) => {
                            const isExpanded = expendedGroupDiary === d.id;
                            const diaryComments = diaryGroupComments[d.id] || [];
                            const isLiked = d.likes?.some((like) => like.user.id === user?.id);
                            const totalLikes = d?.likes?.length;

                            return (
                                <Box key={d.id} sx={{ p: 2, mb: 2, borderRadius: '12px', boxShadow: 1, backgroundColor: '#f8f8f8c2' }}>
                                    <Typography sx={{ fontSize: 20, fontWeight: "bold" }}>
                                        {d.title}
                                    </Typography>
                                    <Box display={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {d.author?.username || "Unknown"}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {formatCambodiaDate(d.created_at)}
                                        </Typography>
                                    </Box>
                                    <Typography sx={{ mb: 1 }}>{d.content}</Typography>

                                    <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                                        <Box sx={{ display: 'flex', alignItems: "center" }}>
                                            <Typography sx={{ mr: 1 }}>{totalLikes}</Typography>
                                            <Button
                                                startIcon={<FavoriteIcon sx={{ color: isLiked ? "red" : "grey" }} />}
                                                size="small"
                                                onClick={() => handleLikeGroupDiary(d.id)}
                                                sx={{ color: isLiked ? "red" : "grey" }}
                                            >
                                                {isLiked ? "Liked" : "Like"}
                                            </Button>
                                        </Box>

                                        <Button
                                            startIcon={<CommentIcon />}
                                            size="small"
                                            sx={{ color: "grey" }}
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
                                                        <Typography variant="caption" color="text.secondary">
                                                            {formatCambodiaDate(c.created_at)}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ ml: 1, bgcolor: 'grey.200', p: 1.5, mt: 0.5, borderRadius: 2 }}>
                                                            {c.content}
                                                        </Typography>
                                                    </Box>
                                                ))
                                            )}
                                        </Box>
                                    </Collapse>
                                </Box>
                            );
                        })
                    )}
                </Box>
            )}

            <DeleteDialog
                open={open}
                onClose={() => setOpen(false)}
                title="Remove member"
                description={
                    selectedMember
                        ? `Are you sure you want to remove ${selectedMember.username} from ${group.name}?`
                        : ""
                }
                onConfirm={handleConfirmRemove}
            />
        </Box>
    );
};

export default GroupSideComponent;
