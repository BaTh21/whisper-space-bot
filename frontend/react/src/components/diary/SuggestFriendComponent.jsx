import { Box, ListItem, List, ListItemAvatar, Avatar, ListItemText, Typography, Button, IconButton } from "@mui/material"
import PersonAddIcon from '@mui/icons-material/PersonAdd';

const friends = [
    {
        id: 1,
        username: 'admin',
        email: 'Suggested for you',
        avatar_url: 'https://imgs.search.brave.com/V9TGFVQbzCT9ioUsgVEOJjITmeIAee7LQWPo2HfdWZk/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9paDEu/cmVkYnViYmxlLm5l/dC9pbWFnZS40OTQ5/NTU4MjczLjc3NjQv/c3Qsc21hbGwsNTA3/eDUwNy1wYWQsNjAw/eDYwMCxmOGY4Zjgu/anBn'
    },
    {
        id: 2,
        username: 'test',
        email: 'Suggested for you',
        avatar_url: 'https://imgs.search.brave.com/DBqWkdJcZHY2lmjC7SlfsVM5Kuz_pX2LAg3oI0zc4i0/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9paDEu/cmVkYnViYmxlLm5l/dC9pbWFnZS41NDIw/MzQxODYyLjY0Njkv/c3Qsc21hbGwsNTA3/eDUwNy1wYWQsNjAw/eDYwMCxmOGY4Zjgu/dTIuanBn'
    },
    {
        id: 3,
        username: 'test',
        email: 'Suggested for you',
    },
    {
        id: 4,
        username: 'test',
        email: 'Suggested for you',
    }

]

function SuggestFriendComponent() {
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
                {friends.map((friend) => {

                    return (
                        <ListItem
                            key={friend.id}
                            onClick={() => {
                                setShowFriend(true);
                                handleSelectFriend(friend);
                            }}
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
                                secondary={
                                    friend.email
                                }
                                secondaryTypographyProps={{
                                    sx: {
                                        fontSize: '0.75rem',
                                    }
                                }}
                            />
                            <IconButton>
                                <PersonAddIcon />
                            </IconButton>
                        </ListItem>
                    );
                })}
            </List>
        </Box>
    )
}

export default SuggestFriendComponent
