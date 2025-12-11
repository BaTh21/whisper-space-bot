import { Card, Box, Typography, Avatar } from "@mui/material";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import { useEffect, useRef } from "react";

const Video = ({ stream, muted }) => {
  const ref = useRef();

  const isAudioOnly = stream.getVideoTracks().length === 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }

    el.muted = muted;
    el.volume = muted ? 0 : 1;

    el.play().catch(err => {
      if (err.name !== "AbortError") console.warn("play failed", err);
    });

  }, [stream, muted]);

  useEffect(() => {
    return () => {
      const el = ref.current;
      if (el) {
        el.pause();
        el.srcObject = null;
      }
    };
  }, []);

  if (isAudioOnly) {
    return <audio ref={ref} autoPlay playsInline />;
  }

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
};

const VideoCard = ({ stream, userName, avatarUrl }) => {
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
        border: 1,
        borderColor: 'divider'
      }}
    >
      {videoEnabled ? (
        <Video stream={stream} userName={userName} muted={userName === "You"} />
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
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          {userName !== "You" && (
            <Avatar
              src={avatarUrl || ""}
              alt={userName || "profile img"}
              sx={{
                width: 25, height: 25, fontSize: 12
              }}
            >
              {userName.charAt(0) || "P"}
            </Avatar>
          )}

          <Typography>{userName}</Typography>
        </Box>
      )}

    </Card>
  );
};

export default VideoCard;
