import { useState, useEffect } from "react";
import { Box, Avatar, Typography, Card, Button } from "@mui/material";
import { formatCambodiaTime } from '../../utils/dateUtils';
import { getUserGroups } from "../../services/api";

function GroupListComponent({ message, onForward, onClose }) {
    const [groups, setGroups] = useState([]);
    const [selectedGroups, setSelectedGroups] = useState([]);

    const fetchUserGroups = async () => {
        try {
            const res = await getUserGroups();
            setGroups(res || []);
        } catch (error) {
            setGroups([]);
            console.log("Failed to fetch groups:", error.message);
        }
    }

    useEffect(() => {
        fetchUserGroups();
    }, []);

    const getLatestCover = (group) => {
        if (!group.images || group.images.length === 0) return null;

        return group.images.reduce((latest, current) =>
            new Date(current.created_at) > new Date(latest.created_at) ? current : latest
        ).url;
    };

    const handleToggleGroup = (groupId) => {
        setSelectedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    const handleConfirmForward = () => {
        if (selectedGroups.length > 0) {
            onForward(message, selectedGroups);
        }
        if (onClose) onClose();
    };

    return (
        <Box sx={{ p: 2 }}>
            {groups.length === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    No groups yet. Create one to get started!
                </Typography>
            ) : (
                <>
                    {groups.map((group) => {
                        const isSelected = selectedGroups.includes(group.id);
                        return (
                            <Card
                                key={group.id}
                                onClick={() => handleToggleGroup(group.id)}
                                sx={{
                                    p: 1,
                                    mb: 1,
                                    borderRadius: '12px',
                                    boxShadow: isSelected ? 2 : 0,
                                    border: isSelected ? '2px solid #1976d2' : 'none',
                                    backgroundColor: 'white',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        transform: { xs: 'none', sm: 'translateY(-2px)' },
                                        boxShadow: { xs: 'none', sm: '0 4px 12px rgba(0,0,0,0.1)' },
                                    }
                                }}
                            >
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: { xs: 'column', sm: 'row' },
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: { xs: 1, sm: 2 }
                                }}>
                                    <Avatar src={getLatestCover(group)}>
                                        {!group.images || group.images.length === 0 ? group.name[0] : null}
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, }}>
                                            {group.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 10, sm: 12 }, }}>
                                            Created {formatCambodiaTime(group.created_at)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Card>
                        )
                    })}
                    <Button
                        variant="contained"
                        fullWidth
                        sx={{ mt: 2 }}
                        disabled={selectedGroups.length === 0}
                        onClick={handleConfirmForward}
                    >
                        Forward to {selectedGroups.length} group(s)
                    </Button>
                </>
            )}
        </Box>
    );
}

export default GroupListComponent;
