import { useState, useEffect, forwardRef, useMemo } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  List,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  Divider,
  Slide,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Checkbox,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from '@mui/icons-material/Delete';
import { acceptFriendRequest, acceptGroupInvite, deleteActivities, getActivityInbox, readActivity } from "../../services/api";
import { toast } from 'react-toastify';

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function InboxComponent({ open, onClose }) {
  const [filter, setFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, activity: null });
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [deletePopup, setDeletePopup] = useState(false);
  const [activities, setActivities] = useState([]);

  const fetchData = async () => {
    const acRes = await getActivityInbox();
    setActivities(acRes);
  }

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const handleFilterChange = (event, newFilter) => {
    if (newFilter !== null) {
      setFilter(newFilter);
    }
  };

  const handleSelectToggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredActivities = useMemo(() => {
    if (filter === "unread") return activities.filter(a => !a.is_read);
    if (filter === "read") return activities.filter(a => a.is_read);
    return activities;
  }, [activities, filter]);

  const handleAccept = async (activity) => {
    try {
      if (activity.type === "friend_request") {
        await acceptFriendRequest(activity.actor.id);
        toast.success("Friend request has been accepted");
      } else if (activity.type === "group_invite") {
        await acceptGroupInvite(activity.group_id);
        toast.success("Invite has been accepted");
      }

      handleReadActivity(activity.id);
      setActivities(prevActivities =>
        prevActivities.map(a =>
          a.id === activity.id ? { ...a, is_read: true, accepted: true } : a
        )
      );

      handleCloseDialog();
    } catch (err) {
      console.error(err);
      toast.error(`Failed: ${err.message}`);
      handleCloseDialog();
    }
  };

  const handleDeleteSelected = async () => {
    try {
      await deleteActivities({ ids: selectedIds });

      setActivities(prevActivities =>
        prevActivities.filter(activity => !selectedIds.includes(activity.id))
      );
      setSelectedIds([]);
      setDeletePopup(false);
    } catch (err) {
      console.error(err);
      toast.error(`Failed ${err.message}`);
      setDeletePopup(false);
    }
  };

  const handleReadActivity = async (activityId)=> {
    await readActivity(activityId);
  }

  const unreadCount = useMemo(
    () => activities.filter(a => !a.is_read).length,
    [activities]
  );

  const readCount = useMemo(
    () => activities.filter(a => a.is_read).length,
    [activities]
  );

  const handleCloseDialog = () => setConfirmDialog({ open: false, activity: null });

  return (
    <>
      <Dialog fullScreen open={open} onClose={onClose} TransitionComponent={Transition}>
        {/* AppBar */}
        <AppBar sx={{ position: "relative" }}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={onClose}>
              <CloseIcon />
            </IconButton>

            <Typography sx={{ ml: 2, flex: 1 }} variant="h6">
              Inbox
            </Typography>

            {selectedIds.length > 0 && (
              <Button color="inherit" onClick={() => setDeletePopup(true)}
                startIcon={<DeleteIcon />}
              >
                <Typography
                  sx={{ mt: 0.5 }}
                >
                  Delete ({selectedIds.length})
                </Typography>
              </Button>
            )}
          </Toolbar>
        </AppBar>

        {/* Filter */}
        <Box >
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={handleFilterChange}
            size="small"
            fullWidth
          >
            <ToggleButton value="all">All ({activities.length})</ToggleButton>
            <ToggleButton value="unread">Unread ({unreadCount})</ToggleButton>
            <ToggleButton value="read">Read ({readCount})</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Activity List */}
        <List disablePadding>
          {filteredActivities.map((activity, index) => (
            <Box key={activity.id}>
              <ListItemButton
                alignItems="flex-start"
                sx={{
                  px: 2,
                  py: 1.5,
                  backgroundColor: activity.is_read ? "transparent" : "rgba(0,128,255,0.08)",
                }}
              >
                <Checkbox
                  checked={selectedIds.includes(activity.id)}
                  onChange={() => handleSelectToggle(activity.id)}
                  sx={{
                    mt: 0.5
                  }}
                />

                <ListItemAvatar>
                  <Avatar src={activity.actor.avatar_url}>
                    {activity.actor.username?.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>

                <Box sx={{ flex: 1, ml: 1, mt: 0.75 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography component="span" fontWeight={activity.is_read ? 500 : 700} noWrap>
                      {activity.actor.username}
                    </Typography>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {new Date(activity.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography component="span" variant="body2" color="text.secondary" noWrap>
                      {activity.extra_data}
                    </Typography>

                    {(activity.type === "friend_request" || activity.type === "group_invite") && (
                      <Button size="small" variant="contained"
                        onClick={() => {
                          setSelectedActivity(activity);
                          setConfirmDialog({ open: true, activity: activity })
                        }}
                        disabled={activity.is_read === true}
                      >
                        Accept
                      </Button>
                    )}
                  </Box>
                </Box>


              </ListItemButton>

              {index < filteredActivities.length - 1 && <Divider />}
            </Box>
          ))}
        </List>

        <Dialog open={confirmDialog.open} onClose={handleCloseDialog}>
          <DialogTitle>Confirm Accept</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to accept this {confirmDialog.activity?.type.replace("_", " ")}?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={() => handleAccept(selectedActivity)} autoFocus>
              Accept
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deletePopup} onClose={() => { setDeletePopup(false) }}>
          <DialogTitle>Confirm delete</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete selected activities?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setDeletePopup(false) }}>Cancel</Button>
            <Button onClick={() => handleDeleteSelected()} autoFocus>
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Dialog>
    </>
  );
}

export default InboxComponent;
