import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Button from '@mui/material/Button';
import { getUserInvites } from '../../services/api';
import { useState } from 'react';

export default function InboxComponent({open, onClose, onSuccess}) {
    const [invites, setInvites] = useState();

    const fetchInvite = async ()=> {

    }

    return (
        <div>
            <Modal
                open={open}
                onClose={onClose}
                aria-labelledby="parent-modal-title"
                aria-describedby="parent-modal-description"
            >
                <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 400,
                    bgcolor: 'background.paper',
                    border: '2px solid #000',
                    boxShadow: 24,
                    pt: 2,
                    px: 4,
                    pb: 3
                }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                        <Button variant="outlined" onClick={onClose}>Cancel</Button>
                        <Button variant="contained" color="error">Delete</Button>
                    </Box>
                </Box>
            </Modal>
        </div >
    );
}