import { Card, Box, Typography } from "@mui/material";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import { useEffect, useRef, useState } from "react";

const Video = ({ stream }) => {
  const ref = useRef();
  const userName = useState(null);

  useEffect(() => {
    if (!ref.current || !stream) return;

    ref.current.srcObject = stream;
    ref.current.play().catch(() => { });

    const handleTrack = () => ref.current.play().catch(() => { });
    stream.addEventListener("addtrack", handleTrack);
    stream.addEventListener("removetrack", handleTrack);

    return () => {
      stream.removeEventListener("addtrack", handleTrack);
      stream.removeEventListener("removetrack", handleTrack);
    };
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={userName === "You"}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
};

const VideoCard = ({ stream, userName }) => {
  if (!stream) {
    return (
      <Card
        sx={{
          flex: 1,
          height: "100%",
          borderRadius: "12px",
          overflow: "hidden",
          background: "#222",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
        }}
      >
        <Typography>No video</Typography>
      </Card>
    );
  }

  const audioTrack = stream.getAudioTracks()[0];
  const videoTrack = stream.getVideoTracks()[0];

  const isMuted = audioTrack ? !audioTrack.enabled : true;
  const videoEnabled = videoTrack ? videoTrack.enabled : false;

  return (
    <Card
      sx={{
        flex: 1,
        height: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#111",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {videoEnabled ? (
        <Video stream={stream} />
      ) : (
        <Box
          sx={{
            position: "absolute",
            width: "100%",
            height: "100%",
            bgcolor: "#222",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            color: "white",
          }}
        >
          <VideocamOffIcon sx={{ fontSize: 50, mb: 1 }} />
          <Typography variant="body1">Camera Off</Typography>
        </Box>
      )}

      {isMuted && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: "rgba(0,0,0,0.6)",
            borderRadius: "50%",
            p: 0.5,
          }}
        >
          <MicOffIcon sx={{ color: "white", fontSize: 20 }} />
        </Box>
      )}

      {userName && (
        <Box
          sx={{
            position: "absolute",
            bottom: 8,
            left: 8,
            bgcolor: "rgba(0,0,0,0.5)",
            px: 1,
            py: 0.5,
            borderRadius: 1,
            color: "white",
            fontSize: 12,
          }}
        >
          {userName}
        </Box>
      )}
    </Card>
  );
};

export default VideoCard;
