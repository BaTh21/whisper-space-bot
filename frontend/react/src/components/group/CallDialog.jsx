import { useState, useRef, useEffect } from "react";
import { Dialog, Box, Typography, IconButton, Card } from "@mui/material";
import MicOffIcon from '@mui/icons-material/MicOff';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CloseIcon from '@mui/icons-material/Close';

const Video = ({ stream, style }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.onloadedmetadata = () => {
        ref.current.play().catch(() => {});
      };
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      style={{ width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
};

const CallDialog = ({ open, remoteStreams, onLocal, onCancel, status, peersRef }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const streams = Object.values(remoteStreams || {}).filter(
    (s) => s && s.getTracks().length > 0
  );

  const streamCount = streams.length;

  const getGridSize = (count) => {
    if (count === 1) return { w: "100%", h: "100%" };
    if (count === 2) return { w: "50%", h: "100%" };
    if (count === 3) return { w: "50%", h: "50%" };
    if (count === 4) return { w: "50%", h: "50%" };
    return { w: "33.33%", h: "33.33%" };
  };

  const toggleMute = () => {
    if (!onLocal) return;
    onLocal.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
    setIsMuted(!isMuted);
  };

  const toggleVideo = async () => {
    if (!onLocal) return;
    const currentEnabled = onLocal.getVideoTracks()[0]?.enabled;
    let newTrack;
    if (currentEnabled) newTrack = createBlackVideoTrack();
    else {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      newTrack = newStream.getVideoTracks()[0];
    }

    Object.values(peersRef.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) sender.replaceTrack(newTrack);
    });

    onLocal.removeTrack(onLocal.getVideoTracks()[0]);
    onLocal.addTrack(newTrack);
    setVideoEnabled(!currentEnabled);
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
      <Box sx={{ width: "100%", height: "100%", position: "relative", bgcolor: "black" }}>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {streams.map((stream, index) => {
            const { w, h } = getGridSize(streamCount);
            return (
              <Box key={index} sx={{ width: w, height: h }}>
                <Video stream={stream} />
              </Box>
            );
          })}

          {streamCount === 0 && (
            <Typography
              variant="h5"
              sx={{
                color: "white",
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              Waiting for others to join...
            </Typography>
          )}
        </Box>

        {onLocal && videoEnabled && (
          <Card
            sx={{
              position: "fixed",
              top: 16,
              right: 16,
              width: 160,
              height: 120,
              borderRadius: 2,
              overflow: "hidden",
              zIndex: 10,
              border: "2px solid white",
            }}
          >
            <Video stream={onLocal} />
          </Card>
        )}

        <Box
          sx={{
            position: "fixed",
            bottom: 32,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            gap: 4,
            zIndex: 20,
            pointerEvents: "auto",
          }}
        >
          <IconButton
            onClick={toggleMute}
            sx={{
              backgroundColor: isMuted ? "secondary.main" : "primary.main",
              color: "white",
              "&:hover": { backgroundColor: isMuted ? "#68102fff" : "#1a2f42ff" },
            }}
          >
            {isMuted ? <MicOffIcon /> : <KeyboardVoiceIcon />}
          </IconButton>

          <IconButton
            onClick={toggleVideo}
            sx={{
              backgroundColor: videoEnabled ? "primary.main" : "secondary.main",
              color: "white",
              "&:hover": { backgroundColor: videoEnabled ? "#1a2f42ff" : "#68102fff" },
            }}
          >
            {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
          </IconButton>

          <IconButton
            onClick={onCancel}
            sx={{
              backgroundColor: "error.main",
              color: "white",
              "&:hover": { backgroundColor: "#b71c1c" },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {status && (
          <Typography
            sx={{
              position: "fixed",
              top: 32,
              width: "100%",
              textAlign: "center",
              color: "white",
              zIndex: 20,
            }}
          >
            {status}
          </Typography>
        )}
      </Box>
    </Dialog>
  );
};

export default CallDialog;
