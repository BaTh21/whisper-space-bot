import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL, // Remove /api/v1 from baseURL
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Fixed Login endpoint - Use form data format
export const login = async (data) => {
  try {
    const formData = new URLSearchParams();
    formData.append("username", data.email);
    formData.append("password", data.password);

    const response = await api.post(`/api/v1/auth/login`, formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      token_type: response.data.token_type,
    };
  } catch (error) {
    console.error("Login error details:", {
      status: error.response?.status,
      data: error.response?.data,
    });

    let errorMessage = "Login failed";

    if (error.response?.status === 401) {
      errorMessage = "Invalid email or password";
    } else if (error.response?.status === 403) {
      errorMessage = "Please verify your email first";
    } else if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    }

    throw new Error(errorMessage);
  }
};

// Auth endpoints
export const register = async (data) => {
  try {
    const response = await api.post(`/api/v1/auth/register`, data);
    return response.data;
  } catch (error) {
    console.error("Registration error details:", error.response?.data);

    const errorMessage =
      error.response?.data?.detail ||
      error.response?.data?.msg ||
      error.response?.data?.message ||
      "Registration failed";

    throw new Error(errorMessage);
  }
};

export const verifyCode = async (data) => {
  try {
    const response = await api.post(`/api/v1/auth/verify-code`, data);
    return response.data;
  } catch (error) {
    console.error("Verify code error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Verification failed"
    );
  }
};

// User endpoints
export const getMe = async () => {
  try {
    const response = await api.get(`/api/v1/users/me`);
    return response.data;
  } catch (error) {
    console.error("Get me error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to fetch profile"
    );
  }
};

export const updateMe = async (data) => {
  try {
    const response = await api.put(`/api/v1/users/me`, data);
    return response.data;
  } catch (error) {
    console.error("Update me error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to update profile"
    );
  }
};

export const uploadAvatar = async (file) => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await api.post("/api/v1/avatars/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const searchUsers = async (query) => {
  // Validate query
  if (!query || typeof query !== "string") {
    return [];
  }

  const trimmedQuery = query.trim();

  // Don't search if query is too short
  if (trimmedQuery.length < 2) {
    return [];
  }

  try {
    const response = await api.get("/api/v1/users/search", {
      params: {
        q: trimmedQuery, // Changed from 'query' to 'q' to match common API convention
      },
    });
    return response.data;
  } catch (error) {
    console.error("Search users error:", {
      status: error.response?.status,
      data: error.response?.data,
      query: trimmedQuery,
    });

    // Return empty array for common errors instead of crashing
    if (error.response?.status === 404) {
      console.warn("Search endpoint not found, returning empty results");
      return [];
    }

    if (error.response?.status === 422 || error.response?.status === 400) {
      console.warn("Search validation failed, returning empty results");
      return [];
    }

    if (error.response?.status === 500) {
      console.warn("Server error during search, returning empty results");
      return [];
    }

    // For network errors or other issues, return empty array
    return [];
  }
};

export const addFriend = async (userId) => {
  try {
    const response = await api.post("/api/v1/friends/", {
      friend_id: userId,
    });
    return response.data;
  } catch (error) {
    console.error("Add friend error:", {
      status: error.response?.status,
      data: error.response?.data,
      userId: userId,
    });

    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        error.response?.data?.msg ||
        "Failed to add friend"
    );
  }
};

// Friend endpoints
const getCurrentUserId = () => {
  try {
    const userData = localStorage.getItem("user");

    if (!userData || userData === "[object Object]") {
      console.warn("User data missing or corrupted");
      return null;
    }

    const user = JSON.parse(userData);
    return user?.id || null;
  } catch (error) {
    console.error("Error getting user ID:", error);
    return null;
  }
};

