import {
  Dialog,
  Typography,
  Box,
  IconButton
} from "@mui/material";
import { useRef, useEffect, useState } from "react";
import CloseIcon from '@mui/icons-material/Close';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import MicOffIcon from '@mui/icons-material/MicOff';

const CallDialog = ({ open, userId, onCancel, remoteStream, onLocal, status }) => {
  const remoteVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleMute = () => {
    if (!onLocal) return;

    onLocal.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled; // toggle audio track
    });

    setIsMuted(!isMuted);
  };

  return (
    <Dialog open={open} onClose={onCancel} fullScreen>
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      />

      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
          py: 10,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.0))",
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" sx={{ color: "white", pointerEvents: "auto" }}>
            Calling User {userId}
          </Typography>
          <Typography sx={{ color: "white", opacity: 0.7, pointerEvents: "auto" }}>
            {status}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, pointerEvents: "auto" }}>
          {/* Mute/Unmute */}
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

          {/* End Call */}
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
    </Dialog>
  );
};

export default CallDialog;
