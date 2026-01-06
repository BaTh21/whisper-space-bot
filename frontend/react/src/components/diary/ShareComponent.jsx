import { useState } from "react";
import {
  Modal,
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Avatar,
  Select,
  OutlinedInput,
  Chip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTranslation } from 'react-i18next';

function ShareComponent({ open, onClose, friends, copyLink, showMessage }) {
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const { t } = useTranslation();

  const handleCopy = () => {
    navigator.clipboard.writeText(copyLink);
    setLinkCopied(true);
    showMessage(t('link_copied'));
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleSelectChange = (event) => {
    const selectedIds = event.target.value;
    const selected = friends
      .filter((f) => selectedIds.includes(f.friend.id))
      .map((f) => f.friend);
    setSelectedFriends(selected);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 400,
          bgcolor: "background.paper",
          borderRadius: 3,
          boxShadow: 24,
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography variant="h6" component="h2">
          Share with Friends
        </Typography>

        <Typography variant="body1">
          Select one or more friends to share this link or copy the link to share manually.
        </Typography>

        <Select
          sx={{color: 'primary.main'}}
          multiple
          value={selectedFriends.map((f) => f.id)}
          onChange={handleSelectChange}
          input={<OutlinedInput label="Select Friends" />}
          renderValue={(selected) => (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {selected.map((id) => {
                const friend = friends.find((f) => f.friend.id === id).friend;
                return <Chip key={id} label={friend.username} avatar={<Avatar src={friend.avatar_url} />} />;
              })}
            </Box>
          )}
        >
          {friends.map(({ friend }) => (
            <MenuItem key={friend.id} value={friend.id}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Avatar src={friend.avatar_url} sx={{ width: 24, height: 24 }} />
                <Typography>{friend.username}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField value={copyLink} InputProps={{ readOnly: true }} fullWidth />
          <IconButton color="primary" onClick={handleCopy}>
            <ContentCopyIcon />
          </IconButton>
        </Box>
        {linkCopied && (
          <Typography variant="body2" color="success.main">
            Link copied!
          </Typography>
        )}

        <Button
          variant="contained"
          color="primary"
          disabled={selectedFriends.length === 0}
          onClick={() =>
            alert(
              `Link shared with: ${selectedFriends.map((f) => f.username).join(", ")}`
            )
          }
        >
          Share
        </Button>
      </Box>
    </Modal>
  );
}

export default ShareComponent;
