import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Box,
  IconButton, InputAdornment, CircularProgress
} from '@mui/material';
import {
  Mic
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createDiary, transcribe } from '../../services/api';
import { useCallback, useEffect, useRef, useState } from 'react';

const CreateDiaryDialog = ({ open, onClose, groups, onSuccess, setError }) => {
  const formik = useFormik({
    initialValues: {
      title: '',
      content: '',
      share_type: 'public',
      group_ids: [],
    },
    validationSchema: Yup.object({
      title: Yup.string().required('Title is required'),
      content: Yup.string().required('Content is required'),
      share_type: Yup.string().oneOf(['public', 'friends', 'group', 'personal']),
      group_ids: Yup.array().when('share_type', {
        is: 'group',
        then: (schema) => schema.min(1, 'Please select at least one group'),
        otherwise: (schema) => schema.notRequired(),
      }),
    }),
    onSubmit: async (values, { resetForm }) => {
      try {
        const payload = {
          title: values.title,
          content: values.content,
          share_type: values.share_type,
          group_ids: values.share_type === 'group' ? values.group_ids : [],
        };

        if (values.share_type !== 'group') delete payload.group_ids;

        await createDiary(payload);
        resetForm();
        onSuccess();
      } catch (err) {
        setError(err.message || 'Failed to create diary');
      }
    },
  });

  const handleClose = () => {
    formik.resetForm();
    onClose();
  };

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

      // Play recorded audio (optional)
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();

      // Optional: play void sound
      new Audio("/sounds/void.mp3").play();

      // Optional: send to backend
     const formData = new FormData();
      formData.append("file", blob, "voice.webm");

      try {
        setLoading(true);
        const result = await transcribe(formData);
        const currentContent = formik.values.content || "";
        const newText = result.text || "";
        formik.setFieldValue("content", currentContent + " " + newText);
      } catch (error) {
        console.error("Transcription error:", error);
      } finally {
        setLoading(false);
      }
    };

    recorder.stop(); // call stop AFTER onstop is set
    setRecording(false);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: '16px' }
      }}
    >
      <DialogTitle sx={{ fontWeight: 600 }}>Create New Diary</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ mt: 1 }}>
          <TextField
            label="Title"
            name="title"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.title && !!formik.errors.title}
            helperText={formik.touched.title && formik.errors.title}
            fullWidth
            margin="normal"
            required
          />

          <TextField
            label="Content"
            name="content"
            multiline
            rows={4}
            value={formik.values.content}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.content && !!formik.errors.content}
            helperText={formik.touched.content && formik.errors.content}
            fullWidth
            margin="normal"
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    color={recording ? "error" : "primary"}
                  >
                    {loading ? (<CircularProgress size={24} />) : (<Mic />)}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Share Type</InputLabel>
            <Select
              name="share_type"
              value={formik.values.share_type}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              label="Share Type"
            >
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="friends">Friends Only</MenuItem>
              <MenuItem value="group">Group</MenuItem>
              <MenuItem value="personal">Personal</MenuItem>
            </Select>
          </FormControl>

          {formik.values.share_type === 'group' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Select Groups</InputLabel>
              <Select
                multiple
                name="group_ids"
                value={formik.values.group_ids}
                onChange={formik.handleChange}
                renderValue={(selected) =>
                  groups
                    .filter((group) => selected.includes(group.id))
                    .map((g) => g.name)
                    .join(', ')
                }
              >
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    <Checkbox checked={formik.values.group_ids.includes(group.id)} />
                    <ListItemText primary={group.name} />
                  </MenuItem>
                ))}
              </Select>
              {formik.touched.group_ids && formik.errors.group_ids && (
                <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5 }}>
                  {formik.errors.group_ids}
                </Box>
              )}
            </FormControl>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={formik.handleSubmit}
          variant="contained"
          disabled={!formik.isValid || formik.isSubmitting}
        >
          Create Diary
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateDiaryDialog;