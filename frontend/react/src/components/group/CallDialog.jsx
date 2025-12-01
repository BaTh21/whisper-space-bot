import {
  Dialog,
  Typography,
  Box,
  IconButton
} from "@mui/material";
import { useState } from "react";
import CloseIcon from '@mui/icons-material/Close';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import MicOffIcon from '@mui/icons-material/MicOff';

const CallDialog = ({ open, remoteStreams, onLocal, onCancel, status }) => {
  const [isMuted, setIsMuted] = useState(false);
  const streamCount = Object.keys(remoteStreams).length;
  const gridCols = Math.ceil(Math.sqrt(streamCount + 1));
  const videoWidth = `${100 / gridCols}%`;
  const videoHeight = `${100 / gridCols}%`;


  const toggleMute = () => {
    if (!onLocal) return;
    onLocal.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsMuted(!isMuted);
  };

  return (
    <Dialog open={open} onClose={onCancel} fullScreen>
      <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
        <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
          {Object.entries(remoteStreams).length === 0 && (
            <Typography
              variant="h5"
              sx={{
                color: "white",
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 5,
              }}
            >
              Waiting for others to join...
            </Typography>
          )}

          {Object.entries(remoteStreams).map(([userId, stream]) => (
            <video
              key={userId}
              autoPlay
              playsInline
              ref={el => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
              style={{
                width: videoWidth,
                height: videoHeight,
                objectFit: 'cover',
              }}
            />
          ))}

          {onLocal && (
            <video
              autoPlay
              muted
              playsInline
              ref={el => { if (el && el.srcObject !== onLocal) el.srcObject = onLocal; }}
              style={{
                width: '150px',
                height: '120px',
                position: 'absolute',
                bottom: 16,
                right: 16,
                border: '2px solid white',
                objectFit: 'cover',
                zIndex: 10
              }}
            />
          )}
        </Box>

        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none",
            py: 2,
            background: "linear-gradient(to top, rgba(0,0,0,0.25), rgba(0,0,0,0.0))",
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ color: "primary.main", opacity: 0.7, pointerEvents: "auto" }}>
              {status}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, pointerEvents: "auto" }}>
            <IconButton
              onClick={toggleMute}
              sx={{
                backgroundColor: isMuted ? 'secondary.main' : 'primary.main',
                color: 'white',
                '&:hover': { backgroundColor: isMuted ? '#68102fff' : '#1a2f42ff' }
              }}
            >
              {isMuted ? <MicOffIcon /> : <KeyboardVoiceIcon />}
            </IconButton>

            <IconButton
              onClick={onCancel}
              sx={{
                backgroundColor: 'error.main',
                color: 'white',
                '&:hover': { backgroundColor: '#b71c1c' }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Dialog>

  );
};

export default CallDialog;
