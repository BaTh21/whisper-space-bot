//dashboard/NotesTab.jsx
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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const currentUser = {
    id: 1,
    name: "Current User",
    email: "user@example.com"
  };

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
      setError(error.message || 'Failed to load notes');
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

  const showTimedAlert = (type, message, duration = 2000) => {
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
      showTimedAlert('success', 'Note updated successfully');
    } else {
      result = await createNote(noteData);
      showTimedAlert('success', 'Note created successfully');
    }
    
    setIsEditorOpen(false);
    setEditingNote(null);
    loadNotes();
  } catch (error) {
    console.error('Error saving note:', error);
    showTimedAlert('error', error.message || 'Failed to save note');
  }
};

  const handleDeleteNote = async (noteId) => {
  try {
    await deleteNote(noteId);
    setSuccess('Note deleted successfully');
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setSuccess('');
    }, 2000);
    
    loadNotes();
  } catch (error) {
    console.error('Error deleting note:', error);
    setError(error.message || 'Failed to delete note');
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setError('');
    }, 2000);
  }
};

  const handleTogglePin = async (noteId) => {
  try {
    await togglePinNote(noteId);
    setSuccess('Note pinned status updated');
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setSuccess('');
    }, 2000);
    
    loadNotes();
  } catch (error) {
    console.error('Error toggling pin:', error);
    setError(error.message || 'Failed to toggle pin');
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setError('');
    }, 2000);
  }
};

  const handleToggleArchive = async (noteId) => {
  try {
    await toggleArchiveNote(noteId);
    const action = activeTab === 0 ? 'archived' : 'unarchived';
    setSuccess(`Note ${action} successfully`);
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setSuccess('');
    }, 2000);
    
    loadNotes();
  } catch (error) {
    console.error('Error toggling archive:', error);
    setError(error.message || 'Failed to toggle archive');
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setError('');
    }, 2000);
  }
};

  const handleShareNote = (note) => {
    setSharingNote(note);
    setShareDialogOpen(true);
  };

  const handleShare = async (shareData) => {
  try {
    await shareNote(sharingNote.id, shareData);
    
    let successMessage = 'Sharing settings updated';
    if (shareData.share_type === 'public') {
      successMessage = 'Note is now public';
    } else if (shareData.share_type === 'shared') {
      successMessage = `Note shared with ${shareData.friend_ids.length} friend${shareData.friend_ids.length !== 1 ? 's' : ''}`;
    } else {
      successMessage = 'Note is now private';
    }
    
    setSuccess(successMessage);
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setSuccess('');
    }, 2000);
    
    setShareDialogOpen(false);
    setSharingNote(null);
    loadNotes();
  } catch (error) {
    console.error('Error sharing note:', error);
    setError(error.message || 'Failed to update sharing settings');
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setError('');
    }, 2000);
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
        My Notes
      </Typography>

      <Tabs 
        value={activeTab} 
        onChange={(e, newValue) => setActiveTab(newValue)} 
        sx={{ mb: 3 }}
        variant={isMobile ? "scrollable" : "standard"}
        scrollButtons={isMobile ? "auto" : false}
        allowScrollButtonsMobile
      >
        <Tab label="Active Notes" />
        <Tab label="Archived" />
        {/* <Tab label="Shared with Me" /> */}
      </Tabs>

      {loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography>Loading notes...</Typography>
        </Box>
      )}

      {!loading && activeTab === 0 && (
        <>
          {pinnedNotes.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom color="text.secondary">
                PINNED
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
                      currentUser={currentUser}
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
                  OTHERS
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
                      currentUser={currentUser}
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
                  No notes yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create your first note to get started
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
                    currentUser={currentUser}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card variant="outlined" sx={{ textAlign: 'center', py: 6 }}>
              <CardContent>
                <NotesIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No archived notes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Archived notes will appear here
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
                    onEdit={note.can_edit ? handleEditNote : undefined}
                    onDelete={undefined}
                    onTogglePin={undefined}
                    onToggleArchive={undefined}
                    onShare={undefined}
                    currentUser={currentUser}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card variant="outlined" sx={{ textAlign: 'center', py: 6 }}>
              <CardContent>
                <GroupIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No shared notes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Notes shared by friends will appear here
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Fab
        color="primary"
        aria-label="add note"
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