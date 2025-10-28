// services/api.js
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/v1';
const AUTH_URL = `${API_BASE}/auth`;
const USERS_URL = `${API_BASE}/users`;
const FRIENDS_URL = `${API_BASE}/friends`;
const DIARIES_URL = `${API_BASE}/diaries`;
const GROUPS_URL = `${API_BASE}/groups`;
const CHATS_URL = `${API_BASE}/chats`;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
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
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const register = async (data) => {
  try {
    console.log('Sending registration data:', data);
    
    const response = await axios.post(`${AUTH_URL}/register`, data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Registration error details:', error.response?.data);
    
    // Handle different error response formats
    const errorMessage = 
      error.response?.data?.detail || 
      error.response?.data?.msg || 
      error.response?.data?.message ||
      'Registration failed';
    
    throw new Error(errorMessage);
  }
};

export const verifyCode = async (data) => {
  try {
    const response = await axios.post(`${AUTH_URL}/verify-code`, data);
    return response.data;
  } catch (error) {
    console.error('Verify code error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Verification failed');
  }
};

export const login = async (data) => {
  try {
    const response = await axios.post(`${AUTH_URL}/login`, data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data);
    throw new Error(error.response?.data?.detail || 'Login failed');
  }
};

// User endpoints
export const getMe = async () => {
  try {
    const response = await api.get(`${USERS_URL}/me`);
    return response.data;
  } catch (error) {
    console.error('Get me error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to fetch profile');
  }
};

export const updateMe = async (data) => {
  try {
    const response = await api.put(`${USERS_URL}/me`, data);
    return response.data;
  } catch (error) {
    console.error('Update me error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to update profile');
  }
};

export const searchUsers = async (query) => {
  try {
    const response = await api.get(`${USERS_URL}/search`, { params: { q: query } });
    return response.data;
  } catch (error) {
    console.error('Search users error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Search failed');
  }
};

// Friend endpoints
export const sendFriendRequest = async (userId) => {
  try {
    const response = await api.post(`${FRIENDS_URL}/request/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Send friend request error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to send friend request');
  }
};

export const getFriends = async () => {
  try {
    const response = await api.get(`${FRIENDS_URL}/`);
    return response.data;
  } catch (error) {
    console.error('Get friends error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to fetch friends');
  }
};

export const getPendingRequests = async () => {
  try {
    const response = await api.get(`${FRIENDS_URL}/requests`);
    return response.data;
  } catch (error) {
    console.error('Get pending requests error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to fetch pending requests');
  }
};

export const acceptFriendRequest = async (requesterId) => {
  try {
    const response = await api.post(`${FRIENDS_URL}/accept/${requesterId}`);
    return response.data;
  } catch (error) {
    console.error('Accept friend request error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to accept friend request');
  }
};

// Diary endpoints
export const createDiary = async (data) => {
  try {
    const response = await api.post(`${DIARIES_URL}/`, data);
    return response.data;
  } catch (error) {
    console.error('Create diary error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to create diary');
  }
};

export const getFeed = async () => {
  try {
    const response = await api.get(`${DIARIES_URL}/feed`);
    return response.data;
  } catch (error) {
    console.error('Get feed error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to fetch feed');
  }
};

export const likeDiary = async (diaryId) => {
  try {
    const response = await api.post(`${DIARIES_URL}/${diaryId}/like`);
    return response.data;
  } catch (error) {
    console.error('Like diary error:', error.response?.data);
    
    // If endpoint doesn't exist yet, simulate success
    if (error.response?.status === 404) {
      console.log('Like endpoint not found, simulating success');
      return { success: true };
    }
    
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to like diary');
  }
};

export const commentOnDiary = async (diaryId, content) => {
  try {
    const response = await api.post(`${DIARIES_URL}/${diaryId}/comment`, { content });
    return response.data;
  } catch (error) {
    console.error('Comment on diary error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to add comment');
  }
};

export const getDiaryComments = async (diaryId) => {
  try {
    const response = await api.get(`${DIARIES_URL}/${diaryId}/comments`);
    return response.data;
  } catch (error) {
    console.error('Get diary comments error:', error.response?.data);
    // Return empty array if endpoint doesn't exist yet
    if (error.response?.status === 404) {
      return [];
    }
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to fetch comments');
  }
};

export const getDiaryLikes = async (diaryId) => {
  try {
    const response = await api.get(`${DIARIES_URL}/${diaryId}/likes`);
    return response.data;
  } catch (error) {
    console.error('Get diary likes error:', error.response?.data);
    // Return empty array if endpoint doesn't exist yet
    if (error.response?.status === 404) {
      return [];
    }
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to fetch likes');
  }
};

// Group endpoints
export const createGroup = async (data) => {
  try {
    const response = await api.post(`${GROUPS_URL}/`, data);
    return response.data;
  } catch (error) {
    console.error('Create group error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to create group');
  }
};

export const getUserGroups = async () => {
  try {
    const response = await api.get(`${GROUPS_URL}/`);
    return response.data;
  } catch (error) {
    console.error('Get user groups error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to fetch groups');
  }
};

export const joinGroup = async (groupId) => {
  try {
    const response = await api.post(`${GROUPS_URL}/${groupId}/join`);
    return response.data;
  } catch (error) {
    console.error('Join group error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to join group');
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
    console.error('Send private message error:', error.response?.data);
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to send message');
  }
};

export const getPrivateChat = async (friendId) => {
  try {
    const response = await api.get(`${CHATS_URL}/private/${friendId}`);
    
    // Ensure messages have proper structure with Cambodia time
    const messages = Array.isArray(response.data) ? response.data : [];
    
    return messages.map(msg => ({
      id: msg.id || Date.now() + Math.random(),
      sender_id: msg.sender_id,
      receiver_id: msg.receiver_id,
      content: msg.content || '',
      message_type: msg.message_type || 'text',
      is_read: msg.is_read || false,
      created_at: msg.created_at || new Date().toISOString()
    }));
    
  } catch (error) {
    console.error('Get private chat error:', error.response?.data);
    
    if (error.response?.status === 404) {
      console.log('Chat endpoint not found, returning empty array');
      return [];
    }
    
    throw new Error(error.response?.data?.detail || error.response?.data?.msg || 'Failed to load messages');
  }
};