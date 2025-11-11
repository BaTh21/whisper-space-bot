import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { getUserInvites, acceptInviteById, deleteInvite } from '../../services/api';
import { useEffect, useState } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { formatCambodiaTime } from '../../utils/dateUtils';
import { toast } from 'react-toastify';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteDialog from './DeleteDialog';

export default function InboxComponent({ open, onClose, onSuccess }) {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletePopup, setDeletePopup] = useState(false);
    const [inviteId, setInviteId] = useState(null);
    const [processingInviteId, setProcessingInviteId] = useState(null);

    const fetchInvites = async () => {
        try {
            setLoading(true);
            const res = await getUserInvites();
            setInvites(res);
            console.log("invites", res);
        } catch (error) {
            // console.error("Error fetching invites:", error);
            setInvites([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptInvite = async (inviteId) => {
        try {
            setProcessingInviteId(inviteId);
            await acceptInviteById(inviteId);
            toast.success("You have joined the group successfully!");
            fetchInvites();
        } catch (error) {
            toast.error(error.message || "Failed to accept invite");
        } finally {
            setProcessingInviteId(null);
        }
    }

    const handleDeleteInvite = async () => {
        try {
            await deleteInvite(inviteId);
            toast.success("Invite has been deleted");
            setDeletePopup(false);
            fetchInvites();
        } catch (error) {
            toast.error(error.message || "Failed to delete invite");
            console.error("Error delete invites:", error);
        }
    }

    useEffect(() => {
        if (open) fetchInvites();
    }, [open]);

    const handleSuccess = () => {
        onClose();
    }

    return (
        <>
            <DeleteDialog
                open={deletePopup}
                onClose={() => setDeletePopup(false)}
                onSuccess={handleSuccess}
                title="Delete invite"
                description="Are you sure want to delete invite"
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
                        width: 800,
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        boxShadow: 24,
                        p: 3,
                    }}
                >
                    <Typography id="inbox-modal-title" variant="h6" gutterBottom>
                        Pending Group Invites
                    </Typography>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                            <CircularProgress />
                        </Box>
                    ) : invites.length === 0 ? (
                        <Typography color="text.secondary">No pending invites.</Typography>
                    ) : (
                        <List>
                            {invites.map((invite) => {
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
                                                primary={`${invite.group.name}`}
                                                secondary={`Invited by ${invite.inviter.username} — status: ${invite.status}`}
                                            />
                                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
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
                                                sx={{ color: 'green', marginLeft: 10 }}
                                            >
                                                <Typography>Confirm</Typography>
                                            </Button>

                                            <Button
                                                startIcon={<DeleteIcon />}
                                                onClick={() => {
                                                    setInviteId(invite.id);
                                                    setDeletePopup(true);
                                                }}
                                                sx={{ color: 'red', marginLeft: 1 }}
                                            >
                                                <Typography>Delete</Typography>
                                            </Button>

                                        </ListItem>
                                        <Divider />
                                    </div>
                                );
                            })}
                        </List>

                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                        <Button variant="outlined" onClick={onClose}>Close</Button>
                        <Button variant="contained" color="error" onClick={onSuccess}>
                            Delete
                        </Button>
                    </Box>
                </Box>

            </Modal>
        </>
    );
}
