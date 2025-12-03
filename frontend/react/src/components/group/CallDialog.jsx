import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Card
} from "@mui/material";

import MicOffIcon from "@mui/icons-material/MicOff";
import KeyboardVoiceIcon from "@mui/icons-material/KeyboardVoice";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CloseIcon from "@mui/icons-material/Close";

const Video = ({ stream }) => {
  const ref = useRef();

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.onloadedmetadata = () => {
        ref.current.play().catch(() => { });
      };
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
};

const getRows = (streams) => {
  const count = streams.length;

  if (count === 0) return [];
  if (count === 1) return [[streams[0]]];
  if (count === 2) return [[streams[0]], [streams[1]]];
  if (count === 3) return [[streams[0], streams[1]], [streams[2]]];
  if (count === 4) return [[streams[0], streams[1]], [streams[2], streams[3]]];

  const rows = [];
  for (let i = 0; i < count; i += 2) {
    rows.push(streams.slice(i, i + 2));
  }
  return rows;
};

const CallDialog = ({
  open,
  remoteStreams,
  onLocal,
  onCancel,
  status,
  peersRef
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [pipPos, setPipPos] = useState({ x: 20, y: 20 });
  const pipRef = useRef(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const streams = Object.values(remoteStreams || {}).filter(
    (s) => s && s.getTracks().length > 0
  );

  const rows = getRows(streams);

  const toggleMute = () => {
    if (!onLocal) return;
    onLocal.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    setIsMuted(!isMuted);
  };

  const toggleVideo = async () => {
    if (!onLocal) return;
    const currentEnabled = onLocal.getVideoTracks()[0]?.enabled;

    let newTrack;
    if (currentEnabled) {
      newTrack = createBlackVideoTrack();
    } else {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      newTrack = newStream.getVideoTracks()[0];
    }

    Object.values(peersRef.current).forEach((pc) => {
      const sender = pc.getSenders().find(
        (s) => s.track && s.track.kind === "video"
      );
      if (sender) sender.replaceTrack(newTrack);
    });

    const oldTrack = onLocal.getVideoTracks()[0];
    if (oldTrack) onLocal.removeTrack(oldTrack);
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

  const startDrag = (e) => {
    dragging.current = true;

    const rect = pipRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragOffset.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const duringDrag = (e) => {
    if (!dragging.current) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const newX = clientX - dragOffset.current.x;
    const newY = clientY - dragOffset.current.y;

    const maxX = window.innerWidth - 200;
    const maxY = window.innerHeight - 140;

    setPipPos({
      x: Math.max(10, Math.min(newX, maxX)),
      y: Math.max(10, Math.min(newY, maxY)),
    });
  };

  const stopDrag = () => {
    dragging.current = false;
  };

  useEffect(() => {
    window.addEventListener("mousemove", duringDrag);
    window.addEventListener("mouseup", stopDrag);

    window.addEventListener("touchmove", duringDrag);
    window.addEventListener("touchend", stopDrag);

    return () => {
      window.removeEventListener("mousemove", duringDrag);
      window.removeEventListener("mouseup", stopDrag);

      window.removeEventListener("touchmove", duringDrag);
      window.removeEventListener("touchend", stopDrag);
    };
  }, []);

  return (
    <Dialog open={open} onClose={onCancel} fullScreen>
      <Box
        sx={{
          width: "100%",
          height: "100%",
          position: "relative",
          bgcolor: "black"
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            padding: "6px",
            boxSizing: "border-box",
            position: "absolute",
            top: 0,
            left: 0,
            overflow: "hidden"
          }}
        >
          {rows.map((row, rIndex) => (
            <Box
              key={rIndex}
              sx={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                gap: "6px",
                height: 120,
              }}
            >
              {row.map((stream, cIndex) => (
                <Card
                  key={cIndex}
                  sx={{
                    flex: row.length === 1 ? "0 1 70%" : "0 1 48%",
                    height: "100%",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#111",
                  }}
                >
                  <Video stream={stream} />
                </Card>
              ))}
            </Box>
          ))}

          {streams.length === 0 && (
            <Typography
              variant="h5"
              sx={{
                color: "white",
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)"
              }}
            >
              Waiting for others to join...
            </Typography>
          )}
        </Box>

        {onLocal && videoEnabled && (
          <Box
            ref={pipRef}
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            sx={{
              position: "fixed",
              bottom: "unset",
              right: "unset",
              left: pipPos.x,
              top: pipPos.y,
              width: 200,
              height: 140,
              borderRadius: 2,
              overflow: "hidden",
              zIndex: 20,
              border: "2px solid white",
              background: "black",
              cursor: "grab",
              touchAction: "none",
              boxShadow: "0 0 10px rgba(0,0,0,0.5)",
            }}
          >
            <Video stream={onLocal} />
          </Box>
        )}

        <Box
          sx={{
            position: "fixed",
            bottom: 32,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            gap: 4,
            zIndex: 30
          }}
        >
          <IconButton
            onClick={toggleMute}
            sx={{
              backgroundColor: isMuted ? "secondary.main" : "primary.main",
              color: "white",
              "&:hover": {
                backgroundColor: isMuted ? "#68102fff" : "#1a2f42ff"
              }
            }}
          >
            {isMuted ? <MicOffIcon /> : <KeyboardVoiceIcon />}
          </IconButton>

          <IconButton
            onClick={toggleVideo}
            sx={{
              backgroundColor: videoEnabled ? "primary.main" : "secondary.main",
              color: "white",
              "&:hover": {
                backgroundColor: videoEnabled ? "#1a2f42ff" : "#68102fff"
              }
            }}
          >
            {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
          </IconButton>

          <IconButton
            onClick={onCancel}
            sx={{
              backgroundColor: "error.main",
              color: "white",
              "&:hover": { backgroundColor: "#b71c1c" }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {status && (
          <Typography
            sx={{
              position: "fixed",
              top: 20,
              width: "100%",
              textAlign: "center",
              color: "white",
              zIndex: 30
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
