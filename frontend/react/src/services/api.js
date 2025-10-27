import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/v1';
const AUTH_URL = `${API_BASE}/auth`;
const USERS_URL = `${API_BASE}/users`;

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

export const register = async (data) => {
  try {
    const response = await axios.post(`${AUTH_URL}/register`, data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || 'Registration failed');
  }
};

export const verifyCode = async (data) => {
  try {
    const response = await axios.post(`${AUTH_URL}/verify-code`, data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || 'Verification failed');
  }
};

export const resendVerificationCode = async (email) => {
  try {
    const response = await axios.post(`${AUTH_URL}/resend-code`, { email });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || 'Failed to resend verification code');
  }
};

export const login = async (data) => {
  try {
    const response = await axios.post(`${AUTH_URL}/login`, data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || 'Login failed');
  }
};


// Dashboard-related endpoints
export const getMe = async () => {
  try {
    const response = await api.get(`${USERS_URL}/me`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || 'Failed to fetch profile');
  }
};

export const updateMe = async (data) => {
  try {
    const response = await api.put(`${USERS_URL}/me`, data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || 'Failed to update profile');
  }
};

export const searchUsers = async (query) => {
  try {
    const response = await api.get(`${USERS_URL}/search`, { params: { q: query } });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || 'Search failed');
  }
};


