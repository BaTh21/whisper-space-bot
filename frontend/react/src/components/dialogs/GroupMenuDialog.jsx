import { useState } from 'react';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import EditIcon from '@mui/icons-material/Edit';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { leaveGroupById } from '../../services/api';
import UpdateGroupDialog from './UpdateGroupDialog';
import ReplyAllIcon from '@mui/icons-material/ReplyAll';
import InviteMemberComponent from './InviteMemberComponent';

function GroupMenuDialog({ open, onClose, group, onSuccess }) {
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [updatePopup, setUpdatePopup] = useState(false);
    const [invitePopup, setInvitePopup] = useState(false);

    const handleListItemClick = (event, index, action) => {
        setSelectedIndex(index);
        action?.();
        onClose();
    };

    const handleLeaveGroup = async () => {
        try {
            await leaveGroupById(group.id);
            onSuccess();
        } catch (error) {
            console.log("Failed to leave group", error);
        }
    };

    const handleEditGroup = () => {
        setUpdatePopup(true);
    };

    const handleInviteMember = ()=>{
        setInvitePopup(true);
    }
    return (
        <>
            <Modal
                open={open}
                onClose={onClose}
                aria-labelledby="group-menu-modal-title"
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 300,
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        boxShadow: 24,
                        p: 2,
                    }}
                >
                    <List component="nav" aria-label="group actions">
                        <ListItemButton
                            selected={selectedIndex === 0}
                            onClick={(event) =>
                                handleListItemClick(event, 0, handleEditGroup)
                            }
                        >
                            <ListItemIcon>
                                <EditIcon color="primary" />
                            </ListItemIcon>
                            <ListItemText primary="Edit Group" />
                        </ListItemButton>

                        <Divider />

                        <ListItemButton
                            selected={selectedIndex === 0}
                            onClick={(event) =>
                                handleListItemClick(event, 0, handleInviteMember)
                            }
                        >
                            <ListItemIcon>
                                <ReplyAllIcon color="primary" />
                            </ListItemIcon>
                            <ListItemText primary="Invite member" />
                        </ListItemButton>

                        <Divider />

                        <ListItemButton
                            selected={selectedIndex === 1}
                            onClick={(event) => {
                                handleListItemClick(event, 1);
                                handleLeaveGroup();
                            }}
                        >
                            <ListItemIcon>
                                <ExitToAppIcon color="error" />
                            </ListItemIcon>
                            <ListItemText primary="Leave Group" />
                        </ListItemButton>
                    </List>
                </Box>
            </Modal>

            <UpdateGroupDialog
                open={updatePopup}
                onClose={() => setUpdatePopup(false)}
                onSuccess={onSuccess}
                group={group}
            />

            <InviteMemberComponent
                open={invitePopup}
                onClose={() => setInvitePopup(false)}
                onSuccess={onSuccess}
                group={group}
            />
        </>
    );
}

export default GroupMenuDialog;
