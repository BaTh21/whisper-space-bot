// dashboard/NotesTab.jsx
import { Add as AddIcon, Group as GroupIcon, Notes as NotesIcon } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Fab,
  Grid,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  createNote, deleteNote, getNotes,
  getSharedNotes,
  shareNote,
  toggleArchiveNote, togglePinNote, updateNote
} from '../../services/api';
import NoteCard from '../notes/NoteCard';
import NoteEditor from '../notes/NoteEditor';
import ShareDialog from '../ShareDialog';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`notes-tabpanel-${index}`}
      aria-labelledby={`notes-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const NotesTab = ({ setError, setSuccess }) => {
  const [notes, setNotes] = useState([]);
  const [sharedNotes, setSharedNotes] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [editingNote, setEditingNote] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharingNote, setSharingNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const { t, i18n } = useTranslation();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Get current user from auth context
  const { auth } = useAuth();
  const currentUser = auth.user;

  useEffect(() => {
    loadNotes();
  }, [activeTab]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      if (activeTab === 2) {
        const data = await getSharedNotes();
        setSharedNotes(Array.isArray(data) ? data : []);
      } else {
        const archived = activeTab === 1;
        const data = await getNotes(archived);
        setNotes(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      showTimedAlert('error', error.message || t('loading_notes'));
      setNotes([]);
      setSharedNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const showTimedAlert = (type, message, duration = 3000) => {
    if (type === 'success') {
      setSuccess(message);
      setTimeout(() => setSuccess(''), duration);
    } else {
      setError(message);
      setTimeout(() => setError(''), duration);
    }
  };

  const handleSaveNote = async (noteData) => {
    try {
      let result;
      if (editingNote) {
        result = await updateNote(editingNote.id, noteData);
        showTimedAlert('success', t('note_updated') || 'Note updated successfully');
      } else {
        result = await createNote(noteData);
        showTimedAlert('success', t('note_created') || 'Note created successfully');
      }
      
      setIsEditorOpen(false);
      setEditingNote(null);
      loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      showTimedAlert('error', error.message || t('failed_to_save_note') || 'Failed to save note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteNote(noteId);
      showTimedAlert('success', t('note_deleted') || 'Note deleted successfully');
      loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      showTimedAlert('error', error.message || t('failed_to_delete_note') || 'Failed to delete note');
    }
  };

  const handleTogglePin = async (noteId) => {
    try {
      await togglePinNote(noteId);
      showTimedAlert('success', t('pin_status_updated') || 'Note pin status updated');
      loadNotes();
    } catch (error) {
      console.error('Error toggling pin:', error);
      showTimedAlert('error', error.message || t('failed_to_toggle_pin') || 'Failed to toggle pin');
    }
  };

  const handleToggleArchive = async (noteId) => {
    try {
      await toggleArchiveNote(noteId);
      const action = activeTab === 0 ? t('archived') : t('unarchived') || 'unarchived';
      showTimedAlert('success', `${t('note')} ${action} ${t('successfully')}` || `Note ${action} successfully`);
      loadNotes();
    } catch (error) {
      console.error('Error toggling archive:', error);
      showTimedAlert('error', error.message || t('failed_to_toggle_archive') || 'Failed to toggle archive');
    }
  };

  const handleShareNote = (note) => {
    setSharingNote(note);
    setShareDialogOpen(true);
  };

  const handleShare = async (shareData) => {
    if (!sharingNote) {
      showTimedAlert('error', t('no_note_selected') || 'No note selected for sharing');
      return;
    }

    try {
      await shareNote(sharingNote.id, shareData);
      
      let successMessage = t('sharing_updated') || 'Sharing settings updated';
      if (shareData.share_type === 'public') {
        successMessage = t('note_now_public') || 'Note is now public';
      } else if (shareData.share_type === 'shared') {
        const count = shareData.friend_ids.length;
        successMessage = count === 1 
          ? t('note_shared_singular') || `Note shared with 1 friend`
          : t('note_shared_plural') || `Note shared with ${count} friends`;
      } else {
        successMessage = t('note_now_private') || 'Note is now private';
      }
      
      showTimedAlert('success', successMessage);
      setShareDialogOpen(false);
      setSharingNote(null);
      loadNotes();
    } catch (error) {
      console.error('Error sharing note:', error);
      showTimedAlert('error', error.message || t('failed_to_share') || 'Failed to update sharing settings');
    }
  };

  const filteredNotes = notes.filter(note => {
    if (activeTab === 0) return !note.is_archived;
    if (activeTab === 1) return note.is_archived;
    return true;
  });

  const pinnedNotes = filteredNotes.filter(note => note.is_pinned);
  const otherNotes = filteredNotes.filter(note => !note.is_pinned);

  return (
    <Box sx={{ 
      position: 'relative', 
      minHeight: 400,
      p: { xs: 2, sm: 3 },
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      <Typography variant="h5" gutterBottom fontWeight="600">
        {t('my_notes')}
      </Typography>

      <Tabs 
        value={activeTab} 
        onChange={(e, newValue) => setActiveTab(newValue)} 
        sx={{ mb: 3 }}
        variant={isMobile ? "scrollable" : "standard"}
        scrollButtons={isMobile ? "auto" : false}
        allowScrollButtonsMobile
      >
        <Tab label={t('active_notes')} />
        <Tab label={t('archived')} />
        {/* <Tab label={t('shared_with_me')} /> */}
      </Tabs>

      {loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography>{t('loading_notes')}</Typography>
        </Box>
      )}

      {!loading && activeTab === 0 && (
        <>
          {pinnedNotes.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom color="text.secondary">
                {t('pinned')}
              </Typography>
              <Grid container spacing={2}>
                {pinnedNotes.map(note => (
                  <Grid item key={note.id} xs={12} sm={6} md={4} lg={3}>
                    <NoteCard
                      note={note}
                      onEdit={handleEditNote}
                      onDelete={handleDeleteNote}
                      onTogglePin={handleTogglePin}
                      onToggleArchive={handleToggleArchive}
                      onShare={handleShareNote}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {otherNotes.length > 0 && (
            <Box>
              {pinnedNotes.length > 0 && (
                <Typography variant="h6" gutterBottom color="text.secondary">
                  {t('others')}
                </Typography>
              )}
              <Grid container spacing={2}>
                {otherNotes.map(note => (
                  <Grid item key={note.id} xs={12} sm={6} md={4} lg={3}>
                    <NoteCard
                      note={note}
                      onEdit={handleEditNote}
                      onDelete={handleDeleteNote}
                      onTogglePin={handleTogglePin}
                      onToggleArchive={handleToggleArchive}
                      onShare={handleShareNote}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {filteredNotes.length === 0 && (
            <Card variant="outlined" sx={{ textAlign: 'center', py: 6 }}>
              <CardContent>
                <NotesIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {t('no_notes_yet')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('create_your_first_note')}
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!loading && activeTab === 1 && (
        <>
          {filteredNotes.length > 0 ? (
            <Grid container spacing={2}>
              {filteredNotes.map(note => (
                <Grid item key={note.id} xs={12} sm={6} md={4} lg={3}>
                  <NoteCard
                    note={note}
                    onEdit={handleEditNote}
                    onDelete={handleDeleteNote}
                    onTogglePin={handleTogglePin}
                    onToggleArchive={handleToggleArchive}
                    onShare={handleShareNote}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card variant="outlined" sx={{ textAlign: 'center', py: 6 }}>
              <CardContent>
                <NotesIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {t('no_archived_notes')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('archived_notes_will_appear_here')}
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!loading && activeTab === 2 && (
        <>
          {sharedNotes.length > 0 ? (
            <Grid container spacing={2}>
              {sharedNotes.map(note => (
                <Grid item key={note.id} xs={12} sm={6} md={4} lg={3}>
                  <NoteCard
                    note={note}
                    onEdit={handleEditNote}
                    onDelete={handleDeleteNote}
                    onTogglePin={handleTogglePin}
                    onToggleArchive={handleToggleArchive}
                    onShare={handleShareNote}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card variant="outlined" sx={{ textAlign: 'center', py: 6 }}>
              <CardContent>
                <GroupIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {t('no_shared_notes')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('notes_shared_with_you_will_appear_here')}
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Fab
        color="primary"
        aria-label={t('new')}
        sx={{
          position: 'fixed',
          bottom: { xs: 16, sm: 24 },
          right: { xs: 16, sm: 24 },
          transform: { xs: 'scale(0.9)', sm: 'scale(1)' }
        }}
        onClick={handleCreateNote}
        size={isMobile ? 'small' : 'large'}
      >
        <AddIcon />
      </Fab>

      <NoteEditor
        open={isEditorOpen}
        note={editingNote}
        onSave={handleSaveNote}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingNote(null);
        }}
      />

      <ShareDialog
        open={shareDialogOpen}
        note={sharingNote}
        onClose={() => {
          setShareDialogOpen(false);
          setSharingNote(null);
        }}
        onShare={handleShare}
      />
    </Box>
  );
};

export default NotesTab;