export const sendFriendRequest = async (userId) => {
  if (!userId || typeof userId !== "number") {
    return {
      success: false,
      message: "Invalid user ID",
      code: "INVALID_ID",
    };
  }

  const currentUserId = getCurrentUserId();

  if (currentUserId && userId === currentUserId) {
    return {
      success: false,
      message: "You cannot send a friend request to yourself",
      code: "SELF_REQUEST",
    };
  }

  try {
    const response = await api.post(`/api/v1/friends/request/${userId}`);

    return {
      success: true,
      data: response.data,
      message: "Friend request sent successfully!",
      code: "SUCCESS",
    };
  } catch (error) {
    console.error("Friend request error:", error);

    if (error.response?.status === 409) {
      return {
        success: true,
        data: error.response?.data,
        message: "Friend request already sent!",
        code: "ALREADY_EXISTS",
      };
    }

    const errorMessage =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "Failed to send friend request";

    return {
      success: false,
      message: errorMessage,
      code: "REQUEST_FAILED",
      status: error.response?.status,
    };
  }
};

export const checkFriendStatus = async (userId) => {
  try {
    const response = await api.get(`/api/v1/friends/status/${userId}`);
    return {
      exists: true,
      status: response.data.status,
      data: response.data,
    };
  } catch (error) {
    return {
      exists: false,
      status: "none",
      error: error.response?.data,
    };
  }
};

export const smartFriendRequest = async (userId) => {
  const statusCheck = await checkFriendStatus(userId);

  if (statusCheck.exists) {
    switch (statusCheck.status) {
      case "pending":
        return {
          success: false,
          message: "Friend request already pending!",
          code: "ALREADY_PENDING",
          data: statusCheck.data,
        };

      case "accepted":
        return {
          success: false,
          message: "You are already friends!",
          code: "ALREADY_FRIENDS",
          data: statusCheck.data,
        };

      case "none":
        break;

      default:
        break;
    }
  }

  return await sendFriendRequest(userId);
};

export const getFriends = async () => {
  try {
    const response = await api.get("/api/v1/friends/");
    return response.data;
  } catch (error) {
    console.error("Get friends error:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    // Return empty array instead of throwing error for 404/500
    if (error.response?.status === 404 || error.response?.status === 500) {
      console.warn("Friends endpoint not available, returning empty array");
      return [];
    }

    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        error.response?.data?.msg ||
        "Failed to fetch friends"
    );
  }
};

export const getPendingRequests = async () => {
  try {
    const response = await api.get(`/api/v1/friends/requests`);
    return response.data;
  } catch (error) {
    console.error("Get pending requests error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to fetch pending requests"
    );
  }
};

export const acceptFriendRequest = async (requesterId) => {
  try {
    console.log("✅ Accepting friend request from:", requesterId);
    const response = await api.post(`/api/v1/friends/accept/${requesterId}`);
    console.log("✅ Friend request accepted:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Accept friend request error:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 404) {
      throw new Error("Friend request not found");
    } else if (error.response?.status === 400) {
      throw new Error(
        error.response?.data?.detail || "Friend request already processed"
      );
    } else if (error.response?.status === 500) {
      throw new Error("Server error while accepting friend request");
    }

    throw new Error(
      error.response?.data?.detail || "Failed to accept friend request"
    );
  }
};

// Diary endpoints
export const createDiary = async (data) => {
  try {
    const response = await api.post(`/api/v1/diaries/`, data);
    return response.data;
  } catch (error) {
    console.error("Create diary error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to create diary"
    );
  }
};

export const getFeed = async () => {
  try {
    const response = await api.get(`/api/v1/diaries/feed`);
    return response.data;
  } catch (error) {
    console.error("Get feed error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to fetch feed"
    );
  }
};

export const likeDiary = async (diaryId) => {
  try {
    const response = await api.post(`/api/v1/diaries/${diaryId}/like`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log("Like endpoint not found, simulating success");
      return {
        success: true,
        message: "Like recorded locally (endpoint not implemented)",
      };
    }

    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to like diary"
    );
  }
};

export const commentOnDiary = async (diaryId, content) => {
  try {
    const response = await api.post(`/api/v1/diaries/${diaryId}/comment`, {
      content,
    });
    return response.data;
  } catch (error) {
    console.error("Comment on diary error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to add comment"
    );
  }
};

export const getDiaryComments = async (diaryId) => {
  try {
    const response = await api.get(`/api/v1/diaries/${diaryId}/comments`);
    return response.data;
  } catch (error) {
    console.error("Get diary comments error:", error.response?.data);
    if (error.response?.status === 404) {
      return [];
    }
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to fetch comments"
    );
  }
};

