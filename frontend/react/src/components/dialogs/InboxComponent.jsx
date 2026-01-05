import { useState, useEffect, forwardRef, useMemo, useRef } from "react";
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
import { useTranslation } from 'react-i18next'; 
import { acceptFriendRequest, acceptGroupInvite, deleteActivities, getActivityInbox, readActivity } from "../../services/api";
import { toast } from 'react-toastify';

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function InboxComponent({ open, onClose }) {
  const { t } = useTranslation();

  const [filter, setFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, activity: null });
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [deletePopup, setDeletePopup] = useState(false);
  const [activities, setActivities] = useState([]);

  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [activities, offset]);

  useEffect(() => {
    if (!open) return;

    setActivities([]);
    setOffset(0);
    setHasMore(true);
    setLoading(false);

    fetchData(20, 0);
  }, [open]);

  const fetchData = async (newLimit = limit, newOffset = offset) => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const acRes = await getActivityInbox(newLimit, newOffset);

      setActivities(prev => [...prev, ...acRes]);
      setOffset(prev => prev + acRes.length);
      setHasMore(acRes.length === newLimit);

      acRes.forEach(a => {
        if (!a.is_read && a.type !== "friend_request" && a.type !== "group_invite") {
          handleReadActivity(a.id);
        }
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleAccept = async (activity) => {
    try {
      if (activity.type === "friend_request") {
        await acceptFriendRequest(activity.actor.id);
        toast.success(t('accept_success_friend'));
      } else if (activity.type === "group_invite") {
        await acceptGroupInvite(activity.group_id);
        toast.success(t('accept_success_group'));
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
      toast.error(t('accept_failed', { message: err.message || 'Unknown error' }));
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
      toast.success(t('delete_success')); 
    } catch (err) {
      console.error(err);
      toast.error(t('delete_failed', { message: err.message }));
      setDeletePopup(false);
    }
  };

  const handleReadActivity = async (activityId) => {
    try {
      await readActivity(activityId);
      setActivities(prev =>
        prev.map(a => (a.id === activityId ? { ...a, is_read: true } : a))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      fetchData(limit, offset);
    }
  };

  const filteredActivities = useMemo(() => {
    if (filter === "unread") return activities.filter(a => !a.is_read);
    if (filter === "read") return activities.filter(a => a.is_read);
    return activities;
  }, [activities, filter]);

  const unreadCount = useMemo(() => activities.filter(a => !a.is_read).length, [activities]);
  const readCount = useMemo(() => activities.filter(a => a.is_read).length, [activities]);

  const handleCloseDialog = () => setConfirmDialog({ open: false, activity: null });

  return (
    <>
      <Dialog fullScreen open={open} onClose={onClose} TransitionComponent={Transition}>
        <AppBar sx={{ position: "relative" }}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={onClose}>
              <CloseIcon />
            </IconButton>

            <Typography sx={{ ml: 2, flex: 1 }} variant="h6">
              {t('inbox')}
            </Typography>

            {selectedIds.length > 0 && (
              <Button color="inherit" onClick={() => setDeletePopup(true)} startIcon={<DeleteIcon />}>
                <Typography sx={{ mt: 0.5 }}>
                  {t('delete_selected', { count: selectedIds.length })}
                </Typography>
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <Box>
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={handleFilterChange}
            size="small"
            fullWidth
          >
            <ToggleButton value="all">{t('all')} ({activities.length})</ToggleButton>
            <ToggleButton value="unread">{t('unread')} ({unreadCount})</ToggleButton>
            <ToggleButton value="read">{t('read')} ({readCount})</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box
          ref={scrollRef}
          sx={{ overflowY: "auto", height: "calc(100vh - 112px)" }}
        >
          <List disablePadding>
            {filteredActivities.length === 0 ? (
              <Typography sx={{ p: 2, textAlign: 'center' }}>
                {t('no_activity_found')}
              </Typography>
            ) : (
              filteredActivities.map((activity, index) => (
                <Box key={activity.id}>
                  <ListItemButton
                    alignItems="flex-start"
                    sx={{
                      px: 2,
                      py: 1.5,
                      backgroundColor: activity.is_read ? "grey.50" : "rgba(0,128,255,0.08)",
                    }}
                  >
                    <Checkbox
                      checked={selectedIds.includes(activity.id)}
                      onChange={() => handleSelectToggle(activity.id)}
                      sx={{ mt: 0.5 }}
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
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              setSelectedActivity(activity);
                              setConfirmDialog({ open: true, activity });
                            }}
                            disabled={activity.is_read}
                          >
                            {t('accept')}
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </ListItemButton>

                  {index < filteredActivities.length - 1 && <Divider />}
                </Box>
              ))
            )}
            {loading && <Typography sx={{ p: 2 }}>{t('loading')}</Typography>}
          </List>
        </Box>

        <Dialog open={confirmDialog.open} onClose={handleCloseDialog}>
          <DialogTitle>{t('confirm_accept')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('confirm_accept_message', {
                type: t(confirmDialog.activity?.type === 'friend_request' ? 'friend_request' : 'group_invite')
              })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>{t('cancel')}</Button>
            <Button onClick={() => handleAccept(selectedActivity)} autoFocus>
              {t('accept')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deletePopup} onClose={() => setDeletePopup(false)}>
          <DialogTitle>{t('confirm_delete')}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t('confirm_delete_message')}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeletePopup(false)}>{t('cancel')}</Button>
            <Button onClick={handleDeleteSelected} color="error" autoFocus>
              {t('confirm')}
            </Button>
          </DialogActions>
        </Dialog>
      </Dialog>
    </>
  );
}

export default InboxComponent;