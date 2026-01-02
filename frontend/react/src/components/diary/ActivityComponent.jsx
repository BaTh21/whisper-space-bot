import { Box, ListItem, List, ListItemAvatar, Avatar, ListItemText, Typography, Button } from "@mui/material"
import { getActivityInbox } from "../../services/api";
import { useEffect, useState } from 'react';
import InboxComponent from "../dialogs/InboxComponent";

function ActivityComponent() {
    const [activities, setActivities] = useState([]);
    const [popup, setPopup] = useState(false);

    const fetchData = async () => {
        try {
            const acRes = await getActivityInbox();
            setActivities(acRes);
        } catch (error) {
            setActivities([]);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSuccess = () => {
        fetchData();
        setPopup(false);
    }

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
                <Typography variant='h4'>Activity ({activities.length})</Typography>
                <Button onClick={() => setPopup(true)}>See All</Button>
            </Box>
            <List
                sx={{
                    height: '40vh',
                    overflowY: 'auto',
                    "&::-webkit-scrollbar": { display: "none" },
                    scrollbarWidth: "none",
                }}
            >
                {activities.slice(0, 25).map((activity) => {

                    return (
                        <ListItem
                            key={activity.id}
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
                                <Avatar src={activity?.actor?.avatar_url} alt="profile img">
                                    {activity.actor.username.charAt(0) || "P"}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {activity.actor.username}
                                    </Box>
                                }
                                secondary={
                                    activity.extra_data
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
                {activities.length === 0 && (
                    <Box
                        sx={{
                            textAlign: 'center',
                            // color: 'error.main'
                        }}
                    >
                        <Typography>
                            No activity found
                        </Typography>
                    </Box>
                )}
            </List>
            <InboxComponent open={popup} onClose={() => setPopup(false)} onSuccess={handleSuccess} activities={activities} />
        </Box>
    )
}

export default ActivityComponent
