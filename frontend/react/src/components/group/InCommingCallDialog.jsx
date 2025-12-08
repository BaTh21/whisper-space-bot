import { Typography, Box, IconButton, Modal } from "@mui/material";
import LocalPhoneIcon from '@mui/icons-material/LocalPhone';
import CloseIcon from '@mui/icons-material/Close';

export const IncomingCallDialog = ({ open, fromUserId, isAudioOnly, onAccept, onReject }) => (
  <Modal
    open={open}
    sx={{
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: 'white'
    }}
  >
    <Box
      sx={{
        height: '100vh',
        width: { xs: 250, md: 350 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 18,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 1
        }}
      >
        <Typography
          sx={{
            fontSize: 20,
            color: 'white'
          }}
        >User {fromUserId} is calling you</Typography>
        <Typography sx={{ color: 'white' }}>
          {isAudioOnly ? "Incoming Voice Call" : "Incoming Video Call"}
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
          onClick={onAccept}
          variant="contained"
          color="error"
          sx={{
            fontSize: "1.2rem",
            padding: 1.5,
            borderRadius: 6,
            pointerEvents: "auto",
            backgroundColor: '#118644ff',
            color: 'white',
            '&:hover': {
              backgroundColor: '#195f37ff',
            }
          }}

        >
          <LocalPhoneIcon />
        </IconButton>
        <IconButton
          onClick={onReject}
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
  </Modal>
);
