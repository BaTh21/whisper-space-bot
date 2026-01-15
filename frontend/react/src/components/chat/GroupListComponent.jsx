import { useState } from "react";
import { Box, Avatar, Typography, Card, Button } from "@mui/material";
import { formatCambodiaTime } from '../../utils/dateUtils';

function GroupListComponent({ message, onForward, onClose, chats }) {
    const [selectedGroups, setSelectedGroups] = useState([]);

    console.log("chats", chats)

    const handleToggleGroup = (chatId) => {
        setSelectedGroups(prev =>
            prev.includes(chatId)
                ? prev.filter(id => id !== chatId)
                : [...prev, chatId]
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
            {chats.length === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    No chats yet. Create one to get started!
                </Typography>
            ) : (
                <>
                    {chats.map((chat) => {
                        const isSelected = selectedGroups.includes(chat.id);
                        return (
                            <Card
                                key={`${chat.type}-${chat.id}`}
                                onClick={() => handleToggleGroup(chat.id)}
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
                                    <Avatar src={chat.avatar} alt={chat.name}>
                                        {chat.name.charAt(0).toUpperCase()}
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, }}>
                                            {chat.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 10, sm: 12 }, }}>
                                            Created {formatCambodiaTime(chat.created_at)}
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
                        Forward to {selectedGroups.length} chat(s)
                    </Button>
                </>
            )}
        </Box>
    );
}

export default GroupListComponent;
