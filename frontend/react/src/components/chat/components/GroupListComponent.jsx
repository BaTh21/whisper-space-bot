import { getUserGroups } from "../../../services/api";
import { useState, useEffect } from "react";
import { Box, Avatar, Typography, Card } from "@mui/material";
import { formatCambodiaTime } from '../../../utils/dateUtils';

function GroupListComponent({message}) {
    const [groups, setGroups] = useState([]);

    console.log("message", message);

    const fetchUserGroups = async () => {
        try {
            const res = await getUserGroups();
            setGroups(res || []);
        }
        catch (error) {
            setGroups([]);
            const errorMessage = error.message;
            console.log("Failed to fetch group", errorMessage);
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

    return (
        <div>
            {groups.length === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    No groups yet. Create one to get started!
                </Typography>
            ) : (
                groups.map((group) => (
                    <Card
                        key={group.id}
                        onClick={() => {
                            setSelectedGroupId(group.id);
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
                        <Box sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: { xs: 1, sm: 2 },
                            alignItems: 'center'
                        }}>
                            <Avatar
                                src={getLatestCover(group)}
                            >
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
                ))
            )}
        </div>
    )
}

export default GroupListComponent