export const getDiaryLikes = async (diaryId) => {
  try {
    const response = await api.get(`/api/v1/diaries/${diaryId}/likes`);
    return response.data;
  } catch (error) {
    console.error("Get diary likes error:", error.response?.data);
    if (error.response?.status === 404) {
      return [];
    }
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to fetch likes"
    );
  }
};

// Group endpoints
export const createGroup = async (data) => {
  try {
    console.log("Creating group with data:", data);
    const response = await api.post(`/api/v1/groups/`, data);
    console.log("Group creation response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Create group error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to create group"
    );
  }
};

export const getUserGroups = async () => {
  try {
    const response = await api.get(`/api/v1/groups/my`);
    return response.data;
  } catch (error) {
    console.error(
      "Get user groups error:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        error.message ||
        "Failed to fetch groups"
    );
  }
};

export const getGroupById = async (groupId) => {
  try {
    const response = await api.get(`/api/v1/groups/${groupId}`);
    return response.data;
  } catch (error) {
    console.error(
      "Get user groups error:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        error.message ||
        "Failed to fetch groups"
    );
  }
};

export const updateGroupById = async (groupId, data) => {
  try {
    const response = await api.patch(`/api/v1/groups/${groupId}`, data);
    return response.data;
  } catch (error) {
    console.error(
      "Failed to update group",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        error.message ||
        "Failed to update groups"
    );
  }
};

