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
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                height: '80vh',
                width: '30%',
                marginLeft: 3,
                p: 1,
            }}
        >
            <Tabs
                value={tab}
                onChange={(e, v) => setTab(v)}
                sx={{
                    '& .MuiTabs-indicator': {
                        height: 4,
                        borderRadius: 2,
                        bgcolor: 'primary.main',
                    },
                }}
            >
                <Tab label={`Members (${members.length})`} />
                <Tab label={`Group Feed (${diaries.length})`} />
            </Tabs>

            {/* MEMBERS LIST */}
            {tab === 0 && (
                <List
                    sx={{
                        maxHeight: 'calc(80vh - 120px)',
                        overflowY: 'auto',
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                        p: 1,
                        '&::-webkit-scrollbar': { width: 6 },
                        '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.400', borderRadius: 3 },
                    }}
                >
                    {members.map((member) => (
                        <ListItem
                            key={member.id}
                            sx={{
                                borderRadius: 2,
                                mb: 1,
                                bgcolor: 'white',
                                display: 'flex',
                                justifyContent: 'space-between',
                                boxShadow: 1,
                                transition: '0.3s',
                                '&:hover': { boxShadow: 4 },
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <ListItemAvatar>
                                    <Avatar
                                        src={member.avatar_url}
                                        sx={{ width: 36, height: 36, fontSize: 16 }}
                                    >
                                        {member.username?.[0]?.toUpperCase() || 'U'}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography variant="subtitle2" fontWeight={500}>
                                            {member.username}
                                        </Typography>
                                    }
                                    secondary={
                                        member.id === user?.id ? 'You' : member.email
                                    }
                                />
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {group?.creator_id === member?.id && (
                                    <Typography sx={{ fontSize: 12, color: 'primary.main', fontWeight: 600 }}>
                                        Admin
                                    </Typography>
                                )}
                                {group?.creator_id === user?.id && member.id !== user?.id && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        onClick={() => {
                                            setSelectedMember(member);
                                            setOpen(true);
                                        }}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </Box>
                        </ListItem>
                    ))}
                </List>
            )}

            {/* GROUP FEED */}
            {tab === 1 && (
                <Box
                    sx={{
                        overflowY: 'auto',
                        maxHeight: 'calc(80vh - 120px)',
                        px: 1,
                        '&::-webkit-scrollbar': { display: 'none' },
                        scrollbarWidth: 'none',
                    }}
                >
                    {diaries.length === 0 ? (
                        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                            No diaries posted in this group yet.
                        </Typography>
                    ) : (
                        diaries.map((d) => {
                            const isExpanded = expendedGroupDiary === d.id;
                            const diaryComments = diaryGroupComments[d.id] || [];
                            const isLiked = d.likes?.some((like) => like.user.id === user?.id);
                            const totalLikes = d?.likes?.length;

                            return (
                                <Box
                                    key={d.id}
                                    sx={{
                                        p: 2,
                                        mb: 2,
                                        borderRadius: 3,
                                        boxShadow: 1,
                                        bgcolor: 'background.paper',
                                        transition: '0.3s',
                                        '&:hover': { boxShadow: 4 },
                                    }}
                                >
                                    <Typography variant="h6" fontWeight={600} gutterBottom>
                                        {d.title}
                                    </Typography>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {d.author?.username || "Unknown"}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {formatCambodiaDate(d.created_at)}
                                        </Typography>
                                    </Box>
                                    <Typography sx={{ mb: 2 }}>{d.content}</Typography>

                                    <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 1 }}>
                                        <Button
                                            startIcon={<FavoriteIcon sx={{ color: isLiked ? "red" : "grey.600" }} />}
                                            size="small"
                                            onClick={() => handleLikeGroupDiary(d.id)}
                                            sx={{ color: isLiked ? "red" : "grey.700", textTransform: 'none' }}
                                        >
                                            {totalLikes} {isLiked ? "Liked" : "Like"}
                                        </Button>

                                        <Button
                                            startIcon={<CommentIcon />}
                                            size="small"
                                            sx={{ color: "grey.700", textTransform: 'none' }}
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
                                                    <Box key={c.id} sx={{ mb: 1, pl: 1 }}>
                                                        <Typography variant="subtitle2">{c.author?.username || "Anonymous"}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {formatCambodiaDate(c.created_at)}
                                                        </Typography>
                                                        <Box
                                                            sx={{
                                                                ml: 0.5,
                                                                mt: 0.5,
                                                                p: 1.5,
                                                                borderRadius: 2,
                                                                bgcolor: 'grey.100',
                                                            }}
                                                        >
                                                            <Typography variant="body2">{c.content}</Typography>
                                                        </Box>
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
