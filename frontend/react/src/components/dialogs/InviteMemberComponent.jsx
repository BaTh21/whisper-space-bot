import { Box, TextField, List, ListItem, ListItemText, Modal, Button } from "@mui/material";
import { searchUsers, inviteToGroup } from "../../services/api";
import { useState } from "react";

function InviteMemberComponent({ open, onClose, onSuccess, group }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearchUsers = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (value.trim().length < 2) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      const res = await searchUsers(value);
      setUsers(res);
    } catch (error) {
      console.error("Search error:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (userId) => {
    try {
      await inviteToGroup(group.id, userId);
      alert("Invite has been sent!");
      if (onSuccess) onSuccess(userId);
      onClose();
    } catch (error) {
      console.error("Invite error:", error);
      alert(error.message || "Failed to invite user");
    }
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
          border: "2px solid #000",
          boxShadow: 24,
          pt: 2,
          px: 4,
          pb: 3,
        }}
      >
        <TextField
          label="Search users"
          variant="outlined"
          fullWidth
          value={query}
          onChange={handleSearchUsers}
        />

        {loading && <p>Searching...</p>}

        <List>
          {users.map((user) => (
            <ListItem key={user.id} divider>
              <ListItemText
                primary={user.name || user.username}
                secondary={user.email}
              />
              <Button
                variant="contained"
                size="small"
                onClick={() => handleInviteMember(user.id)}
              >
                Invite
              </Button>
            </ListItem>
          ))}
        </List>
      </Box>
    </Modal>
  );
}

export default InviteMemberComponent;
