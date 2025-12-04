// InboxComponentDialog.jsx
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
    acceptFriendRequest,
    acceptGroupInvite,
    declineFriendRequest,
    deleteInvite,
    getPendingFriendRequests,
    getPendingGroupInvites
} from '../../services/api';
import { websocketService } from '../../services/websocketService';
import { formatCambodiaTime } from '../../utils/dateUtils';
import DeleteDialog from './DeleteDialog';

export default function InboxComponent({ open, onClose, onSuccess }) {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletePopup, setDeletePopup] = useState(false);
    const [inviteId, setInviteId] = useState(null);
    const [processingInviteId, setProcessingInviteId] = useState(null);

    const [friendRequests, setFriendRequests] = useState([]);
    const [newMessages, setNewMessages] = useState([]);
    const [wsConnected, setWsConnected] = useState(false);
    const [loadingFriendRequests, setLoadingFriendRequests] = useState(false);

    // Initialize friendRequests as array on mount
    useEffect(() => {
        if (!Array.isArray(friendRequests)) {
            setFriendRequests([]);
        }
    }, []);

    const fetchInvites = async () => {
        try {
            setLoading(true);
            const res = await getPendingGroupInvites();
            setInvites(res);
        } catch (error) {
            console.error("Error fetching invites:", error);
            setInvites([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchFriendRequests = async () => {
        try {
            setLoadingFriendRequests(true);

            // Check if user is logged in
            const token = localStorage.getItem('access_token') || 'dummy-dev-token';
            if (!token) {
                toast.error("Please login first");
                setFriendRequests([]);
                return;
            }

            const response = await getPendingFriendRequests();

            if (response && Array.isArray(response)) {
                const normalizedRequests = response.map((req, index) => ({
                    friend_request_id: req.friend_request_id || req.id || `req-${index}`,
                    requester_id: req.requester_id || req.id || 0,
                    requester_username: req.requester_username || req.username || 'Unknown User',
                    requester_avatar_url: req.requester_avatar_url || req.avatar_url || '',
                    created_at: req.created_at || new Date().toISOString(),
                    status: req.status || 'pending'
                }));

                setFriendRequests(normalizedRequests);
            } else {
                console.warn("Response is not an array or empty:", response);
                setFriendRequests([]);
            }
        } catch (apiError) {
            console.error("API Error:", apiError);

            if (apiError.response?.status === 404) {
                toast.error("Friend requests endpoint not found");
            } else if (apiError.response?.status === 401) {
                toast.error("Session expired. Please login again.");
            } else {
                toast.error("Failed to load friend requests");
            }

            setFriendRequests([]);
        } finally {
            setLoadingFriendRequests(false);
        }
    };

    const handleAcceptInvite = async (inviteId) => {
        try {
            setProcessingInviteId(inviteId);
            await acceptGroupInvite(inviteId);
            toast.success("You have joined the group successfully!");
            fetchInvites();
        } catch (error) {
            toast.error(error.message || "Failed to accept invite");
        } finally {
            setProcessingInviteId(null);
        }
    };

    const handleDeleteInvite = async () => {
        try {
            await deleteInvite(inviteId);
            toast.success("Invite has been deleted");
            setDeletePopup(false);
            fetchInvites();
        } catch (error) {
            toast.error(error.message || "Failed to delete invite");
        }
    };

    // WebSocket message handlers
    const handleFriendRequest = useCallback((data) => {
        console.log('📬 Friend request received:', data);
        if (data.type === 'friend_request') {
            const requestData = data.data || data;

            toast.info(`New friend request from ${requestData.requester_username}`, {
                position: "top-right",
                autoClose: 5000,
            });

            setFriendRequests(prev => {
                const currentRequests = Array.isArray(prev) ? prev : [];
                const requestId = requestData.id || requestData.friend_request_id;

                // Check if already exists
                if (currentRequests.some(req => req.friend_request_id === requestId)) {
                    return currentRequests;
                }

                return [...currentRequests, {
                    friend_request_id: requestId,
                    requester_id: requestData.requester_id,
                    requester_username: requestData.requester_username,
                    requester_avatar_url: requestData.requester_avatar_url || '',
                    created_at: requestData.created_at || new Date().toISOString(),
                    status: 'pending'
                }];
            });
        }
    }, []);

    const handleFriendRequestSent = useCallback((data) => {
        if (data.type === 'friend_request_sent') {
            toast.success(`Friend request sent to ${data.data?.recipient_username}`, {
                position: "top-right",
                autoClose: 3000,
            });
        }
    }, []);

    const handleAcceptFriendRequest = async (requesterId, friendRequestId) => {
        try {
            const response = await acceptFriendRequest(requesterId);
            toast.success(response.msg || "Friend request accepted!");

            // Remove from list
            setFriendRequests(prev => {
                const currentRequests = Array.isArray(prev) ? prev : [];
                return currentRequests.filter(req => req.requester_id !== requesterId);
            });
        } catch (error) {
            console.error("Error accepting friend request:", error);
            toast.error(error.response?.data?.detail || "Failed to accept friend request");
        }
    };

    const handleDeclineFriendRequest = async (requesterId, friendRequestId) => {
        try {
            const response = await declineFriendRequest(requesterId);
            toast.success(response.msg || "Friend request declined");

            // Remove from list
            setFriendRequests(prev => {
                const currentRequests = Array.isArray(prev) ? prev : [];
                return currentRequests.filter(req => req.requester_id !== requesterId);
            });
        } catch (error) {
            toast.error(error.response?.data?.detail || "Failed to decline friend request");
        }
    };

    const handleGroupInvite = useCallback((data) => {
        if (data.type === 'group_invite') {
            const groupName = data.data?.group_name || 'a group';
            toast.info(`New group invite: ${groupName}`);
            fetchInvites(); // Refresh invites
        }
    }, []);

    const handleNewMessage = useCallback((data) => {
        if (data.type === 'message') {
            setNewMessages(prev => {
                const currentMessages = Array.isArray(prev) ? prev : [];
                if (currentMessages.some(msg => msg.id === data.id)) {
                    return currentMessages;
                }
                return [...currentMessages, {
                    type: 'message',
                    ...data
                }];
            });

            if (data.sender_username) {
                const preview = data.content?.length > 50
                    ? `${data.content.substring(0, 50)}...`
                    : data.content || "New message";
                toast.info(`New message from ${data.sender_username}: ${preview}`);
            }
        }
    }, []);

    const handleFriendRequestAccepted = useCallback((data) => {
        if (data.type === 'friend_request_accepted') {
            const requestData = data.data || data;
            toast.success(`${requestData.friend_username} accepted your friend request!`);

            setFriendRequests(prev => {
                const currentRequests = Array.isArray(prev) ? prev : [];
                return currentRequests.filter(req => req.requester_id !== requestData.friend_id);
            });
        }
    }, []);

    const handleFriendRequestDeclined = useCallback((data) => {
        if (data.type === 'friend_request_declined') {
            const requestData = data.data || data;
            toast.info(`${requestData.declined_by_username} declined your friend request`);

            setFriendRequests(prev => {
                const currentRequests = Array.isArray(prev) ? prev : [];
                return currentRequests.filter(req => req.requester_id !== requestData.declined_by_id);
            });
        }
    }, []);

    const handleFriendAdded = useCallback((data) => {
        if (data.type === 'friend_added') {
            const requestData = data.data || data;
            toast.success(`You are now friends with ${requestData.friend_username}!`);

            setFriendRequests(prev => {
                const currentRequests = Array.isArray(prev) ? prev : [];
                return currentRequests.filter(req => req.requester_id !== requestData.friend_id);
            });
        }
    }, []);

    const handleUnfriended = useCallback((data) => {
        if (data.type === 'unfriended') {
            const requestData = data.data || data;
            toast.info(`${requestData.unfriended_by_username} unfriended you`);
        }
    }, []);

    // WebSocket connection management
    useEffect(() => {
        if (open) {
            console.log('📬 Opening inbox...');

            // Fetch initial data
            fetchInvites();
            fetchFriendRequests();

            // Connect WebSocket with proper error handling
            console.log('🔌 Initializing WebSocket...');

            const connectWebSocket = async () => {
                try {
                    // Connect to notifications WebSocket
                    const authResult = await websocketService.connectToNotifications();
                    console.log('✅ WebSocket connected and authenticated:', authResult);

                    const status = websocketService.getStatus();
                    setWsConnected(status.isConnected && status.isAuthenticated);

                    // Register WebSocket handlers
                    websocketService.onMessage('friend_request', handleFriendRequest);
                    websocketService.onMessage('friend_request_sent', handleFriendRequestSent);
                    websocketService.onMessage('friend_request_accepted', handleFriendRequestAccepted);
                    websocketService.onMessage('friend_request_declined', handleFriendRequestDeclined);
                    websocketService.onMessage('friend_added', handleFriendAdded);
                    websocketService.onMessage('unfriended', handleUnfriended);
                    websocketService.onMessage('group_invite', handleGroupInvite);
                    websocketService.onMessage('message', handleNewMessage);
                    websocketService.onMessage('auth_success', (data) => {
                        console.log('🎉 WebSocket authenticated:', data);
                        setWsConnected(true);
                    });

                } catch (error) {
                    console.error('❌ Failed to connect WebSocket:', error);
                    setWsConnected(false);
                    toast.error('Failed to connect to notifications: ' + error.message);
                }
            };

            connectWebSocket();

            // Monitor connection status periodically
            const connectionMonitor = setInterval(() => {
                const status = websocketService.getStatus();
                console.log('📡 WebSocket Status:', status);
                setWsConnected(status.isConnected && status.isAuthenticated);
            }, 5000);

            return () => {
                console.log('🧹 Cleaning up inbox WebSocket...');
                clearInterval(connectionMonitor);

                // Remove all handlers
                websocketService.removeHandler('friend_request');
                websocketService.removeHandler('friend_request_sent');
                websocketService.removeHandler('friend_request_accepted');
                websocketService.removeHandler('friend_request_declined');
                websocketService.removeHandler('friend_added');
                websocketService.removeHandler('unfriended');
                websocketService.removeHandler('group_invite');
                websocketService.removeHandler('message');
                websocketService.removeHandler('auth_success');

                // Note: Don't disconnect the WebSocket completely as it might be used elsewhere
                // Only unsubscribe from notifications if that's the only use
                // websocketService.disconnect();
            };
        }
    }, [
        open,
        handleFriendRequest,
        handleFriendRequestSent,
        handleFriendRequestAccepted,
        handleFriendRequestDeclined,
        handleFriendAdded,
        handleUnfriended,
        handleGroupInvite,
        handleNewMessage
    ]);

    const handleSuccess = () => {
        onClose();
    };

    const handleMarkMessageAsRead = async (messageId) => {
        try {
            websocketService.send({
                type: 'read',
                message_id: messageId
            });

            setNewMessages(prev => {
                const currentMessages = Array.isArray(prev) ? prev : [];
                return currentMessages.filter(msg => msg.id !== messageId);
            });
        } catch (error) {
            console.error('Error marking message as read:', error);
        }
    };

    // Render friend requests
    const renderFriendRequests = () => {
        if (!Array.isArray(friendRequests)) {
            return (
                <Box sx={{ mb: 3, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                    <Typography color="error" sx={{ textAlign: 'center' }}>
                        Error loading friend requests
                    </Typography>
                </Box>
            );
        }

        if (loadingFriendRequests) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            );
        }

        if (friendRequests.length === 0) {
            return (
                <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    No pending friend requests
                </Typography>
            );
        }

        return (
            <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Friend Requests ({friendRequests.length})
                </Typography>
                <List sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
                    {friendRequests.map((request, index) => {
                        if (!request || typeof request !== 'object') {
                            return null;
                        }

                        const requestId = request.friend_request_id || request.requester_id || `request-${index}`;
                        const requesterName = request.requester_username || 'Unknown User';

                        return (
                            <div key={requestId}>
                                <ListItem>
                                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                        {request.requester_avatar_url ? (
                                            <Avatar
                                                src={request.requester_avatar_url}
                                                sx={{ mr: 2, width: 40, height: 40 }}
                                            />
                                        ) : (
                                            <Avatar sx={{ mr: 2, width: 40, height: 40 }}>
                                                {requesterName.charAt(0).toUpperCase()}
                                            </Avatar>
                                        )}
                                        <ListItemText
                                            primary={requesterName}
                                            secondary={
                                                <Box>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Wants to be your friend
                                                    </Typography>
                                                    {request.created_at && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {formatCambodiaTime(request.created_at)}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                                        <Button
                                            startIcon={<CheckCircleIcon />}
                                            onClick={() => handleAcceptFriendRequest(request.requester_id, request.friend_request_id)}
                                            size="small"
                                            color="success"
                                            variant="contained"
                                        >
                                            Accept
                                        </Button>
                                        <Button
                                            startIcon={<DeleteIcon />}
                                            onClick={() => handleDeclineFriendRequest(request.requester_id, request.friend_request_id)}
                                            size="small"
                                            color="error"
                                            variant="outlined"
                                        >
                                            Decline
                                        </Button>
                                    </Box>
                                </ListItem>
                                {index < friendRequests.length - 1 && <Divider />}
                            </div>
                        );
                    })}
                </List>
            </Box>
        );
    };

    // Render new messages
    const renderNewMessages = () => {
        if (newMessages.length === 0) return null;

        return (
            <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    New Messages ({newMessages.length})
                </Typography>
                <List sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
                    {newMessages.map((message, index) => (
                        <div key={message.id || index}>
                            <ListItem
                                button
                                onClick={() => handleMarkMessageAsRead(message.id)}
                            >
                                <ListItemText
                                    primary={message.sender_username || 'Unknown'}
                                    secondary={
                                        <Box>
                                            <Typography variant="body2" color="text.secondary">
                                                {message.content && message.content.length > 50
                                                    ? `${message.content.substring(0, 50)}...`
                                                    : message.content || "No content"}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatCambodiaTime(message.created_at)}
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </ListItem>
                            {index < newMessages.length - 1 && <Divider />}
                        </div>
                    ))}
                </List>
            </Box>
        );
    };

    return (
        <>
            <DeleteDialog
                open={deletePopup}
                onClose={() => setDeletePopup(false)}
                onSuccess={handleSuccess}
                title="Delete invite"
                description="Are you sure want to delete invite?"
                onConfirm={handleDeleteInvite}
            />

            <Modal
                open={open}
                onClose={onClose}
                aria-labelledby="inbox-modal-title"
                aria-describedby="inbox-modal-description"
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: { xs: '90%', md: 800 },
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        boxShadow: 24,
                        p: 3,
                        maxHeight: '80vh',
                        overflow: 'auto',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography id="inbox-modal-title" variant="h6" gutterBottom sx={{ flexGrow: 1 }}>
                            Inbox
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: wsConnected ? 'success.main' : 'error.main'
                            }} />
                            <Typography variant="caption" color="text.secondary">
                                {wsConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
                            </Typography>
                        </Box>
                    </Box>

                    {renderFriendRequests()}
                    {renderNewMessages()}

                    {/* Group Invites Section */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            Pending Group Invites ({invites.length})
                        </Typography>

                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                <CircularProgress />
                            </Box>
                        ) : invites.length === 0 ? (
                            <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                                No pending group invites
                            </Typography>
                        ) : (
                            <List>
                                {invites.map((invite, index) => {
                                    const expiresAt = new Date(invite.expires_at).getTime();
                                    const now = Date.now();
                                    const timeDiffMs = expiresAt - now;
                                    const fiveMinutesMs = 5 * 60 * 1000;
                                    const isExpiringSoon = timeDiffMs > 0 && timeDiffMs <= fiveMinutesMs;
                                    const isExpired = timeDiffMs <= 0;

                                    return (
                                        <div key={invite.id}>
                                            <ListItem>
                                                <ListItemText
                                                    primary={`${invite.group?.name || 'Unknown Group'}`}
                                                    secondary={`Invited by ${invite.inviter?.username || 'Unknown User'} • Status: ${invite.status || 'pending'}`}
                                                />
                                                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 150 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Created: {formatCambodiaTime(invite.created_at)}
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        color={isExpired ? "error.main" : isExpiringSoon ? "warning.main" : "text.secondary"}
                                                    >
                                                        {isExpired
                                                            ? "Expired"
                                                            : isExpiringSoon
                                                                ? "Expires in 5 minutes"
                                                                : `Expires: ${formatCambodiaTime(invite.expires_at)}`}
                                                    </Typography>
                                                </Box>

                                                <Button
                                                    startIcon={<CheckCircleIcon />}
                                                    onClick={() => handleAcceptInvite(invite.id)}
                                                    disabled={isExpired || invite.status !== "pending" || processingInviteId === invite.id}
                                                    sx={{ color: 'green', marginLeft: 2 }}
                                                    size="small"
                                                >
                                                    {processingInviteId === invite.id ? 'Accepting...' : 'Accept'}
                                                </Button>

                                                <Button
                                                    startIcon={<DeleteIcon />}
                                                    onClick={() => {
                                                        setInviteId(invite.id);
                                                        setDeletePopup(true);
                                                    }}
                                                    sx={{ color: 'red', marginLeft: 1 }}
                                                    size="small"
                                                >
                                                    Delete
                                                </Button>
                                            </ListItem>
                                            {index < invites.length - 1 && <Divider />}
                                        </div>
                                    );
                                })}
                            </List>
                        )}
                    </Box>

                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 1,
                        mt: 2,
                        pt: 2,
                        borderTop: 1,
                        borderColor: 'divider'
                    }}>
                        <Button variant="outlined" onClick={onClose}>
                            Close
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => {
                                fetchInvites();
                                fetchFriendRequests();
                                toast.info("Inbox refreshed");
                            }}
                        >
                            Refresh
                        </Button>
                    </Box>
                </Box>
            </Modal>
        </>
    );
}