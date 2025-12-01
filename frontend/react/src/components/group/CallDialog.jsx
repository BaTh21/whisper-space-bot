import {
  Dialog,
  Typography,
  Box,
  IconButton
} from "@mui/material";
import { useRef, useEffect } from "react";
import CloseIcon from '@mui/icons-material/Close';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';

const CallingDialog = ({ open, userId, onCancel, remoteStream, status }) => {
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      fullScreen
      PaperProps={{
        sx: {
          position: "relative",
          backgroundColor: "black",
        }
      }}
    >
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted
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
        <Box
          sx={{
            textAlign: 'center'
          }}
        >
          <Typography
            variant="h4"
            sx={{
              color: "white",
              mb: 2,
              pointerEvents: "auto",
              fontSize: 20
            }}
          >
            Calling User {userId}
          </Typography>

          <Typography
            sx={{
              color: "white",
              opacity: 0.7,
              mb: 3,
              // fontSize: "1.2rem",
              pointerEvents: "auto",
            }}
          >
            {status}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >

          <IconButton
            onClick={onCancel}
            variant="contained"
            color="error"
            sx={{
              fontSize: "1.2rem",
              padding: 1.5,
              borderRadius: 6,
              pointerEvents: "auto",
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: '#1a2f42ff',
              }
            }}
          >
            <KeyboardVoiceIcon />
          </IconButton>
          <IconButton
            onClick={onCancel}
            variant="contained"
            color="error"
            sx={{
              fontSize: "1.2rem",
              padding: 1.5,
              borderRadius: 6,
              pointerEvents: "auto",
              backgroundColor: 'secondary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: '#68102fff',
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
    </Dialog>
  );
};

export default CallingDialog;
