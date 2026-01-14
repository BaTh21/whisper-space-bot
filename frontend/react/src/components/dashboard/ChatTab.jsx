import {
    Box, List, IconButton, Button, ListItem, ListItemAvatar, Avatar, ListItemText, Typography, TextField, InputAdornment, useMediaQuery,
    useTheme,
} from "@mui/material";
import { getChatList } from "../../services/api"
import { useState, useEffect } from "react"
import SearchIcon from '@mui/icons-material/Search';
import MessagesTab from "./MessagesTab";
import GroupChatPage from "../../pages/GroupChatPage";
import CreateGroupDialog from "../CreateGroupDialog";
import AddBoxIcon from '@mui/icons-material/AddBox';
import { useTranslation } from 'react-i18next';
import Logo from '/pengu-pudgy.webp';

function ChatTab({ friends, profile, setError, setSuccess }) {
    const [chats, setChats] = useState([]);
    const [showFriend, setShowFriend] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [showGroupList, setShowGroupList] = useState(true);
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [openCreateGroup, setOpenCreateGroup] = useState(false);
    const { t } = useTranslation();

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Resizable Sidebar
    const [chatWidth, setChatWidth] = useState(300);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isResizing) {
                const newWidth = e.clientX;
                if (newWidth > 200 && newWidth < 600) {
                    setChatWidth(newWidth);
                }
            }
        };
        const handleMouseUp = () => setIsResizing(false);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const fetchData = async () => {
        const res = await getChatList();
        setChats(res);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleGroupList = () => {
        if (isMobile) {
            setShowGroupList(true);
            setShowFriend(false);
            setSelectedGroupId(null);
        }
    };

    const handleSuccess = () => {
        setOpenCreateGroup(false);
        fetchData();
    };

    return (
        <Box sx={{ display: 'flex', width: '100%', height: '100vh', position: 'relative' }}>
            {/* --- Sidebar --- */}
            {(showGroupList || !isMobile) && (
                <Box
                    sx={{
                        position: 'relative', // important for resizer positioning
                        width: { xs: '100%', md: chatWidth },
                        minWidth: 200,
                        maxWidth: 600,
                        transition: 'width 0.1s',
                        borderRight: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            All Chats ({chats.length})
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddBoxIcon />}
                            sx={{ borderRadius: '8px', minWidth: { xs: 10, sm: 'auto' } }}
                            size={isMobile ? 'small' : 'medium'}
                            onClick={() => setOpenCreateGroup(true)}
                        >
                            {t('create')}
                        </Button>
                    </Box>

                    <Box sx={{ p: 2, pt: 0 }}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Search chat"
                            variant="outlined"
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

                    <Box
                        sx={{
                            flex: 1,
                            overflowY: 'auto',
                            px: 2,
                            '&::-webkit-scrollbar': { display: 'none' },
                            scrollbarWidth: 'none',
                        }}
                    >
                        <List>
                            {chats.map((chat) => (
                                <ListItem
                                    key={`${chat.type}-${chat.id}`}
                                    onClick={() => {
                                        if (isMobile) setShowGroupList(false);
                                        if (chat.type === 'private') {
                                            setShowFriend(true);
                                            setSelectedFriend({
                                                id: chat.id,
                                                name: chat.name,
                                                avatar: chat.avatar,
                                            });
                                            setSelectedGroupId(null);
                                        } else if (chat.type === 'group') {
                                            setShowFriend(false);
                                            setSelectedGroupId(chat.id);
                                            setSelectedFriend(null);
                                        }
                                    }}
                                    sx={{
                                        mb: 1,
                                        p: 1,
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        backgroundColor:
                                            (chat.type === 'private' && selectedFriend?.id === chat.id) ||
                                                (chat.type === 'group' && selectedGroupId === chat.id)
                                                ? 'primary.main'
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
                                    <ListItemAvatar>
                                        <Avatar src={chat.avatar}>{chat.name.charAt(0)}</Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={chat.name}
                                        secondary={chat.last_message || 'Tap to start new message'}
                                        secondaryTypographyProps={{ sx: { fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Box>

                    {!isMobile && (
                        <Box
                            sx={{
                                width: 12,
                                cursor: 'col-resize',
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 1000,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                '&:hover .handle': { backgroundColor: 'divider' },
                            }}
                            onMouseDown={() => setIsResizing(true)}
                            onTouchStart={() => setIsResizing(true)}
                        />
                    )}
                </Box>
            )}

            <Box sx={{ flex: 1, position: 'relative' }}>
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
                {selectedGroupId && <GroupChatPage groupId={selectedGroupId} toggleGroupList={toggleGroupList} />}
                {!showFriend && !selectedGroupId && !isMobile && (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            flexDirection: 'column',
                            border: 1,
                            borderColor: 'divider',
                        }}
                    >
                        <img src={Logo} alt="logo" width={150} />
                        <Typography sx={{ fontSize: 20, color: 'primary.main', mt: 1 }}>
                            Tap a chat to start new message
                        </Typography>
                    </Box>
                )}
            </Box>

            <CreateGroupDialog open={openCreateGroup} onClose={() => setOpenCreateGroup(false)} onSuccess={handleSuccess} friends={friends} />
        </Box>
    );
}

export default ChatTab;
