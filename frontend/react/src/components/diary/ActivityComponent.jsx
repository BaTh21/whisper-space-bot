import { Box, ListItem, List, ListItemAvatar, Avatar, ListItemText, Typography, Button } from "@mui/material"

const friends = [
    {
        id: 1,
        username: 'admin',
        email: 'has been accepted your request',
        avatar_url: 'https://imgs.search.brave.com/V9TGFVQbzCT9ioUsgVEOJjITmeIAee7LQWPo2HfdWZk/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9paDEu/cmVkYnViYmxlLm5l/dC9pbWFnZS40OTQ5/NTU4MjczLjc3NjQv/c3Qsc21hbGwsNTA3/eDUwNy1wYWQsNjAw/eDYwMCxmOGY4Zjgu/anBn'
    },
    {
        id: 2,
        username: 'test',
        email: 'has been send friend request',
        avatar_url: 'https://imgs.search.brave.com/DBqWkdJcZHY2lmjC7SlfsVM5Kuz_pX2LAg3oI0zc4i0/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9paDEu/cmVkYnViYmxlLm5l/dC9pbWFnZS41NDIw/MzQxODYyLjY0Njkv/c3Qsc21hbGwsNTA3/eDUwNy1wYWQsNjAw/eDYwMCxmOGY4Zjgu/dTIuanBn'
    },
    {
        id: 3,
        username: 'test',
        email: 'liked your status',
    },
    {
        id: 4,
        username: 'test',
        email: 'comment on your status',
        avatar_url: 'https://imgs.search.brave.com/V9TGFVQbzCT9ioUsgVEOJjITmeIAee7LQWPo2HfdWZk/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9paDEu/cmVkYnViYmxlLm5l/dC9pbWFnZS40OTQ5/NTU4MjczLjc3NjQv/c3Qsc21hbGwsNTA3/eDUwNy1wYWQsNjAw/eDYwMCxmOGY4Zjgu/anBn'
    },
]

function ActivityComponent() {
    return (
        <Box
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    // width: 250
                }}
            >
                <Typography variant='h4'>Activity (4)</Typography>
                <Button>Seen All</Button>
            </Box>
            <List
                sx={{
                    height: '40vh',
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
                        </ListItem>
                    );
                })}
                {friends.length === 0 &&(
                    <Box>
                        No status yet
                    </Box>
                )}
            </List>
        </Box>
    )
}

export default ActivityComponent
