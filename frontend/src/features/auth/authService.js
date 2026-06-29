import axios from 'axios';
import API_BASE_URL from '../../config/api';

const TOKEN_KEY = 'token';

const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    authApi.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    delete authApi.defaults.headers.common.Authorization;
  }
};

const storedToken = localStorage.getItem(TOKEN_KEY);
if (storedToken) {
  authApi.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
}

export const loginRequest = async (credentials) => {
  const { data } = await authApi.post('/auth/login', credentials);
  if (data.success && data.token) {
    setAuthToken(data.token);
  }
  return data;
};

export const fetchMeRequest = async () => {
  const { data } = await authApi.get('/auth/me');
  return data;
};

export const clearAuthSession = () => {
  setAuthToken(null);
};

export default authApi;
