import {
  Palette as PaletteIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  TextField,
  Typography
} from '@mui/material';
import { useEffect, useState } from 'react';

const colorOptions = [
  '#ffffff', '#f28b82', '#fbbc04', '#fff475', 
  '#ccff90', '#a7ffeb', '#cbf0f8', '#aecbfa', 
  '#d7aefb', '#fdcfe8', '#e6c9a8', '#e8eaed'
];

const NoteEditor = ({ open, note, onSave, onClose }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    if (open) {
      if (note) {
        // Editing existing note
        setTitle(note.title || '');
        setContent(note.content || '');
        setIsPinned(note.is_pinned || false);
        setColor(note.color || '#ffffff');
      } else {
        // Creating new note
        setTitle('');
        setContent('');
        setIsPinned(false);
        setColor('#ffffff');
      }
      setShowColorPicker(false);
    }
  }, [note, open]);

  const handleSave = () => {
    console.log('=== SAVE BUTTON CLICKED ===');
    console.log('Title:', title);
    console.log('Content:', content);
    console.log('isPinned:', isPinned);
    
    // Allow saving even with empty title for testing
    const noteData = {
      title: title.trim() || 'Untitled Note', // Fallback title
      content: content.trim(),
      is_pinned: isPinned,
    };
    
    console.log('Saving note data:', noteData);
    onSave(noteData);
  };

  const handleClose = () => {
    setShowColorPicker(false);
    onClose();
  };

  const handleKeyPress = (e) => {
    // Ctrl+Enter to save
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: color,
          borderRadius: 2,
          minHeight: 200
        }
      }}
    >
      <DialogContent sx={{ p: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <TextField
            fullWidth
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: {
                fontSize: '1.25rem',
                fontWeight: 600,
                '&::placeholder': {
                  opacity: 0.6
                }
              }
            }}
            sx={{ mr: 1 }}
            onKeyPress={handleKeyPress}
            autoFocus
          />
          <IconButton
            size="small"
            onClick={() => setIsPinned(!isPinned)}
            color={isPinned ? 'primary' : 'default'}
            sx={{ mt: 0.5 }}
            title={isPinned ? 'Unpin note' : 'Pin note'}
          >
            {isPinned ? <PinIcon /> : <PinOutlinedIcon />}
          </IconButton>
        </Box>

        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={15}
          placeholder="Take a note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          variant="standard"
          InputProps={{
            disableUnderline: true,
            sx: {
              '&::placeholder': {
                opacity: 0.6
              }
            }
          }}
          onKeyPress={handleKeyPress}
        />

        {showColorPicker && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Choose color:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {colorOptions.map((colorOption) => (
                <Box
                  key={colorOption}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: colorOption,
                    border: '2px solid',
                    borderColor: color === colorOption ? 'primary.main' : 'transparent',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      borderColor: 'primary.main'
                    },
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setColor(colorOption)}
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => setShowColorPicker(!showColorPicker)}
            color={showColorPicker ? 'primary' : 'default'}
            title="Change color"
          >
            <PaletteIcon />
          </IconButton>
        </Box>
        
        <Box sx={{ flexGrow: 1 }} />
        
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          // REMOVED disabled prop completely for testing
          sx={{ minWidth: 80 }}
        >
          {note ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NoteEditor;