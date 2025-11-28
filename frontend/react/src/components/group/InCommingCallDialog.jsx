import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";

export const IncomingCallDialog = ({ open, fromUserId, onAccept, onReject }) => (
  <Dialog open={open} maxWidth="xs" fullWidth>
    <DialogTitle>Incoming Call</DialogTitle>
    <DialogContent sx={{ textAlign: 'center' }}>
      <Typography>User {fromUserId} is calling you</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onReject} color="error" fullWidth>Reject</Button>
      <Button onClick={onAccept} variant="contained" fullWidth>Accept</Button>
    </DialogActions>
  </Dialog>
);
