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

// Import the api instance

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

  // Mock current user - replace with your actual user management
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
    console.log('🔄 Loading notes...');

    if (activeTab === 2) {
      // Load shared notes with better error handling
      try {
        const data = await getSharedNotes();
        console.log('✅ Shared notes loaded:', data);
        setSharedNotes(Array.isArray(data) ? data : []);
      } catch (sharedError) {
        console.warn('⚠️ Shared notes endpoint not available:', sharedError);
        setSharedNotes([]); // Set empty array instead of crashing
        setError('Shared notes feature is not available yet');
      }
    } else {
      const archived = activeTab === 1;
      const data = await getNotes(archived);
      console.log('✅ Notes loaded successfully:', data);
      setNotes(Array.isArray(data) ? data : []);
    }
  } catch (error) {
    console.error('❌ Error loading notes:', error);
    
    if (error.response?.status === 404) {
      setError('Feature not available: The server endpoint is missing');
    } else if (error.response?.status === 500) {
      setError('Server error: Please check backend logs');
    } else {
      setError(`Failed to load notes: ${error.message}`);
    }
    
    setNotes([]);
    setSharedNotes([]);
  } finally {
    setLoading(false);
  }
};

  // ... rest of your functions remain the same
  const handleCreateNote = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleSaveNote = async (noteData) => {
    try {
      console.log('Saving note:', noteData);
      let result;
      if (editingNote) {
        result = await updateNote(editingNote.id, noteData);
        setSuccess('Note updated successfully');
      } else {
        result = await createNote(noteData);
        setSuccess('Note created successfully');
      }
      console.log('Save successful:', result);
      setIsEditorOpen(false);
      setEditingNote(null);
      loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      setError(error.message || 'Failed to save note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      console.log('Deleting note:', noteId);
      await deleteNote(noteId);
      setSuccess('Note deleted successfully');
      loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      setError(error.message || 'Failed to delete note');
    }
  };

  const handleTogglePin = async (noteId) => {
    try {
      console.log('Toggling pin for note:', noteId);
      await togglePinNote(noteId);
      setSuccess('Note pinned status updated');
      loadNotes();
    } catch (error) {
      console.error('Error toggling pin:', error);
      setError(error.message || 'Failed to toggle pin');
    }
  };

  const handleToggleArchive = async (noteId) => {
    try {
      console.log('Toggling archive for note:', noteId);
      await toggleArchiveNote(noteId);
      const action = activeTab === 0 ? 'archived' : 'unarchived';
      setSuccess(`Note ${action} successfully`);
      loadNotes();
    } catch (error) {
      console.error('Error toggling archive:', error);
      setError(error.message || 'Failed to toggle archive');
    }
  };

  const handleShareNote = (note) => {
    setSharingNote(note);
    setShareDialogOpen(true);
  };

  const handleShare = async (shareData) => {
    try {
      console.log('Sharing note:', shareData);
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
      setShareDialogOpen(false);
      setSharingNote(null);
      loadNotes();
    } catch (error) {
      console.error('Error sharing note:', error);
      setError(error.message || 'Failed to update sharing settings');
    }
  };

  // Filter notes based on current tab
  const filteredNotes = notes.filter(note => {
    if (activeTab === 0) return !note.is_archived;
    if (activeTab === 1) return note.is_archived;
    return true;
  });

  const pinnedNotes = filteredNotes.filter(note => note.is_pinned);
  const otherNotes = filteredNotes.filter(note => !note.is_pinned);

  return (
    <Box sx={{ position: 'relative', minHeight: 400 }}>
      <Typography variant="h5" gutterBottom fontWeight="600">
        My Notes
      </Typography>

      <Tabs 
        value={activeTab} 
        onChange={(e, newValue) => setActiveTab(newValue)} 
        sx={{ mb: 3 }}
      >
        <Tab label="Active Notes" />
        <Tab label="Archived" />
        <Tab label="Shared with Me" />
      </Tabs>

      {loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography>Loading notes...</Typography>
        </Box>
      )}

      {/* Active Notes Tab */}
      {!loading && activeTab === 0 && (
        <>
          {pinnedNotes.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom color="text.secondary">
                PINNED
              </Typography>
              <Grid container spacing={2}>
                {pinnedNotes.map(note => (
                  <Grid key={note.id} size={{ xs: 12, sm: 6, md: 4 }}>
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
                  <Grid key={note.id} size={{ xs: 12, sm: 6, md: 4 }}>
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
                <NotesIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
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

      {/* Archived Notes Tab */}
      {!loading && activeTab === 1 && (
        <>
          {filteredNotes.length > 0 ? (
            <Grid container spacing={2}>
              {filteredNotes.map(note => (
                <Grid key={note.id} size={{ xs: 12, sm: 6, md: 4 }}>
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
                <NotesIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
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

      {/* Shared with Me Tab */}
      {!loading && activeTab === 2 && (
        <>
          {sharedNotes.length > 0 ? (
            <Grid container spacing={2}>
              {sharedNotes.map(note => (
                <Grid key={note.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <NoteCard
                    note={note}
                    onEdit={handleEditNote}
                    onDelete={() => {}}
                    onTogglePin={() => {}}
                    onToggleArchive={() => {}}
                    onShare={() => {}}
                    currentUser={currentUser}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card variant="outlined" sx={{ textAlign: 'center', py: 6 }}>
              <CardContent>
                <GroupIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
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

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add note"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
        }}
        onClick={handleCreateNote}
      >
        <AddIcon />
      </Fab>

      {/* Note Editor Dialog */}
      <NoteEditor
        open={isEditorOpen}
        note={editingNote}
        onSave={handleSaveNote}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingNote(null);
        }}
      />

      {/* Share Dialog */}
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