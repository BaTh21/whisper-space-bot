import {
    Box, List, IconButton, Button, ListItem, ListItemAvatar, Avatar, ListItemText, Typography, TextField, InputAdornment, useMediaQuery,
    useTheme,
} from "@mui/material";
import { getChatList } from "../../services/api"
import { useState, useEffect } from "react"
import SearchIcon from '@mui/icons-material/Search';
import MessagesTab from "./MessagesTab";
import { checkBlockedStatus } from '../../services/api';
import GroupChatPage from "../../pages/GroupChatPage";
import CreateGroupDialog from "../CreateGroupDialog";
import AddBoxIcon from '@mui/icons-material/AddBox';
import { useTranslation } from 'react-i18next';
import Logo from '/whisperspace.png';

function ChatTab({ friends, profile, setError, setSuccess }) {
    const [chats, setChats] = useState([]);
    const [showFriend, setShowFriend] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [blockStatus, setBlockStatus] = useState({});
    const [showGroupList, setShowGroupList] = useState(true);
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [openCreateGroup, setOpenCreateGroup] = useState(false);
    const { t } = useTranslation();

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const toggleGroupList = () => {
        if (isMobile) {
            setShowGroupList(true);
            setShowFriend(false);
            setSelectedGroupId(null);
        }
    };

    const checkIfUserIsBlocked = async (userId) => {
        try {
            const status = await checkBlockedStatus(userId);
            setBlockStatus(prev => ({
                ...prev,
                [userId]: status.is_blocked
            }));
            return status.is_blocked;
        } catch (error) {
            return blockedUsers.some(user => user.id === userId);
        }
    };

    const fetchData = async () => {
        const res = await getChatList();
        setChats(res);
    }

    useEffect(() => {
        fetchData();
    }, []);

    const handleSuccess = () => {
        fetchData();
    }

    console.log("chat", chats)

    const handleSelectedFriend = async (friend) => {
        const isBlocked =
            blockStatus[friend.id] || await checkIfUserIsBlocked(friend.id);

        if (isBlocked) {
            setError(`You have blocked ${friend.username}. Unblock them to chat.`);
            return;
        }

        if (selectedFriend?.id === friend.id) return;

        setSelectedFriend(friend);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                width: '100%',
                gap: 3,
            }}
        >
            {(showGroupList || !isMobile) && (
                <Box sx={{ width: { xs: '100%', md: 300 } }}>
                    <Box sx={{ pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            All Chats
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddBoxIcon />}
                            sx={{
                                borderRadius: '8px',
                                minWidth: { xs: 10, sm: 'auto' }
                            }}
                            size={isMobile ? 'small' : 'medium'}
                            onClick={() => setOpenCreateGroup(true)}
                        >
                            {t('create')}
                        </Button>
                    </Box>
                    <Box>
                        <TextField
                            sx={{ width: "100%" }}
                            id="outlined-member-search"
                            label='Search chat'
                            variant="outlined"
                            size="small"
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton>
                                            <SearchIcon />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>

                    <Box sx={{ mt: 2, height: '80vh', overflowY: 'auto' }}>
                        <List>
                            {chats.map((chat) => (
                                <ListItem
                                    key={`${chat.type}-${chat.id}`}
                                    onClick={() => {
                                        if (isMobile) setShowGroupList(false);

                                        if (chat.type === 'private') {
                                            setShowFriend(true);
                                            setSelectedFriend({
                                                id: chat.id,      // Use friend/user ID here
                                                name: chat.name,
                                                avatar: chat.avatar,
                                            });
                                            setSelectedGroupId(null); // deselect any group
                                        }

                                        if (chat.type === 'group') {
                                            setShowFriend(false);
                                            setSelectedGroupId(chat.id);
                                            setSelectedFriend(null); // deselect any private chat
                                        }
                                    }}
                                    sx={{
                                        p: 1,
                                        mb: 1,
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        backgroundColor:
                                            (chat.type === 'private' && selectedFriend?.id === chat.id) ||
                                                (chat.type === 'group' && selectedGroupId === chat.id)
                                                ? 'primary.light'
                                                : 'white',
                                        color:
                                            (chat.type === 'private' && selectedFriend?.id === chat.id) ||
                                                (chat.type === 'group' && selectedGroupId === chat.id)
                                                ? 'primary.contrastText'
                                                : 'inherit',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: { xs: 'none', sm: 'translateY(-2px)' },
                                            boxShadow: { xs: 'none', sm: '0 4px 12px rgba(0,0,0,0.1)' },
                                        },
                                    }}
                                >
                                    <ListItemAvatar sx={{ position: 'relative' }}>
                                        <Avatar src={chat.avatar}
                                            sx={{
                                                border: 1,
                                                borderColor: 'divider',
                                                p: 0.25
                                            }}
                                        >
                                            {chat.name.charAt(0)}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {chat.name}
                                            </Box>
                                        }
                                        secondary={chat.last_message ? chat.last_message : 'Tap to start new message'}
                                        secondaryTypographyProps={{ sx: { fontSize: '0.75rem' } }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                </Box>

            )}
            {(showFriend || selectedGroupId) && (
                <Box
                    sx={{
                        width: '100%'
                    }}
                >
                    {showFriend && (
                        <MessagesTab
                            friends={friends}
                            profile={profile}
                            setError={setError}
                            setSuccess={setSuccess}
                            showFriend={showFriend}
                            selectedFriend={selectedFriend}
                            toggleGroupList={toggleGroupList}
                        />
                    )}
                    {selectedGroupId && (
                        <GroupChatPage
                            groupId={selectedGroupId}
                            toggleGroupList={toggleGroupList}
                        />
                    )}
                </Box>
            )}
            {(!showFriend ) && !isMobile && !selectedGroupId &&(
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexDirection: 'column'
                    }}
                >
                    <img src={Logo} alt="logo" width={100}/>
                    <Typography
                    sx={{
                        fontSize: 20,
                        color: 'primary.main',
                        mt: 2
                    }}
                    >
                        Tab a chat to start new message
                    </Typography>
                </Box>
            )}
            <CreateGroupDialog
                open={openCreateGroup}
                onClose={() => setOpenCreateGroup(false)}
                onSuccess={handleSuccess}
                friends={friends}
            />
        </Box>
    )
}

export default ChatTab
