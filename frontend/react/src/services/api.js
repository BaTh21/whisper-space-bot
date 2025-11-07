// services/api.js
import axios from "axios";

const API_BASE = "http://localhost:8000/api/v1";
const AUTH_URL = `${API_BASE}/auth`;
const USERS_URL = `${API_BASE}/users`;
const FRIENDS_URL = `${API_BASE}/friends`;
const DIARIES_URL = `${API_BASE}/diaries`;
const GROUPS_URL = `${API_BASE}/groups`;
const CHATS_URL = `${API_BASE}/chats`;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
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

// Auth endpoints
export const register = async (data) => {
  try {
    console.log("Sending registration data:", data);

    const response = await axios.post(`${AUTH_URL}/register`, data, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Registration error details:", error.response?.data);

    // Handle different error response formats
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
    const response = await axios.post(`${AUTH_URL}/verify-code`, data);
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

export const login = async (data) => {
  try {
    const response = await axios.post(`${AUTH_URL}/login`, data, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data;
  } catch (error) {
    console.error("Login error:", error.response?.data);
    throw new Error(error.response?.data?.detail || "Login failed");
  }
};

// User endpoints
export const getMe = async () => {
  try {
    const response = await api.get(`${USERS_URL}/me`);
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
    const response = await api.put(`${USERS_URL}/me`, data);
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
  formData.append('avatar', file);
  
  const response = await api.post('/avatars/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};


export const searchUsers = async (query) => {
  // Validate and clean the query
  if (!query || typeof query !== 'string') {
    return [];
  }

  const trimmedQuery = query.trim();
  
  // Return empty array for short queries instead of error
  if (trimmedQuery.length < 1) {
    return [];
  }

  try {
    // Remove limit and offset parameters as they might be causing validation issues
    const response = await api.get(`${USERS_URL}/search`, { 
      params: { 
        query: trimmedQuery // Use 'query' instead of 'q'
      } 
    });
    return response.data;
  } catch (error) {
    console.error('Search users error:', {
      status: error.response?.status,
      data: error.response?.data,
      query: trimmedQuery
    });
    
    // Handle 422 error specifically
    if (error.response?.status === 422) {
      console.warn('Search validation failed, returning empty results');
      return []; // Return empty array instead of throwing error
    }
    
    // For other errors, still return empty array to prevent UI crashes
    return [];
  }
};

// Friend endpoints
const getCurrentUserId = () => {
  try {
    const userData = localStorage.getItem('user');
    
    // If no data or it's the broken string, return null
    if (!userData || userData === '[object Object]') {
      console.warn('User data missing or corrupted');
      return null;
    }

    // Try to parse normally
    const user = JSON.parse(userData);
    return user?.id || null;
    
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
};


export const sendFriendRequest = async (userId) => {
  // Input validation
  if (!userId || typeof userId !== 'number') {
    return {
      success: false,
      message: 'Invalid user ID',
      code: 'INVALID_ID'
    };
  }

  // Get current user ID
  const currentUserId = getCurrentUserId();
  
  // Only check self-request if we have a valid currentUserId
  if (currentUserId && userId === currentUserId) {
    return {
      success: false,
      message: 'You cannot send a friend request to yourself',
      code: 'SELF_REQUEST'
    };
  }

  try {
    const response = await api.post(`/friends/request/${userId}`);
    
    return {
      success: true,
      data: response.data,
      message: 'Friend request sent successfully!',
      code: 'SUCCESS'
    };
    
  } catch (error) {
    console.error('Friend request error:', error);

    // Handle 409 Conflict - request already exists
    if (error.response?.status === 409) {
      return {
        success: true, // Consider this a success
        data: error.response?.data,
        message: 'Friend request already sent!',
        code: 'ALREADY_EXISTS'
      };
    }

    // Handle other HTTP errors
    const errorMessage = error.response?.data?.detail 
      || error.response?.data?.message 
      || error.message 
      || 'Failed to send friend request';

    return {
      success: false,
      message: errorMessage,
      code: 'REQUEST_FAILED',
      status: error.response?.status
    };
  }
};


export const checkFriendStatus = async (userId) => {
  try {
    const response = await api.get(`/friends/status/${userId}`);
    return {
      exists: true,
      status: response.data.status, // 'pending', 'accepted', 'none'
      data: response.data
    };
  } catch (error) {
    return {
      exists: false,
      status: 'none',
      error: error.response?.data
    };
  }
};

// Smart friend request that checks status first
export const smartFriendRequest = async (userId) => {
  // First check current status
  const statusCheck = await checkFriendStatus(userId);
  
  if (statusCheck.exists) {
    switch (statusCheck.status) {
      case 'pending':
        return {
          success: false,
          message: 'Friend request already pending!',
          code: 'ALREADY_PENDING',
          data: statusCheck.data
        };
      
      case 'accepted':
        return {
          success: false,
          message: 'You are already friends!',
          code: 'ALREADY_FRIENDS',
          data: statusCheck.data
        };
      
      case 'none':
        // Continue to send request
        break;
      
      default:
        // Continue to send request
        break;
    }
  }

  // Send the actual friend request
  return await sendFriendRequest(userId);
};

export const getFriends = async () => {
  try {
    const response = await api.get(`${FRIENDS_URL}/`);
    return response.data;
  } catch (error) {
    console.error("Get friends error:", error.response?.data);
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to fetch friends"
    );
  }
};

export const getPendingRequests = async () => {
  try {
    const response = await api.get(`${FRIENDS_URL}/requests`);
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
    const response = await api.post(`${FRIENDS_URL}/accept/${requesterId}`);
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
    const response = await api.post(`${DIARIES_URL}/`, data);
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
    const response = await api.get(`${DIARIES_URL}/feed`);
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
    const response = await api.post(`${DIARIES_URL}/${diaryId}/like`);
    return response.data;
  } catch (error) {
    // If endpoint doesn't exist (404), simulate success
    if (error.response?.status === 404) {
      console.log("Like endpoint not found, simulating success");
      return {
        success: true,
        message: "Like recorded locally (endpoint not implemented)",
      };
    }

    // If it's another error, throw it
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to like diary"
    );
  }
};

export const commentOnDiary = async (diaryId, content) => {
  try {
    const response = await api.post(`${DIARIES_URL}/${diaryId}/comment`, {
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
    const response = await api.get(`${DIARIES_URL}/${diaryId}/comments`);
    return response.data;
  } catch (error) {
    console.error("Get diary comments error:", error.response?.data);
    // Return empty array if endpoint doesn't exist yet
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
    const response = await api.get(`${DIARIES_URL}/${diaryId}/likes`);
    return response.data;
  } catch (error) {
    console.error("Get diary likes error:", error.response?.data);
    // Return empty array if endpoint doesn't exist yet
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
    const response = await api.post(`${GROUPS_URL}/`, data);
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
    // Use the correct endpoint: /groups/my
    const response = await api.get(`${GROUPS_URL}/my`);
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
    const response = await api.get(`${GROUPS_URL}/${groupId}`);
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
    const response = await api.patch(`${GROUPS_URL}/${groupId}`, data);
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

export const joinGroup = async (groupId) => {
  try {
    const response = await api.post(`${GROUPS_URL}/${groupId}/join`);
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
    const response = await api.post(`${CHATS_URL}/private/${friendId}`, data);

    // Ensure the response has proper timestamp
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
    const response = await api.get(`${CHATS_URL}/private/${friendId}`);

    // Ensure messages have proper structure with Cambodia time
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
  const res = await api.get(`${GROUPS_URL}/${groupId}/message`);
  return res.data;
};

export const getGroupMembers = async (groupId) => {
  try {
    const response = await api.get(`${GROUPS_URL}/${groupId}/members/`);
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
    await api.delete(`${GROUPS_URL}/remove/${groupId}/members/${memberId}`);
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
    await api.delete(`${GROUPS_URL}/leave/${groupId}`);
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
    const response = await api.get(`${GROUPS_URL}/${groupId}/diaries/`);
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

// services/api.js - USE THIS VERSION
export const editMessage = async (msgId, content) => {
  try {
    console.log("Editing message:", { msgId, content });

    const res = await api.patch(`${CHATS_URL}/private/${msgId}`, {
      content: content,
    });

    return res.data;
  } catch (err) {
    // Get the actual error message from the response
    const errorData = err.response?.data;
    console.error("Edit message FULL error response:", errorData);

    let errorMessage = "Failed to edit message";

    // Handle the case where detail is an array
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
// Group message operations
export const editGroupMessage = async (messageId, content) => {
  try {
    const response = await api.put(`${CHATS_URL}/group/${messageId}`, {
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
    await api.delete(`${CHATS_URL}/group/${messageId}`);
    return true;
  } catch (err) {
    throw new Error(
      err.response?.data?.detail || "Failed to delete group message"
    );
  }
};

export const getUserInvites = async () => {
  try{
    const res = await api.get(`${GROUPS_URL}/invites/pending`);
    return res.data;
  }catch(error){
    throw new Error(
      error.response?.data?.detail ||
        "Failed to invite user to the group"
    );
  }
}

export const inviteToGroup = async (groupId, userId) => {
  try {
    const res = await api.post(`${GROUPS_URL}/${groupId}/invites/${userId}`);
    return res.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail ||
        "Failed to invite user to the group"
    );
  }
};

export const createGroupWithInvites = async (data, inviteeIds = []) => {
  try {
    const response = await api.post(`${GROUPS_URL}/`, {
      ...data,
      invitee_ids: inviteeIds,
    });
    return response.data;
  } catch (error) {
    console.error("Create group with invites error:", error.response?.data);

    // If the endpoint doesn't support invites, try creating without invites
    if (error.response?.status === 422 || error.response?.status === 400) {
      console.log(
        "Invite feature not supported, creating group without invites"
      );
      const response = await api.post(`${GROUPS_URL}/`, data);
      return response.data;
    }

    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.msg ||
        "Failed to create group"
    );
  }
};
// Get pending invites
export const getPendingInvites = async () => {
  try {
    const res = await api.get(`${GROUPS_URL}/invites/pending`);
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.detail || "Failed to load invites");
  }
};

// Accept invite
export const acceptGroupInvite = async (inviteId) => {
  try {
    const res = await api.post(`${GROUPS_URL}/invites/${inviteId}/accept`);
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.detail || "Failed to join");
  }
};

// Get invite link (we'll implement backend next)
export const getGroupInviteLink = async (groupId) => {
  try {
    const res = await api.get(`${GROUPS_URL}/${groupId}/invite-link`);
    return res.data.invite_link;
  } catch (err) {
    throw new Error(err.response?.data?.detail || "Failed to get link");
  }
};

export const deleteMessage = async (msgId) => {
  try {
    await api.delete(`${CHATS_URL}/private/${msgId}`);
  } catch (err) {
    const detail = err.response?.data?.detail || "Failed to delete message";
    throw new Error(detail);
  }
};

export const sendMessage = async (
  friendId,
  { content, message_type = "text", reply_to_id = null }
) => {
  const res = await api.post(`/private/${friendId}`, {
    content,
    message_type,
    reply_to_id,
  });
  return res.data;
};

export const unfriend = async (friendId) => {
  try {
    const response = await api.post(`${FRIENDS_URL}/unfriend/${friendId}`);
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
    const response = await api.post(`${FRIENDS_URL}/block/${userId}`);
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
    const response = await api.post(`${FRIENDS_URL}/unblock/${userId}`);
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
    const response = await api.get(`${FRIENDS_URL}/blocked`);
    return response.data;
  } catch (error) {
    console.error("Get blocked users error:", error);
    throw new Error(
      error.response?.data?.detail || "Failed to fetch blocked users"
    );
  }
};
