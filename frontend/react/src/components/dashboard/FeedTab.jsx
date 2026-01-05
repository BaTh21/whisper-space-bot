import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Modal,
  Snackbar,
  TextField,
  Typography,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteDiaryById, getFeed } from '../../services/api';
import { MediaPlayer } from '../diary/MediaPlayer';
import ActivityComponent from '../diary/ActivityComponent';
import SuggestFriendComponent from '../diary/SuggestFriendComponent';
import { useAuth } from '../../context/AuthContext';
import CreateDiaryComponent from '../diary/CreateDiaryComponent';
import NorthIcon from '@mui/icons-material/North';
import GroupIcon from "@mui/icons-material/Group";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import MenuBookIcon from '@mui/icons-material/MenuBook';
import GroupDiaryComponent from '../diary/GroupDiaryComponent';
import ProfileDiary from '../diary/ProfileDiary';

const FeedTab = ({ diaries: initialDiaries, onDataUpdate, profile, groups, friends = [], setError, setSuccess, pendingRequests = [] }) => {
  const { auth } = useAuth();
  const user = auth?.user;

  const [diaries, setDiaries] = useState(initialDiaries || []);
  const [offset, setOffset] = useState(initialDiaries?.length || 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 25;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [diaryToDelete, setDiaryToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedDiaryForMenu, setSelectedDiaryForMenu] = useState(null);
  const menuOpen = Boolean(menuAnchorEl);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState('');
  const [selectedThumbnail, setSelectedThumbnail] = useState('');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [selectedMediaType, setSelectedMediaType] = useState('image');
  const [currentMediaList, setCurrentMediaList] = useState([]);
  const [search, setSearch] = useState("");
  const { t } = useTranslation();

  const scrollRef = useRef(null);
  const [visible, setVisible] = useState(false);

  const [type, setType] = useState("diary");

  const handleChange = (event, newType) => {
    if (newType !== null) {
      setType(newType);
    }
  };

  const scrollToTop = () => {
    scrollRef.current.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const loadMoreDiaries = useCallback(async (reset = false) => {
    if (!hasMore && !reset || loadingMore) return;

    try {
      setLoadingMore(true);
      const currentOffset = reset ? 0 : offset;
      const newDiaries = await getFeed(LIMIT, currentOffset);

      if (reset) {
        setDiaries(newDiaries);
        setOffset(newDiaries.length);
        setHasMore(newDiaries.length === LIMIT);
      } else {
        setDiaries(prev => {
          const allDiaries = [...prev, ...newDiaries];
          // Remove duplicates by id
          const uniqueDiaries = Array.from(new Map(allDiaries.map(d => [d.id, d])).values());
          return uniqueDiaries;
        });
        setOffset(prev => prev + newDiaries.length);
        if (newDiaries.length < LIMIT) setHasMore(false);
      }
    } catch (err) {
      setError(err.message || "Failed to load more diaries");
    } finally {
      setLoadingMore(false);
    }
  }, [offset, hasMore, loadingMore, setError]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      setVisible(el.scrollTop > 200);

      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        loadMoreDiaries();
      }
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMoreDiaries]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        loadMoreDiaries();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMoreDiaries]);

  // Normalize data
  const normalizedDiaries = diaries.map(diary => ({
    ...diary,
    groups: Array.isArray(diary?.groups) ? diary.groups : [],
    images: Array.isArray(diary?.images) ? diary.images : [],
    videos: Array.isArray(diary?.videos) ? diary.videos : [],
    video_thumbnails: Array.isArray(diary?.video_thumbnails) ? diary.video_thumbnails : [],
  }));

  const filteredDiaries = useMemo(() => {
    if (!search.trim()) return normalizedDiaries;

    const q = search.toLowerCase();

    return normalizedDiaries.filter(diary => {
      return (
        diary.title?.toLowerCase().includes(q) ||
        diary.content?.toLowerCase().includes(q) ||
        diary.author?.username?.toLowerCase().includes(q) ||
        diary.groups.some(g => g.name?.toLowerCase().includes(q))
      );
    });
  }, [search, normalizedDiaries]);

  const filteredDiariesWithVideos = useMemo(() => {
    return filteredDiaries.filter(diary => diary.videos && diary.videos.length > 0);
  }, [filteredDiaries]);

  // Show notification message
  const showMessage = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  const handleMediaViewerClose = () => {
    setMediaViewerOpen(false);
    setSelectedMedia('');
    setSelectedThumbnail('');
    setSelectedMediaIndex(0);
    setCurrentMediaList([]);
    setSelectedMediaType('image');
  };

  const handlePrevMedia = () => {
    const newIndex = selectedMediaIndex > 0 ? selectedMediaIndex - 1 : currentMediaList.length - 1;
    const media = currentMediaList[newIndex];
    setSelectedMedia(media.src);
    setSelectedMediaType(media.type);
    setSelectedThumbnail(media.thumbnail || '');
    setSelectedMediaIndex(newIndex);
  };

  const handleNextMedia = () => {
    const newIndex = selectedMediaIndex < currentMediaList.length - 1 ? selectedMediaIndex + 1 : 0;
    const media = currentMediaList[newIndex];
    setSelectedMedia(media.src);
    setSelectedMediaType(media.type);
    setSelectedThumbnail(media.thumbnail || '');
    setSelectedMediaIndex(newIndex);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedDiaryForMenu(null);
  };

  const handleEditDiaryClick = () => {
    if (selectedDiaryForMenu) handleEditClick(selectedDiaryForMenu);
    handleMenuClose();
  };

  const handleDeleteDiaryClick = () => {
    if (selectedDiaryForMenu) handleDeleteClick(selectedDiaryForMenu.id, selectedDiaryForMenu.title);
    handleMenuClose();
  };

  // Diary operations
  const handleDeleteClick = (diaryId, diaryTitle) => {
    setDiaryToDelete({ id: diaryId, title: diaryTitle });
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDiaryToDelete(null);
    setDeleteLoading(false);
  };

  const handleDeleteDiary = async () => {
    if (!diaryToDelete) return;

    setDeleteLoading(true);
    try {
      await deleteDiaryById(diaryToDelete.id);
      showMessage(t('diary_deleted'));
      handleDeleteCancel();
      if (onDataUpdate) onDataUpdate();
    } catch (err) {
      showMessage(err.message || t('failed_delete_diary'), 'error');
      setDeleteLoading(false);
    }
  };

  const handleNewDiary = () => {
    onDataUpdate();
  };

  useEffect(() => {
    setDiaries(initialDiaries);
  }, [initialDiaries]);

  return (
    <Box sx={{ maxWidth: '100%', overflow: 'hidden', display: 'flex', gap: 3 }}>
      <Box sx={{ width: '100%' }}>
        {/* Media Viewer */}
        <Modal open={mediaViewerOpen} onClose={handleMediaViewerClose} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}>
          <Box sx={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', outline: 'none' }}>
            <MediaPlayer url={selectedMedia} type={selectedMediaType} thumbnail={selectedThumbnail} onClose={handleMediaViewerClose} />
            {currentMediaList.length > 1 && (
              <>
                <IconButton onClick={handlePrevMedia} sx={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}><ArrowBackIcon /></IconButton>
                <IconButton onClick={handleNextMedia} sx={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}><ArrowForwardIcon /></IconButton>
                <Typography sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', bgcolor: 'rgba(0,0,0,0.5)', color: 'white', px: 2, py: 0.5, borderRadius: 2, fontSize: '0.875rem' }}>{selectedMediaIndex + 1} / {currentMediaList.length}</Typography>
              </>
            )}
            <IconButton onClick={handleMediaViewerClose} sx={{ position: 'absolute', top: 16, right: 16, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}><CloseIcon /></IconButton>
          </Box>
        </Modal>

        {/* Snackbar */}
        <Snackbar open={snackbarOpen} autoHideDuration={2000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
          <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert>
        </Snackbar>

        {/* Delete Diary Dialog */}
        <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
          <DialogTitle>{t('delete_title')}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t('delete_diary', { title: diaryToDelete?.title })}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} disabled={deleteLoading}>{t('cancel')}</Button>
            <Button onClick={handleDeleteDiary} color="error" variant="contained" disabled={deleteLoading} startIcon={deleteLoading ? <CircularProgress size={20} /> : <DeleteIcon />}>
              {deleteLoading ? t('deleting') : t('delete')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Menu */}
        <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={handleMenuClose}>
          <MenuItem onClick={handleEditDiaryClick}><EditIcon fontSize="small" sx={{ mr: 1 }} /> {t('edit')}</MenuItem>
          <MenuItem onClick={handleDeleteDiaryClick}><DeleteIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} /><Typography color="error">{t('delete')}</Typography></MenuItem>
        </Menu>

        {/* Feed */}
        <Box ref={scrollRef} sx={{ maxHeight: '90vh', overflowY: 'auto', width: { xs: '92vw', md: '63vw' }, mx: 'auto' }}>
          <CreateDiaryComponent groups={groups} user={user} onSuccess={handleNewDiary} setError={setError} />

          {/* Search and Toggle */}
          <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 2, pb: { xs: 3, md: 2 }, width: '100%', left: 0 }}>
            <TextField
              sx={{ width: { xs: '100%', md: "50%" } }}
              id="outlined-member-search"
              label="Search diary"
              variant="outlined"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {search && <IconButton size="small" onClick={() => setSearch("")} edge="end"><CloseIcon fontSize="small" /></IconButton>}
                    <IconButton size="small" edge="end"><SearchIcon /></IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <ToggleButtonGroup value={type} exclusive onChange={handleChange} aria-label="entry type" size="small" sx={{ borderBottom: 1, borderRadius: 0, borderColor: "divider" }}>
              {[
                { value: "diary", label: "All Diaries", icon: <MenuBookIcon sx={{ mr: { xs: 0, md: 1 }, mx: { xs: 1, md: 0 } }} /> },
                { value: "group", label: "Groups", icon: <GroupIcon sx={{ mr: { xs: 0, md: 1 }, mx: { xs: 1, md: 0 } }} /> },
                { value: "video", label: "Videos", icon: <VideoLibraryIcon sx={{ mr: { xs: 0, md: 1 }, mx: { xs: 1, md: 0 } }} /> },
              ].map((item) => (
                <ToggleButton key={item.value} value={item.value} aria-label={item.value} sx={{
                  border: "none", borderRadius: 0, px: { xs: 0, md: 2 }, color: "text.secondary",
                  "&.Mui-selected": { color: "primary.main", backgroundColor: "transparent", borderBottom: 3 },
                  "&.Mui-selected:hover": { backgroundColor: "transparent" },
                  "&:hover": { backgroundColor: "action.hover" },
                }}>
                  {item.icon}
                  <Typography sx={{ display: { xs: 'none', md: 'block' } }}>{item.label}</Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Button onClick={scrollToTop} sx={{ position: "absolute", bottom: 20, right: { xs: 20, md: 250, lg: 350 }, fontSize: "16px", borderRadius: "50%", border: "none", color: "white", backgroundColor: '#254D70', cursor: "pointer", display: visible ? "flex" : "none", zIndex: 1300, minWidth: 0, width: 45, height: 45 }}><NorthIcon /></Button>

          {type === 'diary' && <ProfileDiary diaries={filteredDiaries} onDataUpdate={handleNewDiary} profile={profile} friends={friends} />}
          {type === 'group' && <GroupDiaryComponent groups={groups} profile={profile} setError={setError} setSuccess={setSuccess} onDataUpdate={onDataUpdate} friends={friends} pendingRequests={pendingRequests} search={search} />}
          {type === 'video' && <ProfileDiary diaries={filteredDiariesWithVideos} onDataUpdate={handleNewDiary} profile={profile} friends={friends} />}
        </Box>
      </Box>

      <Box sx={{ mb: 2, width: { xs: '100%' }, display: { xs: 'none', md: 'block' }, mt: 2, maxWidth: 300 }}>
        <ActivityComponent />
        <br />
        <SuggestFriendComponent />
      </Box>
    </Box>
  );
};

export default FeedTab;
