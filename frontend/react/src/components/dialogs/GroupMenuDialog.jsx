import { useEffect, useState } from 'react';
import {
  Box,
  Modal,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Typography,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplyAllIcon from '@mui/icons-material/ReplyAll';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { leaveGroupById, uploadCover, getGroupCover, deleteCoverById } from '../../services/api';
import UpdateGroupDialog from './UpdateGroupDialog';
import InviteMemberComponent from './InviteMemberComponent';
import { toast } from 'react-toastify';

function GroupMenuDialog({ open, onClose, group, onSuccess }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [updatePopup, setUpdatePopup] = useState(false);
  const [invitePopup, setInvitePopup] = useState(false);
  const [covers, setCovers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch group covers
  useEffect(() => {
    if (open && group?.id) {
      fetchCovers();
    }
  }, [open, group?.id]);

  const fetchCovers = async () => {
    try {
      const data = await getGroupCover(group.id);
      setCovers(Array.isArray(data) ? data.reverse() : []);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to fetch covers:', error);
    }
  };

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
      console.error('Failed to leave group', error);
    }
  };

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setCovers((prev) => [{ url: previewUrl, uploading: true }, ...prev]);
    setCurrentIndex(0);
    setLoading(true);

    try {
      await uploadCover(group.id, file);
      toast.success('Group cover uploaded!');
      await fetchCovers();
      onSuccess?.();
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload cover');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCover = async (coverId) => {
    if (!coverId) return;
    setLoading(true);
    try {
      await deleteCoverById(coverId);
      toast.success('Cover deleted!');
      await fetchCovers();
      onSuccess?.();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete cover');
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    if (covers.length > 0) setCurrentIndex((prev) => (prev + 1) % covers.length);
  };

  const prevSlide = () => {
    if (covers.length > 0) setCurrentIndex((prev) => (prev - 1 + covers.length) % covers.length);
  };

  const currentCover = covers[currentIndex];

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 380,
            bgcolor: 'background.paper',
            borderRadius: 3,
            boxShadow: 24,
            p: 3,
          }}
        >
          <List component="nav">
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: 180,
                borderRadius: 2,
                overflow: 'hidden',
                mb: 1.5,
                bgcolor: 'grey.100',
              }}
            >
              {covers.length > 0 ? (
                <>
                  <img
                    key={currentCover?.id}
                    src={currentCover?.url}
                    alt="group cover"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: 8,
                      transition: 'transform 0.5s ease, opacity 0.5s ease',
                    }}
                  />

                  {/* Hover Overlay */}
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.45)',
                      opacity: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 1,
                      borderRadius: 2,
                      transition: 'opacity 0.3s ease',
                      '&:hover': { opacity: 1 },
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={30} sx={{ color: 'white' }} />
                    ) : (
                      <>
                        <Tooltip title="Upload cover" arrow>
                          <IconButton
                            sx={{ color: 'white' }}
                            onClick={() => document.getElementById('coverUploadInput').click()}
                          >
                            <CloudUploadIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete cover" arrow>
                          <IconButton
                            sx={{ color: 'white' }}
                            onClick={() => handleDeleteCover(currentCover?.id)}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Box>

                  {/* Navigation buttons (always visible) */}
                  {covers.length > 1 && (
                    <>
                      <IconButton
                        onClick={prevSlide}
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: 8,
                          color: 'white',
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.6)' },
                          transform: 'translateY(-50%)',
                        }}
                      >
                        <ArrowBackIosNewIcon fontSize="small" />
                      </IconButton>

                      <IconButton
                        onClick={nextSlide}
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          right: 8,
                          color: 'white',
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.6)' },
                          transform: 'translateY(-50%)',
                        }}
                      >
                        <ArrowForwardIosIcon fontSize="small" />
                      </IconButton>

                      {/* Slide counter */}
                      <Typography
                        variant="caption"
                        sx={{
                          position: 'absolute',
                          bottom: 6,
                          right: 10,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          color: 'white',
                          px: 1,
                          py: 0.2,
                          borderRadius: 1,
                          fontSize: 12,
                        }}
                      >
                        {currentIndex + 1} / {covers.length}
                      </Typography>
                    </>
                  )}
                </>
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    color: 'text.secondary',
                  }}
                >
                  <Typography variant="body2">No covers yet</Typography>
                  <Tooltip title="Upload cover" arrow>
                    <IconButton
                      onClick={() => document.getElementById('coverUploadInput').click()}
                      sx={{ color: 'primary.main' }}
                    >
                      <CloudUploadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}

              <input
                id="coverUploadInput"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleCoverUpload}
              />
            </Box>

            {/* Group name */}
            <Typography
              variant="h6"
              align="center"
              sx={{ fontWeight: 600, mb: 1 }}
            >
              {group.name}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            {/* Menu options */}
            <ListItemButton
              onClick={(e) => handleListItemClick(e, 0, () => setUpdatePopup(true))}
            >
              <ListItemIcon>
                <EditIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="Edit Group" />
            </ListItemButton>

            <ListItemButton
              onClick={(e) => handleListItemClick(e, 1, () => setInvitePopup(true))}
            >
              <ListItemIcon>
                <ReplyAllIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="Invite Member" />
            </ListItemButton>

            <Divider sx={{ my: 1.5 }} />

            <ListItemButton
              onClick={(e) => {
                handleListItemClick(e, 2);
                handleLeaveGroup();
              }}
              sx={{
                '&:hover': { bgcolor: 'error.light' },
              }}
            >
              <ListItemIcon>
                <ExitToAppIcon color="error" />
              </ListItemIcon>
              <ListItemText
                primary="Leave Group"
                sx={{ color: 'error.main' }}
              />
            </ListItemButton>
          </List>
        </Box>
      </Modal>

      {/* Subdialogs */}
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
