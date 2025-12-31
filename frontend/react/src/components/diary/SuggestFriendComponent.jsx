import { Box, ListItem, List, ListItemAvatar, Avatar, ListItemText, Typography, Button, IconButton } from "@mui/material"
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { getSuggestFriends, sendFriendRequest } from '../../services/api';
import { useEffect, useState } from "react";
import { toast } from 'react-toastify';

function SuggestFriendComponent() {
    const [friends, setFriends] = useState([]);

    const fetchData = async () => {
        const res = await getSuggestFriends();
        setFriends(res);

    }

    useEffect(() => {
        fetchData();
    }, []);

    const handleSendFriendRequest = async (userId) => {
        const result = await sendFriendRequest(userId);

        if (result.success) {
            toast.success(result.message);
            fetchData();
        } else {
            toast.error(result.message);
        }
    };

    return (
        <Box
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <Typography variant='h4'>Suggested for you</Typography>
                <Button>Seen All</Button>
            </Box>
            <List
                sx={{
                    height: '30vh',
                    overflowY: 'auto',
                    "&::-webkit-scrollbar": { display: "none" },
                    scrollbarWidth: "none",
                }}
            >
                {friends.slice(0, 25).map((friend) => {

                    return (
                        <ListItem
                            key={friend.id}
                            sx={{
                                p: 1,
                                mb: 1,
                                borderRadius: '12px',
                                boxShadow: 0,
                                backgroundColor: 'white',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    transform: { xs: 'none', sm: 'translateY(-2px)' },
                                    boxShadow: { xs: 'none', sm: '0 4px 12px rgba(0,0,0,0.1)' },
                                }
                            }}
                        >
                            <ListItemAvatar sx={{ position: 'relative' }}>
                                <Avatar src={friend.avatar_url} alt="profile img">
                                    {friend.username.charAt(0) || "P"}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {friend.username}
                                    </Box>
                                }
                                secondary='Suggest for you'
                                secondaryTypographyProps={{
                                    sx: {
                                        fontSize: '0.75rem',
                                    }
                                }}
                            />
                            <IconButton
                                onClick={() => handleSendFriendRequest(friend.id)}
                            >
                                <PersonAddIcon />
                            </IconButton>
                        </ListItem>
                    );
                })}
                {friends.length === 0 && (
                    <Box
                        sx={{
                            textAlign: 'center',
                            // color: 'error.main'
                        }}
                    >
                        <Typography>
                            No user to suggest
                        </Typography>
                    </Box>
                )}
            </List>
        </Box>
    )
}

export default SuggestFriendComponent
