import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography
} from "@mui/material";
import { useRef, useEffect } from "react";

const CallingDialog = ({ open, userId, onCancel, remoteStream, onLocal, status }) => {
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{status}</DialogTitle>

      <DialogContent sx={{ textAlign: "center", paddingTop: 3, paddingBottom: 3 }}>
        <video
          ref={remoteVideoRef}
          srcobject={onLocal}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", borderRadius: 8 }}
        />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Calling User {userId}
        </Typography>
        <Typography sx={{ mt: 1, color: "text.secondary" }}>
          {status}
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} variant="contained" color="error" fullWidth>
          Cancel Call
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CallingDialog;
