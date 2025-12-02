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
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import RemoteVideo from './RemoteVideo';

const CallDialog = ({ open, remoteStreams, onLocal, onCancel, status, peersRef }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
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

  const toggleVideo = async () => {
    if (!onLocal) return;
    const currentEnabled = onLocal.getVideoTracks()[0]?.enabled; let newTrack;
    if (currentEnabled) { newTrack = createBlackVideoTrack(); }
    else {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      newTrack = newStream.getVideoTracks()[0];
    }
    Object.values(peersRef.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) sender.replaceTrack(newTrack);
    });
    onLocal.removeTrack(onLocal.getVideoTracks()[0]);
    onLocal.addTrack(newTrack); setVideoEnabled(!currentEnabled);
  };

  const createBlackVideoTrack = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const stream = canvas.captureStream(1);
    const track = stream.getVideoTracks()[0];
    return Object.assign(track, { enabled: false });
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
            <RemoteVideo
              key={userId}
              stream={stream}
              width={videoWidth}
              height={videoHeight}
            />
          ))}

          {onLocal && videoEnabled && (
            <RemoteVideo
              stream={onLocal}
              width="150px"
              height="120px"
              style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                border: '2px solid white',
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
              onClick={toggleVideo}
              sx={{
                backgroundColor: videoEnabled ? 'primary.main' : 'secondary.main',
                color: 'white',
                '&:hover': { backgroundColor: videoEnabled ? '#1a2f42ff' : '#68102fff' }
              }}
            >
              {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
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