export const uploadCover = async (groupId, file) => {
  const formData = new FormData();
  formData.append("cover", file);

  const response = await api.post(`/api/v1/groups/${groupId}/cover`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const getGroupCover = async (groupId) => {
  try {
    const res = await api.get(`/api/v1/groups/${groupId}/cover`);
    return res.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to get group cover"
    );
  }
};

export const deleteCoverById = async (coverId) => {
  try {
    const res = await api.delete(`/api/v1/groups/cover/${coverId}`);
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to delete cover");
  }
};

export const joinGroup = async (groupId) => {
  try {
    const response = await api.post(`/api/v1/groups/${groupId}/join`);
    return response.data;
  } catch (error) {
    console.error("Join group error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to join group"
    );
  }
};

// Chat endpoints
export const sendPrivateMessage = async (friendId, data) => {
  try {
    const response = await api.post(`/api/v1/chats/private/${friendId}`, data);

    if (response.data && !response.data.created_at) {
      response.data.created_at = new Date().toISOString();
    }

    return response.data;
  } catch (error) {
    console.error("Send private message error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to send message"
    );
  }
};

export const getPrivateChat = async (friendId) => {
  try {
    const response = await api.get(`/api/v1/chats/private/${friendId}`);

    const messages = Array.isArray(response.data) ? response.data : [];

    return messages.map((msg) => ({
      id: msg.id || Date.now() + Math.random(),
      sender_id: msg.sender_id,
      receiver_id: msg.receiver_id,
      content: msg.content || "",
      message_type: msg.message_type || "text",
      is_read: msg.is_read || false,
      created_at: msg.created_at || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Get private chat error:", error.response?.data);

    if (error.response?.status === 404) {
      console.log("Chat endpoint not found, returning empty array");
      return [];
    }

    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to load messages"
    );
  }
};

export const getGroupMessage = async (groupId) => {
  const res = await api.get(`/api/v1/groups/${groupId}/message`);
  return res.data;
};

export const updateMessageById = async (messageId, content) => {
  try {
    const res = await api.put(`/api/v1/messages/${messageId}`, content, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to update message");
  }
};

export const deleteMessageById = async (messageId) => {
  try {
    await api.delete(`/api/v1/messages/${messageId}`);
    return true;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to delete message");
  }
};

export const uploadFileMessage = async (groupId, file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(`/api/v1/messages/groups/${groupId}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const getGroupMembers = async (groupId) => {
  try {
    const response = await api.get(`/api/v1/groups/${groupId}/members/`);
    return response.data;
  } catch (error) {
    console.error("Get members error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to load members"
    );
  }
};

export const removeGroupMember = async (groupId, memberId) => {
  try {
    await api.delete(`/api/v1/groups/remove/${groupId}/members/${memberId}`);
  } catch (error) {
    console.error("Remove members error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to remove members"
    );
  }
};

export const leaveGroupById = async (groupId) => {
  try {
    await api.delete(`/api/v1/groups/leave/${groupId}`);
  } catch (error) {
    console.error("Leave error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to leave group"
    );
  }
};

export const getGroupDiaries = async (groupId) => {
  try {
    const response = await api.get(`/api/v1/groups/${groupId}/diaries/`);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error("Get group diaries error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to load group feed"
    );
  }
};

export const editMessage = async (msgId, content) => {
  try {
    console.log("Editing message:", { msgId, content });

    const res = await api.patch(`/api/v1/chats/private/${msgId}`, {
      content: content,
    });

    return res.data;
  } catch (err) {
    const errorData = err.response?.data;
    console.error("Edit message FULL error response:", errorData);

    let errorMessage = "Failed to edit message";

    if (errorData?.detail && Array.isArray(errorData.detail)) {
      errorMessage = errorData.detail.join(", ");
    } else if (errorData?.detail) {
      errorMessage = errorData.detail;
    } else if (errorData?.message) {
      errorMessage = errorData.message;
    } else if (typeof errorData === "string") {
      errorMessage = errorData;
    } else if (errorData) {
      errorMessage = JSON.stringify(errorData);
    }

    console.error("Extracted error message:", errorMessage);
    throw new Error(errorMessage);
  }
};

// Group message operations
export const editGroupMessage = async (messageId, content) => {
  try {
    const response = await api.put(`/api/v1/chats/group/${messageId}`, {
      content,
    });
    return response.data;
  } catch (err) {
    throw new Error(
      err.response?.data?.detail || "Failed to edit group message"
    );
  }
};

export const deleteGroupMessage = async (messageId) => {
  try {
    await api.delete(`/api/v1/chats/group/${messageId}`);
    return true;
  } catch (err) {
    throw new Error(
      err.response?.data?.detail || "Failed to delete group message"
    );
  }
};

export const getUserInvites = async () => {
  try {
    const res = await api.get(`${GROUPS_URL}/invites/pending`);
    return res.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to invite user to the group"
    );
  }
};

export const acceptInviteById = async (inviteId) => {
  try {
    await api.post(`${GROUPS_URL}/invites/${inviteId}/accept`);
    return true;
  } catch (error) {
    throw new Error(error.response?.data?.detail);
  }
};

export const deleteInvite = async (inviteId) => {
  try {
    await api.delete(`${GROUPS_URL}/invites/${inviteId}`);
    return true;
  } catch (error) {
    throw new Error(error.response?.data?.detail);
  }
};

export const inviteToGroup = async (groupId, userId) => {
  try {
    const res = await api.post(`/api/v1/groups/${groupId}/invites/${userId}`);
    return res.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to invite user to the group"
    );
  }
};

export const createGroupWithInvites = async (data, inviteeIds = []) => {
  try {
    const response = await api.post(`/api/v1/groups/`, {
      ...data,
      invitee_ids: inviteeIds,
    });
    return response.data;
  } catch (error) {
    console.error("Create group with invites error:", error.response?.data);

    if (error.response?.status === 422 || error.response?.status === 400) {
      console.log(
        "Invite feature not supported, creating group without invites"
      );
      const response = await api.post(`/api/v1/groups/`, data);
      return response.data;
    }

    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to create group"
    );
  }
};

export const getPendingInvites = async () => {
  try {
    const res = await api.get(`/api/v1/groups/invites/pending`);
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.detail || "Failed to load invites");
  }
};

export const acceptGroupInvite = async (inviteId) => {
  try {
    const res = await api.post(`/api/v1/groups/invites/${inviteId}/accept`);
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.detail || "Failed to join");
  }
};

export const getGroupInviteLink = async (groupId) => {
  try {
    const res = await api.get(`/api/v1/groups/${groupId}/invite-link`);
    return res.data.invite_link;
  } catch (err) {
    throw new Error(err.response?.data?.detail || "Failed to get link");
  }
};

export const deleteMessage = async (msgId) => {
  try {
    await api.delete(`/api/v1/chats/private/${msgId}`);
  } catch (err) {
    const detail = err.response?.data?.detail || "Failed to delete message";
    throw new Error(detail);
  }
};

export const sendMessage = async (
  friendId,
  { content, message_type = "text", reply_to_id = null }
) => {
  const res = await api.post(`/api/v1/chats/private/${friendId}`, {
    content,
    message_type,
    reply_to_id,
  });
  return res.data;
};

export const unfriend = async (friendId) => {
  try {
    const response = await api.post(`/api/v1/friends/unfriend/${friendId}`);
    return response.data;
  } catch (error) {
    console.error("Unfriend error:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 404) {
      throw new Error("Friendship not found");
    } else if (error.response?.status === 400) {
      throw new Error(
        error.response?.data?.detail || "Not friends with this user"
      );
    } else if (error.response?.status === 500) {
      throw new Error("Server error while unfriending");
    }

    throw new Error(error.response?.data?.detail || "Failed to unfriend");
  }
};

export const blockUser = async (userId) => {
  try {
    const response = await api.post(`/api/v1/friends/block/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Block user error:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 400) {
      throw new Error(error.response?.data?.detail || "Cannot block this user");
    } else if (error.response?.status === 500) {
      throw new Error("Server error while blocking user");
    }

    throw new Error(error.response?.data?.detail || "Failed to block user");
  }
};

export const unblockUser = async (userId) => {
  try {
    const response = await api.post(`/api/v1/friends/unblock/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Unblock user error:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 404) {
      throw new Error("User is not blocked");
    } else if (error.response?.status === 400) {
      throw new Error(error.response?.data?.detail || "User is not blocked");
    } else if (error.response?.status === 500) {
      throw new Error("Server error while unblocking user");
    }

    throw new Error(error.response?.data?.detail || "Failed to unblock user");
  }
};

export const getBlockedUsers = async () => {
  try {
    const response = await api.get(`/api/v1/friends/blocked`);
    return response.data;
  } catch (error) {
    console.error("Get blocked users error:", error);
    throw new Error(
      error.response?.data?.detail || "Failed to fetch blocked users"
    );
  }
};

export const markMessagesAsRead = async (messageIds) => {
  try {
    console.log("Simulating mark as read for messages:", messageIds);
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      message_ids: messageIds,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error in markMessagesAsRead simulation:", error);
    return { success: true, message_ids: messageIds };
  }
};

export const respondToGroupInvite = async (inviteId, action) => {
  console.log(`Simulating ${action} for group invite:`, inviteId);
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    success: true,
    invite_id: inviteId,
    action: action,
  };
};

export const getPendingGroupInvites = async () => {
  return [];
};

// Notes API - FIXED (all start with /api/v1)
// Notes API - Remove the duplicate /api/v1
export const getNotes = async (archived = false) => {
  const response = await api.get(`/api/v1/notes?archived=${String(archived)}`);
  return response.data;
};

export const getNote = async (noteId) => {
  const response = await api.get(`/api/v1/notes/${noteId}`);
  return response.data;
};

export const createNote = async (noteData) => {
  const response = await api.post("/api/v1/notes", noteData);
  return response.data;
};

export const updateNote = async (noteId, noteData) => {
  const response = await api.put(`/api/v1/notes/${noteId}`, noteData);
  return response.data;
};

export const deleteNote = async (noteId) => {
  const response = await api.delete(`/api/v1/notes/${noteId}`);
  return response.data;
};

export const togglePinNote = async (noteId) => {
  const response = await api.post(`/api/v1/notes/${noteId}/pin`);
  return response.data;
};

export const toggleArchiveNote = async (noteId) => {
  const response = await api.post(`/api/v1/notes/${noteId}/archive`);
  return response.data;
};

// Sharing API
export const shareNote = async (noteId, shareData) => {
  const response = await api.post(`/api/v1/notes/${noteId}/share`, shareData);
  return response.data;
};

export const stopSharingNote = async (noteId) => {
  const response = await api.post(`/api/v1/notes/${noteId}/stop-sharing`);
  return response.data;
};

export const getSharedNotes = async () => {
  try {
    const response = await api.get("/api/v1/notes/shared/with-me");
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log("Shared notes endpoint not implemented yet");
      return [];
    }
    throw error;
  }
};

export const getPublicNote = async (shareToken) => {
  const response = await api.get(`/api/v1/notes/public/${shareToken}`);
  return response.data;
};
